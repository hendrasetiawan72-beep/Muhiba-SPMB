/**
 * Validasi "magic bytes" (signature file) — tidak mempercayai file.type / ekstensi dari pengguna.
 * Hanya mengenali format yang diizinkan aplikasi: PDF, JPEG, PNG, WEBP.
 */
export type FileKind = 'pdf' | 'jpeg' | 'png' | 'webp';

export const KIND_MIME: Record<FileKind, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export async function sniffFileKind(blob: Blob): Promise<FileKind | null> {
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const at = (sig: number[], offset = 0) => sig.every((byte, i) => head[offset + i] === byte);

  if (at([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf'; // %PDF-
  if (at([0xff, 0xd8, 0xff])) return 'jpeg';
  if (at([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8)) return 'webp'; // RIFF....WEBP
  return null;
}

/** Nama file untuk tampilan/metadata saja: buang pemisah path & karakter kontrol, batasi panjang. */
export function safeDisplayName(name: string, fallback: string): string {
  const cleaned = (name || '')
    .replace(/[\\/\u0000-\u001f\u007f]/g, '_')
    .replace(/\.{2,}/g, '.')
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}
