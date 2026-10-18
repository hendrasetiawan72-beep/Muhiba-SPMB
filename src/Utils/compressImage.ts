/**
 * Kompres gambar di browser sebelum upload.
 * - Mengikuti orientasi EXIF (foto HP tidak miring)
 * - Latar putih untuk PNG transparan (bukan hitam)
 * - Menurunkan kualitas bertahap, lalu dimensi, sampai <= targetBytes
 */
export interface CompressOptions {
  maxEdge: number; // sisi terpanjang (px)
  targetBytes: number; // target ukuran akhir
  startQuality?: number; // default 0.82
  minQuality?: number; // default 0.5
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

function asJpegFile(blob: Blob, original: File): File {
  const base = original.name.replace(/\.\w+$/, '');
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

export async function compressImage(file: File, opts: CompressOptions): Promise<File> {
  if (!file.type.startsWith('image/')) return file; // PDF dll dibiarkan

  const { maxEdge, targetBytes, startQuality = 0.82, minQuality = 0.5 } = opts;

  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file);
  } catch {
    return file; // tidak bisa didecode → biarkan; validasi bucket yang menolak
  }

  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const longest = Math.max(srcW, srcH);

  // Sudah JPEG, kecil, dan dimensinya aman → tidak perlu di-encode ulang
  if (file.type === 'image/jpeg' && file.size <= targetBytes && longest <= maxEdge) {
    bitmap.close();
    return file;
  }

  let edge = Math.min(maxEdge, longest);
  let best: Blob | null = null;

  try {
    for (let round = 0; round < 4; round++) {
      const ratio = edge / longest;
      const w = Math.max(1, Math.round(srcW * ratio));
      const h = Math.max(1, Math.round(srcH * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bitmap, 0, 0, w, h);

      for (let q = startQuality; q >= minQuality - 1e-6; q -= 0.08) {
        const blob = await toJpegBlob(canvas, q);
        if (!blob) return file;
        best = blob;
        if (blob.size <= targetBytes) return asJpegFile(blob, file);
      }

      edge = Math.round(edge * 0.85); // masih kebesaran → kecilkan dimensi
    }
  } finally {
    bitmap.close();
  }

  return best ? asJpegFile(best, file) : file;
}
