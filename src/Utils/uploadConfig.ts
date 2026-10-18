/**
 * Satu-satunya sumber batas & preset upload berkas.
 * UI, kompresi, dan validasi semuanya membaca file ini.
 * BUCKET_MAX_BYTES harus sama dengan file_size_limit bucket 'dokumen-ppdb' (2 MB).
 */
export type BerkasJenis =
  | 'kartu_keluarga'
  | 'ijazah_skl'
  | 'akta_kelahiran'
  | 'kartu_kip'
  | 'pas_foto'
  | 'piagam';

export const BERKAS_BUCKET = 'dokumen-ppdb';

export const BERKAS_LIMITS = {
  /** Foto mentah dari HP (sebelum dikompres) */
  MAX_IMAGE_INPUT_BYTES: 15 * 1024 * 1024,
  /** PDF tidak bisa dikompres di browser → batasi ketat. Ubah ke 2 * 1024 * 1024 jika perlu. */
  MAX_PDF_BYTES: 1 * 1024 * 1024,
  /** Batas keras bucket Supabase (sinkron dengan SQL) */
  BUCKET_MAX_BYTES: 2 * 1024 * 1024,
} as const;

const DOC = { maxEdge: 1600, targetBytes: 400 * 1024 }; // teks dokumen tetap terbaca

export const COMPRESS_PRESET: Record<BerkasJenis, { maxEdge: number; targetBytes: number }> = {
  pas_foto: { maxEdge: 600, targetBytes: 150 * 1024 },
  kartu_keluarga: DOC,
  ijazah_skl: DOC,
  akta_kelahiran: DOC,
  kartu_kip: DOC,
  piagam: DOC,
};

export const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'] as const;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Beberapa browser Android mengosongkan file.type → tebak dari ekstensi */
export function guessMime(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return '';
}

/** Mengembalikan pesan error (string) atau null jika file boleh diproses */
export function validateBerkasFile(file: File): string | null {
  const mime = guessMime(file);
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(mime)) {
    return 'Tipe file tidak didukung. Format yang diperbolehkan: PDF, JPG, JPEG, PNG, WEBP.';
  }
  if (mime === 'application/pdf') {
    if (file.size > BERKAS_LIMITS.MAX_PDF_BYTES) {
      return `Ukuran PDF maksimal ${formatBytes(BERKAS_LIMITS.MAX_PDF_BYTES)}. Jika lebih besar, foto/scan dokumen lalu unggah sebagai gambar (otomatis dikecilkan).`;
    }
  } else if (file.size > BERKAS_LIMITS.MAX_IMAGE_INPUT_BYTES) {
    return `Ukuran foto maksimal ${formatBytes(BERKAS_LIMITS.MAX_IMAGE_INPUT_BYTES)}.`;
  }
  return null;
}
