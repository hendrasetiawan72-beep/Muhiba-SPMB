import { createClient } from '@supabase/supabase-js';
import { applyCors } from '../../server/corsHelper';

/**
 * M-01: Membersihkan seluruh berkas di folder storage secara rekursif.
 * Query selalu dilakukan dari offset: 0 karena berkas yang telah dihapus
 * menyebabkan pergeseran indeks daftar file. Loop berhenti saat kosong.
 */
async function removeStorageFolderRecursive(
  supabaseAdmin: any,
  bucket: string,
  folder: string
): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = [];
  let deleted = 0;
  const limit = 100;
  const attemptedPaths = new Set<string>();

  while (true) {
    const { data: items, error: listErr } = await supabaseAdmin.storage
      .from(bucket)
      .list(folder, { limit, offset: 0, sortBy: { column: 'name', order: 'asc' } });

    if (listErr) {
      errors.push(`Gagal membaca isi bucket ${bucket}/${folder}: ${listErr.message}`);
      break;
    }

    if (!items || items.length === 0) {
      break;
    }

    const filesToDelete: string[] = [];
    let newItemsFound = false;

    for (const item of items) {
      const fullPath = `${folder}/${item.name}`;
      if (attemptedPaths.has(fullPath)) {
        continue;
      }
      attemptedPaths.add(fullPath);
      newItemsFound = true;

      if (!item.id) {
        // Subfolder: telusuri secara rekursif
        const subResult = await removeStorageFolderRecursive(
          supabaseAdmin,
          bucket,
          fullPath
        );
        deleted += subResult.deleted;
        errors.push(...subResult.errors);
      } else {
        filesToDelete.push(fullPath);
      }
    }

    if (filesToDelete.length > 0) {
      const { data: removed, error: remErr } = await supabaseAdmin.storage
        .from(bucket)
        .remove(filesToDelete);

      if (remErr) {
        errors.push(`Gagal menghapus berkas di ${bucket}/${folder}: ${remErr.message}`);
      } else {
        deleted += removed?.length || filesToDelete.length;
      }
    }

    // Jika tidak ada item baru dalam batch ini, hentikan untuk mencegah infinite loop
    if (!newItemsFound) {
      break;
    }
  }

  return { deleted, errors };
}

