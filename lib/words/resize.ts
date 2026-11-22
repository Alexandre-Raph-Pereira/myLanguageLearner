/** Browser-only: resize a photo to ≤ 2000 px long side, JPEG ≈ 0.85, aiming < 1.5 MB. */

export const MAX_SIDE = 2000;
export const TARGET_BYTES = 1.5 * 1024 * 1024;

/** Target size keeping the aspect ratio (never upscales). */
export function fitWithin(width: number, height: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function resizeImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // Format the browser cannot decode (e.g. HEIC on some browsers): send as is.
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  for (const quality of [0.85, 0.75, 0.6]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && (blob.size <= TARGET_BYTES || quality === 0.6)) return blob;
  }
  return file;
}
