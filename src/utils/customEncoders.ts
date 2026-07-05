/**
 * Encodes raw RGBA pixel data into a 24-bit uncompressed BMP (Bitmap) file.
 * 
 * @param rgbaBytes The raw RGBA Uint8ClampedArray from canvas
 * @param width The image width
 * @param height The image height
 * @returns A Blob representing the BMP image
 */
export function encodeBMP(
  rgbaBytes: Uint8ClampedArray,
  width: number,
  height: number
): Blob {
  const rowSize = Math.floor((width * 24 + 31) / 32) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // Bitmap File Header (14 bytes)
  view.setUint16(0, 0x424D, false); // Signature "BM"
  view.setUint32(2, fileSize, true); // File size
  view.setUint16(6, 0, true);        // Reserved
  view.setUint16(8, 0, true);        // Reserved
  view.setUint32(10, 54, true);      // Offset to pixel data

  // DIB Header: BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true);      // Header size
  view.setInt32(18, width, true);    // Width
  view.setInt32(22, height, true);   // Height (positive for bottom-up)
  view.setUint16(26, 1, true);       // Color planes (must be 1)
  view.setUint16(28, 24, true);      // Bits per pixel (24-bit RGB)
  view.setUint32(30, 0, true);       // Compression (0 = BI_RGB, uncompressed)
  view.setUint32(34, pixelDataSize, true); // Size of pixel data
  view.setInt32(38, 2835, true);     // H-resolution (72 dpi ~ 2835 ppm)
  view.setInt32(42, 2835, true);     // V-resolution (72 dpi ~ 2835 ppm)
  view.setUint32(46, 0, true);       // Palette colors (0 = default)
  view.setUint32(50, 0, true);       // Important colors (0 = all)

  // Copy Pixel Data (BMP expects bottom-up row ordering and BGR color values)
  const pixels = new Uint8Array(buffer, 54);
  let dstOffset = 0;

  for (let y = height - 1; y >= 0; y--) {
    const srcRowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const srcOffset = srcRowOffset + x * 4;
      pixels[dstOffset] = rgbaBytes[srcOffset + 2];     // Blue
      pixels[dstOffset + 1] = rgbaBytes[srcOffset + 1]; // Green
      pixels[dstOffset + 2] = rgbaBytes[srcOffset];     // Red
      dstOffset += 3;
    }
    // Pad rows to a multiple of 4 bytes
    const padding = rowSize - (width * 3);
    for (let p = 0; p < padding; p++) {
      pixels[dstOffset++] = 0;
    }
  }

  return new Blob([buffer], { type: 'image/bmp' });
}

/**
 * Packages a PNG blob into a standard ICO (Windows Icon) file.
 * Since Windows 7, ICO files natively accept PNG sub-images.
 * 
 * @param pngBlob The canvas-generated PNG Blob
 * @param width The image width
 * @param height The image height
 * @returns A promise resolving to the ICO Blob
 */
export async function encodeICO(
  pngBlob: Blob,
  width: number,
  height: number
): Promise<Blob> {
  const pngBuffer = await pngBlob.arrayBuffer();
  const icoHeader = new ArrayBuffer(22);
  const view = new DataView(icoHeader);

  // Icon Directory Header (6 bytes)
  view.setUint16(0, 0, true); // Reserved (must be 0)
  view.setUint16(2, 1, true); // Type (1 = ICO)
  view.setUint16(4, 1, true); // Number of images in file

  // Icon Directory Entry (16 bytes)
  view.setUint8(6, width >= 256 ? 0 : width);   // Width
  view.setUint8(7, height >= 256 ? 0 : height); // Height
  view.setUint8(8, 0);                          // Color palette (0 = no palette)
  view.setUint8(9, 0);                          // Reserved
  view.setUint16(10, 1, true);                  // Color planes
  view.setUint16(12, 32, true);                 // Bits per pixel (32-bit RGBA)
  view.setUint32(14, pngBuffer.byteLength, true); // Size of PNG data
  view.setUint32(18, 22, true);                 // Offset to PNG data (22 bytes header)

  return new Blob([icoHeader, pngBuffer], { type: 'image/x-icon' });
}

/**
 * Encodes a raster image Blob as a responsive vector SVG container embedding the base64 source.
 * 
 * @param rasterBlob The raster Blob (PNG/JPEG)
 * @param width The image width
 * @param height The image height
 * @returns A promise resolving to the SVG Blob
 */
export function encodeSVG(
  rasterBlob: Blob,
  width: number,
  height: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image href="${base64Data}" width="${width}" height="${height}" />
</svg>`;
      resolve(new Blob([svgString], { type: 'image/svg+xml' }));
    };
    reader.onerror = reject;
    reader.readAsDataURL(rasterBlob);
  });
}