// Vercel / Cloudflare Worker / Express: POST /api/admin/delete-student
export default async function handler(req: any, res: any) {
  // M-05: Gunakan shared CORS helper terpusat
  if (!applyCors(req, res)) {
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metode tidak diizinkan.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ success: false, message: 'Konfigurasi server belum lengkap.' });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Verifikasi token pemanggil
    const authHeader = req.headers?.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return res.status(401).json({ success: false, message: 'Autentikasi diperlukan. Token tidak ditemukan.' });
    }

    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token);
    if (callerErr || !callerData?.user) {
      return res.status(401).json({ success: false, message: 'Token sesi kedaluwarsa atau tidak valid.' });
    }

    // 2. Pastikan pemanggil memiliki role 'admin' di database
    const { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', callerData.user.id)
      .maybeSingle();

    if (profileErr || callerProfile?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya administrator yang diizinkan.' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ success: false, message: 'Format data permintaan tidak valid.' });
      }
    }

    // M-02: Wajib mencantumkan NIK atau student_id. Tidak lagi menerima user_id bebas tanpa record siswa.
    const targetNik = typeof body?.nik === 'string' ? body.nik.trim() : '';
    const targetStudentId = typeof body?.student_id === 'string' ? body.student_id.trim() : '';

    if (!targetNik && !targetStudentId) {
      return res.status(400).json({
        success: false,
        message: 'Identitas pendaftar (NIK atau student_id) wajib disertakan.',
      });
    }

    let targetStudent: any = null;
    if (targetNik) {
      const { data: stdByNik } = await supabaseAdmin
        .from('students')
        .select('id, user_id, nik, nama_lengkap, nomor_pendaftaran')
        .eq('nik', targetNik)
        .maybeSingle();
      targetStudent = stdByNik;
    } else {
      const { data: stdById } = await supabaseAdmin
        .from('students')
        .select('id, user_id, nik, nama_lengkap, nomor_pendaftaran')
        .eq('id', targetStudentId)
        .maybeSingle();
      targetStudent = stdById;
    }

    if (!targetStudent?.user_id || !targetStudent?.id) {
      return res.status(404).json({
        success: false,
        message: 'Data siswa tidak ditemukan di sistem.',
      });
    }

    const userIdToDelete = targetStudent.user_id;

    // Cegah admin menghapus akunnya sendiri
    if (userIdToDelete === callerData.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat menghapus akun sendiri.',
      });
    }

    // 3. Verifikasi bahwa target memiliki role 'student' di tabel profiles
    const { data: targetProfile, error: targetProfErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, nik, full_name')
      .eq('id', userIdToDelete)
      .maybeSingle();

    if (targetProfErr || !targetProfile || targetProfile.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Hanya akun siswa yang dapat dihapus.',
      });
    }

    // 4. M-03: Eksekusi transaksi database atomik via delete_student_cascade
    const { error: cascadeErr } = await supabaseAdmin.rpc('delete_student_cascade', {
      p_student_id: targetStudent.id,
      p_user_id: userIdToDelete,
    });

    if (cascadeErr) {
      console.error('[Admin Delete] Error delete_student_cascade:', cascadeErr);
      return res.status(500).json({
        success: false,
        message: `Gagal menghapus data siswa dari database: ${cascadeErr.message}`,
      });
    }

    // 5. M-01: Bersihkan berkas storage (dokumen-ppdb & berkas-spmb) secara rekursif dari offset: 0
    const storageErrors: string[] = [];
    const ppdbCleanup = await removeStorageFolderRecursive(supabaseAdmin, 'dokumen-ppdb', userIdToDelete);
    storageErrors.push(...ppdbCleanup.errors);

    if (targetStudent.nik) {
      const legacyCleanup = await removeStorageFolderRecursive(supabaseAdmin, 'berkas-spmb', targetStudent.nik);
      storageErrors.push(...legacyCleanup.errors);
    }

    // 6. Hapus akun auth via auth.admin.deleteUser
    const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);
    if (delAuthErr) {
      console.error('[Admin Delete] Error deleteUser:', delAuthErr);
      return res.status(500).json({
        success: false,
        message: `Data database berhasil dihapus, namun akun autentikasi gagal dihapus: ${delAuthErr.message}`,
      });
    }

    // 7. Catat audit trail ke tabel activity_logs
    try {
      await supabaseAdmin.from('activity_logs').insert({
        actor_id: callerData.user.id,
        actor_name: callerProfile.full_name || 'Administrator',
        action: 'HAPUS_PENDAFTAR',
        target_student_id: targetStudent.id,
        target_nik: targetStudent.nik,
        target_nama: targetStudent.nama_lengkap,
        target_nomor: targetStudent.nomor_pendaftaran,
        detail: {
          user_id: userIdToDelete,
          storage_files_deleted: ppdbCleanup.deleted,
          storage_errors: storageErrors,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logEx) {
      console.warn('[Admin Delete] Log audit notice:', logEx);
    }

    const message =
      storageErrors.length === 0
        ? 'Data pendaftar, berkas dokumen, dan akun autentikasi berhasil dihapus secara bersih.'
        : 'Data pendaftar dan akun berhasil dihapus, namun beberapa berkas storage memerlukan pembersihan manual.';

    return res.status(200).json({
      success: true,
      storageCleaned: storageErrors.length === 0,
      storageErrors: storageErrors.length > 0 ? storageErrors : undefined,
      message,
    });
  } catch (err: any) {
    console.error('[Admin Delete] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Terjadi kesalahan sistem saat menghapus pendaftar.',
    });
  }
}
