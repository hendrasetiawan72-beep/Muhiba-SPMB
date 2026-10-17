/**
 * ============================================================================
 * SPMB SMK MUHAMMADIYAH BAWANG - STORAGE MIGRATION UTILITY
 * Script: scripts/migrate-storage.ts
 *
 * Description:
 * Migrates student documents from legacy public bucket 'berkas-spmb/{nik}/*'
 * to hardened private bucket 'dokumen-ppdb/{user_id}/*'.
 * Updates 'path' in student data_berkas JSON without deleting the source files.
 *
 * Usage (Manual Execution on Local Environment ONLY):
 *   npx tsx scripts/migrate-storage.ts
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diatur di file .env.');
  console.error('Script ini membutuhkan service_role key untuk membaca dan menyalin storage.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runStorageMigration() {
  console.log('===============================================================');
  console.log('🚀 Memulai Migrasi Storage: berkas-spmb -> dokumen-ppdb');
  console.log(`📡 URL Target: ${supabaseUrl}`);
  console.log('===============================================================\n');

  // 1. Ambil seluruh data pendaftar dari public.students
  const { data: students, error: studentErr } = await supabase
    .from('students')
    .select('id, user_id, nik, nama_lengkap, data_berkas');

  if (studentErr || !students) {
    console.error('❌ Gagal memuat data siswa:', studentErr?.message);
    process.exit(1);
  }

  console.log(`📋 Total pendaftar ditemukan: ${students.length}\n`);

  let successCount = 0;
  let fileCopiedCount = 0;
  let skippedCount = 0;

  for (const student of students) {
    const { nik, user_id, nama_lengkap, data_berkas } = student;

    if (!user_id || !nik) {
      console.warn(`⚠️ [Lewati] Siswa ${nama_lengkap} tidak memiliki user_id atau NIK valid.`);
      skippedCount++;
      continue;
    }

    // 2. Cek apakah ada file di folder lama berkas-spmb/{nik}
    const { data: legacyFiles, error: listErr } = await supabase.storage
      .from('berkas-spmb')
      .list(nik);

    if (listErr || !legacyFiles || legacyFiles.length === 0) {
      // Tidak ada file di storage lama untuk NIK ini
      skippedCount++;
      continue;
    }

    console.log(`📁 Memproses ${nama_lengkap} (NIK: ${nik}, UserID: ${user_id}) - ${legacyFiles.length} berkas...`);

    let studentFilesMigrated = 0;
    const updatedBerkas = { ...(data_berkas || {}) };

    for (const file of legacyFiles) {
      if (!file.name) continue;

      const sourcePath = `${nik}/${file.name}`;
      const targetPath = `${user_id}/${file.name}`;

      try {
        // Download dari berkas-spmb
        const { data: blob, error: dlErr } = await supabase.storage
          .from('berkas-spmb')
          .download(sourcePath);

        if (dlErr || !blob) {
          console.error(`   ❌ Gagal mendownload ${sourcePath}:`, dlErr?.message);
          continue;
        }

        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload ke dokumen-ppdb (private)
        const { error: upErr } = await supabase.storage
          .from('dokumen-ppdb')
          .upload(targetPath, buffer, {
            contentType: blob.type || 'application/octet-stream',
            upsert: true,
          });

        if (upErr) {
          console.error(`   ❌ Gagal mengunggah ke ${targetPath}:`, upErr.message);
          continue;
        }

        console.log(`   ✅ Tersalin: ${sourcePath} -> ${targetPath}`);
        studentFilesMigrated++;
        fileCopiedCount++;

        // Cocokkan ke jenis berkas di JSON data_berkas
        const lowerName = file.name.toLowerCase();
        let matchedKey: string | null = null;

        if (lowerName.includes('kartu_keluarga') || lowerName.includes('kk')) {
          matchedKey = 'kartu_keluarga';
        } else if (lowerName.includes('ijazah') || lowerName.includes('skl')) {
          matchedKey = 'ijazah_skl';
        } else if (lowerName.includes('akta') || lowerName.includes('lahir')) {
          matchedKey = 'akta_kelahiran';
        } else if (lowerName.includes('kip') || lowerName.includes('pkh')) {
          matchedKey = 'kartu_kip';
        } else if (lowerName.includes('foto') || lowerName.includes('pas_foto')) {
          matchedKey = 'pas_foto';
        }

        if (matchedKey && updatedBerkas[matchedKey]) {
          const { url, ...cleanItem } = updatedBerkas[matchedKey];
          updatedBerkas[matchedKey] = {
            ...cleanItem,
            path: targetPath,
            nama_file: file.name,
          };
        }
      } catch (copyErr: any) {
        console.error(`   ❌ Error saat memproses file ${file.name}:`, copyErr.message);
      }
    }

    // 3. Update data_berkas di public.students
    if (studentFilesMigrated > 0) {
      const { error: updateErr } = await supabase
        .from('students')
        .update({ data_berkas: updatedBerkas })
        .eq('id', student.id);

      if (updateErr) {
        console.error(`   ❌ Gagal memperbarui data_berkas siswa di database:`, updateErr.message);
      } else {
        console.log(`   💾 Database diperbarui untuk NIK: ${nik}`);
        successCount++;
      }
    }
    console.log('');
  }

  console.log('===============================================================');
  console.log('✨ MIGRASI STORAGE SELESAI');
  console.log(`📊 Siswa berhasil dimigrasi: ${successCount}`);
  console.log(`📦 Total file berhasil disalin: ${fileCopiedCount}`);
  console.log(`⏩ Siswa dilewati / tanpa berkas lama: ${skippedCount}`);
  console.log('===============================================================');
  console.log('⚠️ PERHATIAN PENTING:');
  console.log('Objek sumber pada bucket "berkas-spmb" TIDAK dihapus oleh script ini.');
  console.log('Pastikan seluruh dokumen telah diverifikasi di dashboard admin');
  console.log('sebelum menghapus objek lama secara manual.');
  console.log('===============================================================\n');
}

runStorageMigration().catch((err) => {
  console.error('Fatal error saat menjalankan migrasi storage:', err);
  process.exit(1);
});
