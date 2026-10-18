import type { SupabaseClient } from '@supabase/supabase-js';
import { compressImage } from '../Utils/compressImage';
import {
  BERKAS_BUCKET,
  BERKAS_LIMITS,
  COMPRESS_PRESET,
  BerkasJenis,
  formatBytes,
  guessMime,
  validateBerkasFile,
} from '../Utils/uploadConfig';

export interface UploadBerkasResult {
  nama_file: string;
  path: string;
  url: string; // signed URL sementara (1 jam) untuk preview langsung; jangan disimpan permanen
  ukuran: string;
}

const ALL_EXT = ['pdf', 'jpg', 'png', 'webp'];

function extFor(mime: string): string {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Upload berkas dengan:
 *  1. validasi (tipe & ukuran) dari satu konfigurasi
 *  2. kompresi otomatis untuk gambar (preset per jenis berkas)
 *  3. path TETAP `{userId}/{jenis}.{ext}` + upsert → mengganti berkas MENIMPA, tidak menambah file
 *  4. pembersihan varian lama (mis. dulu PDF, sekarang foto) dan path lama
 *
 * Membutuhkan policy storage INSERT + UPDATE + DELETE untuk folder sendiri
 * (lihat migrasi 20261018000000_...sql).
 */
export async function uploadBerkasFile(
  supabase: SupabaseClient,
  userId: string,
  jenis: BerkasJenis,
  file: File,
  oldPath?: string
): Promise<UploadBerkasResult> {
  const validationError = validateBerkasFile(file);
  if (validationError) throw new Error(validationError);

  const mime = guessMime(file);
  let finalFile: File = file;

  if (mime !== 'application/pdf') {
    const typed = file.type ? file : new File([file], file.name, { type: mime });
    finalFile = await compressImage(typed, COMPRESS_PRESET[jenis]);
  }

  if (finalFile.size > BERKAS_LIMITS.BUCKET_MAX_BYTES) {
    throw new Error(
      `Ukuran berkas masih ${formatBytes(finalFile.size)} (maksimal ${formatBytes(
        BERKAS_LIMITS.BUCKET_MAX_BYTES
      )}). Gunakan foto dengan resolusi lebih rendah.`
    );
  }

  const ext = extFor(finalFile.type || mime);
  const path = `${userId}/${jenis}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BERKAS_BUCKET)
    .upload(path, finalFile, {
      upsert: true,
      contentType: finalFile.type || mime,
      cacheControl: '3600',
    });

  if (uploadError) {
    throw new Error(`Gagal mengunggah berkas: ${uploadError.message}`);
  }

  // Bersihkan varian lain & path lama (hanya di folder milik user ini)
  const stale = new Set<string>(
    ALL_EXT.map((e) => `${userId}/${jenis}.${e}`).filter((p) => p !== path)
  );
  if (oldPath && oldPath !== path && oldPath.startsWith(`${userId}/`)) stale.add(oldPath);

  if (stale.size > 0) {
    const { error: removeError } = await supabase.storage
      .from(BERKAS_BUCKET)
      .remove(Array.from(stale));
    if (removeError) console.warn('[uploadBerkas] Gagal membersihkan berkas lama:', removeError.message);
  }

  const { data: signed } = await supabase.storage
    .from(BERKAS_BUCKET)
    .createSignedUrl(path, 3600);

  return {
    nama_file: finalFile.name || `${jenis}.${ext}`,
    path,
    url: signed?.signedUrl ?? '',
    ukuran: formatBytes(finalFile.size),
  };
}

/** Signed URL singkat untuk membuka berkas (dipakai saat klik "lihat", jangan disimpan ke DB) */
export async function getBerkasSignedUrl(
  supabase: SupabaseClient,
  path: string,
  expiresInSeconds = 300
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BERKAS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}
