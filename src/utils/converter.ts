import { encodeBMP, encodeICO, encodeSVG } from './customEncoders';

export interface ConversionOptions {
  targetFormat: 'png' | 'jpeg' | 'webp' | 'bmp' | 'ico' | 'svg' | 'gif';
  quality?: number; // 0 to 100
  targetSizeKb?: number; // target file size in KB
}

export interface ConversionResult {
  blob: Blob;
  fileName: string;
  url: string;
}

function quantizeCanvasColors(canvas: HTMLCanvasElement, quality: number) {
  if (quality >= 100) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Map quality 1-99 to color channel bits (2 to 6 bits)
  let bits = 8;
  if (quality >= 90) bits = 6;
  else if (quality >= 75) bits = 5;
  else if (quality >= 50) bits = 4;
  else if (quality >= 25) bits = 3;
  else bits = 2;

  const shift = 8 - bits;
  const mask = (0xFF >> shift) << shift;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] & mask;       // R
    data[i + 1] = data[i + 1] & mask; // G
    data[i + 2] = data[i + 2] & mask; // B
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Converts an image file to the target format client-side.
 * Handles PNG, JPEG, WEBP, GIF natively, and maps BMP, ICO, SVG to lightweight custom encoders.
 * 
 * If a `targetSizeKb` is specified for lossy formats (JPEG/WEBP), it runs a binary search
 * to find the quality setting that gets closest to the target file size in bytes.
 * 
 * @param file The original image File object
 * @param options Target format and quality options
 * @returns A promise resolving to the conversion result
 */
export function convertImage(
  file: File,
  options: ConversionOptions
): Promise<ConversionResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not get 2D context from canvas');
        }
        
        // Handle background color for formats that do not support transparency (JPEG/BMP)
        if (options.targetFormat === 'jpeg' || options.targetFormat === 'bmp') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        ctx.drawImage(img, 0, 0);
        
        const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const newFileName = `${originalNameWithoutExt}.${options.targetFormat}`;

        // Dispatch based on target output format
        if (options.targetFormat === 'bmp') {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const bmpBlob = encodeBMP(imgData.data, canvas.width, canvas.height);
          const downloadUrl = URL.createObjectURL(bmpBlob);
          
          URL.revokeObjectURL(objectUrl);
          resolve({
            blob: bmpBlob,
            fileName: newFileName,
            url: downloadUrl,
          });
        } else if (options.targetFormat === 'ico') {
          canvas.toBlob(async (pngBlob) => {
            if (!pngBlob) {
              reject(new Error('Failed to generate PNG base for ICO conversion'));
              return;
            }
            try {
              const icoBlob = await encodeICO(pngBlob, canvas.width, canvas.height);
              const downloadUrl = URL.createObjectURL(icoBlob);
              
              URL.revokeObjectURL(objectUrl);
              resolve({
                blob: icoBlob,
                fileName: newFileName,
                url: downloadUrl,
              });
            } catch (err) {
              reject(err);
            }
          }, 'image/png');
        } else if (options.targetFormat === 'svg') {
          canvas.toBlob(async (pngBlob) => {
            if (!pngBlob) {
              reject(new Error('Failed to generate PNG base for SVG conversion'));
              return;
            }
            try {
              const svgBlob = await encodeSVG(pngBlob, canvas.width, canvas.height);
              const downloadUrl = URL.createObjectURL(svgBlob);
              
              URL.revokeObjectURL(objectUrl);
              resolve({
                blob: svgBlob,
                fileName: newFileName,
                url: downloadUrl,
              });
            } catch (err) {
              reject(err);
            }
          }, 'image/png');
        } else {
          // Natively supported browser formats: PNG, JPEG, WEBP, GIF (static)
          const mimeType = options.targetFormat === 'gif' ? 'image/gif' : `image/${options.targetFormat}`;
          const scaleQuality = options.quality !== undefined ? options.quality / 100 : 0.9;
          
          // Helper promise to get a blob size at a specific quality factor (0-100)
          const getBlobAtQuality = async (q: number): Promise<Blob> => {
            // Reset canvas to original pixels before applying compression adjustments
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (options.targetFormat === 'jpeg') {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(img, 0, 0);

            // Apply quantization for PNG/GIF to compress size client-side
            if (options.targetFormat === 'png' || options.targetFormat === 'gif') {
              quantizeCanvasColors(canvas, q);
            }

            return new Promise((res, rej) => {
              canvas.toBlob(
                (b) => {
                  if (b) res(b);
                  else rej(new Error('Failed to encode'));
                },
                mimeType,
                options.targetFormat === 'png' || options.targetFormat === 'gif' ? undefined : q / 100
              );
            });
          };

          // If target size is specified, use binary search to fit the quality factor
          if (options.targetSizeKb !== undefined && !isNaN(options.targetSizeKb) && options.targetSizeKb > 0 && 
              (options.targetFormat === 'jpeg' || options.targetFormat === 'webp' || options.targetFormat === 'png' || options.targetFormat === 'gif')) {
            const targetBytes = options.targetSizeKb * 1024;
            let low = 1;
            let high = 100;
            let bestBlob: Blob | null = null;
            let bestDiff = Infinity;

            // 7 iterations covers binary search space of 100 (2^7 = 128)
            for (let iter = 0; iter < 7; iter++) {
              const mid = Math.round((low + high) / 2);
              try {
                const currentBlob = await getBlobAtQuality(mid);
                const currentSize = currentBlob.size;
                const diff = Math.abs(currentSize - targetBytes);

                if (diff < bestDiff) {
                  bestDiff = diff;
                  bestBlob = currentBlob;
                }

                if (currentSize > targetBytes) {
                  high = mid - 1; // Need lower quality
                } else if (currentSize < targetBytes) {
                  low = mid + 1;  // Can support higher quality
                } else {
                  break; // Exact size match
                }
              } catch (err) {
                break;
              }
            }

            URL.revokeObjectURL(objectUrl);
            if (!bestBlob) {
              reject(new Error('Target size fitting failed'));
              return;
            }

            const downloadUrl = URL.createObjectURL(bestBlob);
            resolve({
              blob: bestBlob,
              fileName: newFileName,
              url: downloadUrl,
            });
          } else {
            // Reset canvas to original pixels
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (options.targetFormat === 'jpeg') {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(img, 0, 0);

            // Apply quantization for PNG/GIF at target quality
            if ((options.targetFormat === 'png' || options.targetFormat === 'gif') && options.quality !== undefined) {
              quantizeCanvasColors(canvas, options.quality);
            }

            canvas.toBlob(
              (blob) => {
                URL.revokeObjectURL(objectUrl);
                if (!blob) {
                  reject(new Error('Canvas conversion failed'));
                  return;
                }
                const downloadUrl = URL.createObjectURL(blob);
                resolve({
                  blob,
                  fileName: newFileName,
                  url: downloadUrl,
                });
              },
              mimeType,
              options.targetFormat === 'png' || options.targetFormat === 'gif' ? undefined : scaleQuality
            );
          }
        }
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image file. Make sure it is a valid image.'));
    };
    
    img.src = objectUrl;
  });
}
