/**
 * Kompres gambar di browser sebelum upload.
 * Max sisi terpanjang 1280px, kualitas JPEG \~0.7 → biasanya 100–400 KB.
 */
export async function compressImage(
  file: File,
  maxEdge = 1280,
  quality = 0.72
): Promise<File> {
  if (!file.type.startsWith('image/')) return file; // PDF dll biarkan

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > maxEdge || height > maxEdge) {
    const ratio = Math.min(maxEdge / width, maxEdge / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  );
  if (!blob) return file;

  const name = file.name.replace(/\.\w+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
}
