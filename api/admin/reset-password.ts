import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Vercel / Cloudflare Worker: POST /api/admin/reset-password
//
// Reset password oleh panitia dengan pengaman berlapis:
//   1. Hanya admin (JWT + role dari tabel profiles).
//   2. Akun admin tidak bisa direset lewat endpoint ini.
//   3. Verifikasi identitas pemohon: nomor pendaftaran + nomor WA harus cocok
//      (tanggal lahir opsional, dicocokkan bila ada datanya).
//   4. Pembatasan frekuensi: per pendaftar dan per admin (dihitung dari activity_logs).
//   5. Password sementara acak, penanda must_change_password, sesi lama dicabut.
//   6. Setiap percobaan (berhasil / gagal) dicatat di activity_logs.

const MAX_RESET_PER_TARGET_24H = 3; // maksimal reset berhasil per pendaftar per 24 jam
const MAX_ATTEMPTS_PER_ADMIN_1H = 20; // maksimal percobaan (berhasil + gagal) per admin per jam

const normAlnum = (v: unknown): string =>
  String(v ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();

const normPhone = (v: unknown): string => {
  let d = String(v ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('62')) d = '0' + d.slice(2);
  else if (!d.startsWith('0')) d = '0' + d;
  return d;
};

// Terima YYYY-MM-DD, DD-MM-YYYY, atau DD/MM/YYYY -> YYYY-MM-DD (null bila tidak valid)
const normDate = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
};

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
  res.setHeader('Cache-Control', 'no-store'); // respons berisi password sementara

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
    const callerId = callerData.user.id;

    // 2. Pastikan role admin dari tabel profiles
    const { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name')
      .eq('id', callerId)
      .maybeSingle();

    if (profileErr || callerProfile?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya administrator yang diizinkan.' });
    }
    const callerName = callerProfile?.full_name || 'Administrator';

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid JSON body.' });
      }
    }

    const targetUserId = typeof body?.user_id === 'string' ? body.user_id.trim() : '';
    const targetNik = typeof body?.nik === 'string' ? body.nik.trim() : '';
    const verifikasi = body?.verifikasi && typeof body.verifikasi === 'object' ? body.verifikasi : {};

    if (!targetUserId && !targetNik) {
      return res.status(400).json({ success: false, message: 'user_id atau NIK siswa target wajib dicantumkan.' });
    }

    // 3. Cari data pendaftar target
    let studentQuery = supabaseAdmin
      .from('students')
      .select('id, user_id, nik, nama_lengkap, nomor_pendaftaran, no_wa, data_diri');
    studentQuery = targetUserId ? studentQuery.eq('user_id', targetUserId) : studentQuery.eq('nik', targetNik);
    const { data: student, error: studentErr } = await studentQuery.maybeSingle();

    if (studentErr || !student?.user_id) {
      return res.status(404).json({ success: false, message: 'Data pendaftar tidak ditemukan.' });
    }
    const userId: string = student.user_id;

    // 4. Akun admin (atau akun sendiri) tidak boleh direset lewat fitur ini
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (targetProfile?.role === 'admin' || userId === callerId) {
      return res.status(403).json({
        success: false,
        message: 'Akun administrator tidak dapat direset lewat fitur ini.',
      });
    }

    // 5. Pembatasan frekuensi (dihitung dari activity_logs)
    const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: adminAttempts, error: adminCountErr } = await supabaseAdmin
      .from('activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('actor_id', callerId)
      .in('action', ['RESET_PASSWORD', 'RESET_PASSWORD_GAGAL'])
      .gte('created_at', since1h);

    if (adminCountErr) {
      console.error('[Admin Reset Password] activity_logs tidak siap:', adminCountErr.message);
      return res.status(500).json({
        success: false,
        message: 'Log aktivitas belum siap. Jalankan SQL migrasi pemulihan password di Supabase terlebih dahulu.',
      });
    }

    const { count: targetResets, error: targetCountErr } = await supabaseAdmin
      .from('activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'RESET_PASSWORD')
      .eq('target_student_id', student.id)
      .gte('created_at', since24h);

    if (targetCountErr) {
      console.error('[Admin Reset Password] Gagal membaca log:', targetCountErr.message);
      return res.status(500).json({ success: false, message: 'Gagal memeriksa batas reset. Coba lagi.' });
    }

    if ((adminAttempts ?? 0) >= MAX_ATTEMPTS_PER_ADMIN_1H) {
      return res.status(429).json({
        success: false,
        message: 'Terlalu banyak percobaan reset dari akun Anda. Coba lagi dalam 1 jam.',
      });
    }
    if ((targetResets ?? 0) >= MAX_RESET_PER_TARGET_24H) {
      return res.status(429).json({
        success: false,
        message: `Pendaftar ini sudah direset ${MAX_RESET_PER_TARGET_24H} kali dalam 24 jam terakhir. Coba lagi besok atau hubungi pengelola sistem.`,
      });
    }

    // 6. Verifikasi identitas pemohon (jawaban diketik admin, dicocokkan dengan data tercatat)
    const nomorInput = normAlnum(verifikasi.nomor_pendaftaran);
    const okNomor = nomorInput !== '' && nomorInput === normAlnum(student.nomor_pendaftaran);

    const waInput = normPhone(verifikasi.no_wa);
    const okWa = waInput !== '' && waInput === normPhone(student.no_wa);

    const dobProvided = String(verifikasi.tanggal_lahir ?? '').trim() !== '';
    const dobOnFile = normDate((student.data_diri as any)?.tanggal_lahir);
    const okDob = !dobProvided || !dobOnFile ? true : normDate(verifikasi.tanggal_lahir) === dobOnFile;
    const dobStatus = !dobProvided ? 'tidak diisi' : !dobOnFile ? 'belum tercatat' : 'cocok';

    const logBase = {
      actor_id: callerId,
      actor_name: callerName,
      target_student_id: student.id,
      target_nik: student.nik,
      target_nama: student.nama_lengkap,
      target_nomor: student.nomor_pendaftaran,
    };

    if (!(okNomor && okWa && okDob)) {
      // Catat kegagalan tanpa merinci kolom mana yang salah
      const { error: failLogErr } = await supabaseAdmin.from('activity_logs').insert({
        ...logBase,
        action: 'RESET_PASSWORD_GAGAL',
        detail: { alasan: 'verifikasi_tidak_cocok' },
      });
      if (failLogErr) console.error('[Admin Reset Password] Gagal mencatat log gagal:', failLogErr.message);

      return res.status(403).json({
        success: false,
        message: 'Data verifikasi tidak cocok. Pastikan jawaban pemohon sesuai data pendaftaran.',
      });
    }

    // 7. Tandai wajib ganti password (gagal di sini = migrasi belum dijalankan, belum ada yang berubah)
    const { error: flagErr } = await supabaseAdmin
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', userId);

    if (flagErr) {
      console.error('[Admin Reset Password] Gagal menandai must_change_password:', flagErr.message);
      return res.status(500).json({
        success: false,
        message: 'Kolom must_change_password belum ada. Jalankan SQL migrasi pemulihan password di Supabase.',
      });
    }

    // 8. Password sementara acak (Mhb@ + 12 karakter heksadesimal)
    const tempPassword = `Mhb@${crypto.randomBytes(6).toString('hex')}`;

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (updateErr) {
      console.error('[Admin Reset Password] Error updateUserById:', updateErr);
      return res.status(500).json({
        success: false,
        message: `Gagal memperbarui kata sandi user: ${updateErr.message}`,
      });
    }

    // 9. Cabut semua sesi lama (token lama tidak bisa diperpanjang). Gagal = hanya peringatan.
    let sessionsRevoked = false;
    try {
      const { error: revokeErr } = await supabaseAdmin.rpc('revoke_user_sessions', { p_user_id: userId });
      if (revokeErr) {
        console.error('[Admin Reset Password] Gagal mencabut sesi:', revokeErr.message);
      } else {
        sessionsRevoked = true;
      }
    } catch (e: any) {
      console.error('[Admin Reset Password] Gagal mencabut sesi:', e?.message);
    }

    // 10. Catat keberhasilan (password TIDAK ikut dicatat)
    const { error: logErr } = await supabaseAdmin.from('activity_logs').insert({
      ...logBase,
      action: 'RESET_PASSWORD',
      detail: {
        metode: 'reset_panitia',
        verifikasi: { nomor_pendaftaran: 'cocok', no_wa: 'cocok', tanggal_lahir: dobStatus },
        sesi_dicabut: sessionsRevoked,
      },
    });
    if (logErr) console.error('[Admin Reset Password] Gagal mencatat log:', logErr.message);

    return res.status(200).json({
      success: true,
      temporaryPassword: tempPassword,
      nama_lengkap: student.nama_lengkap,
      nomor_pendaftaran: student.nomor_pendaftaran,
      no_wa: student.no_wa,
      sessionsRevoked,
      logged: !logErr,
      message: 'Kata sandi berhasil direset oleh administrator.',
    });
  } catch (err: any) {
    console.error('[Admin Reset Password] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat mereset kata sandi.',
    });
  }
}
