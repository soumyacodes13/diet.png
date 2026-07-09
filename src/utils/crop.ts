import { PixelCrop } from 'react-image-crop';

/**
 * Extracts a cropped file from an HTMLImageElement using canvas rendering.
 */
export function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
  fileName: string
): Promise<File> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return Promise.reject(new Error('No 2d context for canvas'));
  }

  // Calculate scales based on visual display size vs original resolution
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  canvas.width = crop.width;
  canvas.height = crop.height;

  // Enable high-quality scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve, reject) => {
    // Detect mime type from original file extension
    const extension = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
    let mimeType = 'image/jpeg';
    if (extension === 'png') {
      mimeType = 'image/png';
    } else if (extension === 'webp') {
      mimeType = 'image/webp';
    } else if (extension === 'gif') {
      mimeType = 'image/gif';
    } else if (extension === 'bmp') {
      mimeType = 'image/bmp';
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        const file = new File([blob], fileName, { type: mimeType });
        resolve(file);
      },
      mimeType,
      0.95 // Maintain high quality for intermediate crop
    );
  });
}
