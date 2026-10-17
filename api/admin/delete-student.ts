import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function: POST /api/admin/delete-student
export default async function handler(req: any, res: any) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '';
  const requestOrigin = req.headers?.origin || '';

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  res.setHeader('Content-Type', 'application/json');

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
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return res.status(401).json({ success: false, message: 'Autentikasi diperlukan. Token tidak ditemukan.' });
    }

    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token);
    if (callerErr || !callerData?.user) {
      return res.status(401).json({ success: false, message: 'Token sesi kedaluwarsa atau tidak valid.' });
    }

    // 2. Pastikan role admin dari tabel public.profiles
    const { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
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
        return res.status(400).json({ success: false, message: 'Invalid JSON body.' });
      }
    }

    const targetUserId = body?.user_id;
    const targetNik = body?.nik;

    let userIdToDelete = targetUserId;

    // Jika user_id belum diberikan tetapi ada NIK, cari user_id dari tabel students atau profiles
    if (!userIdToDelete && targetNik) {
      const { data: std } = await supabaseAdmin
        .from('students')
        .select('user_id')
        .eq('nik', targetNik)
        .maybeSingle();

      if (std?.user_id) {
        userIdToDelete = std.user_id;
      } else {
        const { data: prof } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('nik', targetNik)
          .maybeSingle();
        if (prof?.id) {
          userIdToDelete = prof.id;
        }
      }
    }

    if (!userIdToDelete) {
      return res.status(400).json({ success: false, message: 'user_id atau NIK calon siswa wajib dicantumkan.' });
    }

    // 3. Hapus berkas storage dokumen-ppdb/<user_id>/
    try {
      const { data: fileList } = await supabaseAdmin.storage
        .from('dokumen-ppdb')
        .list(userIdToDelete);

      if (fileList && fileList.length > 0) {
        const pathsToDelete = fileList.map((f) => `${userIdToDelete}/${f.name}`);
        await supabaseAdmin.storage.from('dokumen-ppdb').remove(pathsToDelete);
      }
    } catch (storageErr) {
      console.warn('[Admin Delete] Warning saat menghapus folder berkas storage:', storageErr);
    }

    // 4. Hapus user auth via auth.admin.deleteUser (cascade ke students dan profiles)
    const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);
    if (delAuthErr) {
      console.error('[Admin Delete] Error deleteUser:', delAuthErr);
      // Fallback: hapus baris students secara manual jika user auth sudah tidak ada
      if (targetNik) {
        await supabaseAdmin.from('students').delete().eq('nik', targetNik);
      }
      return res.status(500).json({
        success: false,
        message: `Gagal menghapus user auth: ${delAuthErr.message}`,
      });
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
