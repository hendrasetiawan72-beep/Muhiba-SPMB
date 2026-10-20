import { createClient } from '@supabase/supabase-js';

// Vercel / Cloudflare Worker / Express: POST /api/admin/delete-student
export default async function handler(req: any, res: any) {
  const allowedOrigin = (process.env.ALLOWED_ORIGIN || '').trim();
  const requestOrigin = (req.headers?.origin || '').trim();

  if (allowedOrigin && requestOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (allowedOrigin && !requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
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

    const targetNik = typeof body?.nik === 'string' ? body.nik.trim() : '';
    const targetStudentId = typeof body?.student_id === 'string' ? body.student_id.trim() : '';
    const targetUserIdRaw = typeof body?.user_id === 'string' ? body.user_id.trim() : '';

    // Resolusi data siswa berdasarkan NIK atau student_id terlebih dahulu
    let targetStudent: any = null;
    if (targetNik) {
      const { data: stdByNik } = await supabaseAdmin
        .from('students')
        .select('id, user_id, nik, nama_lengkap, nomor_pendaftaran')
        .eq('nik', targetNik)
        .maybeSingle();
      targetStudent = stdByNik;
    } else if (targetStudentId) {
      const { data: stdById } = await supabaseAdmin
        .from('students')
        .select('id, user_id, nik, nama_lengkap, nomor_pendaftaran')
        .eq('id', targetStudentId)
        .maybeSingle();
      targetStudent = stdById;
    } else if (targetUserIdRaw) {
      const { data: stdByUid } = await supabaseAdmin
        .from('students')
        .select('id, user_id, nik, nama_lengkap, nomor_pendaftaran')
        .eq('user_id', targetUserIdRaw)
        .maybeSingle();
      targetStudent = stdByUid;
    }

    const userIdToDelete = targetStudent?.user_id || targetUserIdRaw;

    if (!userIdToDelete) {
      return res.status(400).json({
        success: false,
        message: 'Identitas siswa (NIK atau student_id) wajib disertakan.',
      });
    }

    // Cegah admin menghapus akunnya sendiri
    if (userIdToDelete === callerData.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat menghapus akun sendiri.',
      });
    }

    // 3. KEAMANAN KRUSIAL: Verifikasi bahwa target memiliki role 'student' di tabel profiles
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

    // 4. Hapus berkas storage dokumen-ppdb/<userIdToDelete>/
    try {
      const { data: fileList } = await supabaseAdmin.storage
        .from('dokumen-ppdb')
        .list(userIdToDelete);

      if (fileList && fileList.length > 0) {
        const pathsToDelete = fileList.map((f) => `${userIdToDelete}/${f.name}`);
        await supabaseAdmin.storage.from('dokumen-ppdb').remove(pathsToDelete);
      }
    } catch (storageErr) {
      console.warn('[Admin Delete] Warning saat menghapus dokumen-ppdb storage:', storageErr);
    }

    // 5. Bersihkan berkas warisan di berkas-spmb jika ada
    const cleanNik = targetStudent?.nik || targetProfile.nik || targetNik;
    if (cleanNik) {
      try {
        const { data: legacyFiles } = await supabaseAdmin.storage
          .from('berkas-spmb')
          .list(cleanNik);

        if (legacyFiles && legacyFiles.length > 0) {
          const paths = legacyFiles.map((f) => `${cleanNik}/${f.name}`);
          await supabaseAdmin.storage.from('berkas-spmb').remove(paths);
        }
      } catch (storageErr) {
        console.warn('[Admin Delete] Warning saat membersihkan berkas-spmb:', storageErr);
      }
    }

    // 6. Hapus relasi pembayaran dan data students
    await supabaseAdmin.from('pembayaran').delete().eq('user_id', userIdToDelete);
    if (cleanNik) {
      await supabaseAdmin.from('students').delete().eq('nik', cleanNik);
    } else {
      await supabaseAdmin.from('students').delete().eq('user_id', userIdToDelete);
    }

    // 7. Hapus user auth via auth.admin.deleteUser
    const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);
    if (delAuthErr) {
      console.error('[Admin Delete] Error deleteUser:', delAuthErr);
      return res.status(500).json({
        success: false,
        message: `Gagal menghapus user auth: ${delAuthErr.message}`,
      });
    }

    // 8. Catat audit trail ke tabel activity_logs
    try {
      await supabaseAdmin.from('activity_logs').insert({
        actor_id: callerData.user.id,
        actor_name: callerProfile.full_name || 'Administrator',
        action: 'HAPUS_PENDAFTAR',
        target_student_id: targetStudent?.id || null,
        target_nik: cleanNik || null,
        target_nama: targetStudent?.nama_lengkap || targetProfile.full_name || null,
        target_nomor: targetStudent?.nomor_pendaftaran || null,
        detail: {
          user_id: userIdToDelete,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logEx) {
      console.warn('[Admin Delete] Log audit notice:', logEx);
    }

    return res.status(200).json({
      success: true,
      message: 'Data pendaftar, berkas dokumen, dan akun autentikasi berhasil dihapus secara bersih.',
    });
  } catch (err: any) {
    console.error('[Admin Delete] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Terjadi kesalahan sistem saat menghapus pendaftar.',
    });
  }
}
