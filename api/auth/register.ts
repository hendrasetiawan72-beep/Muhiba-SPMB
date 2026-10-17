import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Vercel Serverless Function: POST /api/auth/register
export default async function handler(req: any, res: any) {
  // CORS setup - Batasi origin ke ALLOWED_ORIGIN atau request origin, hindari wildcard dengan credentials
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
    return res.status(405).json({
      code: 'SERVER_ERROR',
      message: `Metode ${req.method} tidak diizinkan. Gunakan POST.`,
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    '';

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[API /auth/register] Konfigurasi server belum lengkap: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak ditemukan.');
    return res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Layanan pendaftaran sedang tidak dapat diakses (konfigurasi server belum lengkap).',
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey);

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ code: 'SERVER_ERROR', message: 'Request body bukan JSON yang valid.' });
      }
    }

    // 1. Verifikasi token Cloudflare Turnstile
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    const turnstileToken = body?.turnstileToken || body?.token || body?.turnstile_token;
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    if (turnstileSecret) {
      if (!turnstileToken) {
        return res.status(403).json({
          code: 'CAPTCHA_FAILED',
          message: 'Verifikasi keamanan Turnstile wajib diisi.',
        });
      }

      try {
        const verifyFormData = new URLSearchParams();
        verifyFormData.append('secret', turnstileSecret);
        verifyFormData.append('response', String(turnstileToken));
        if (clientIp) {
          verifyFormData.append('remoteip', clientIp);
        }

        const turnstileResp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: verifyFormData,
        });
        const turnstileOutcome = await turnstileResp.json();

        if (!turnstileOutcome.success) {
          console.warn('[Turnstile] Verifikasi gagal:', turnstileOutcome['error-codes']);
          return res.status(403).json({
            code: 'CAPTCHA_FAILED',
            message: 'Verifikasi keamanan Cloudflare Turnstile gagal. Silakan muat ulang halaman dan coba lagi.',
          });
        }
      } catch (cfErr) {
        console.error('[Turnstile] Error saat menghubungi Cloudflare siteverify:', cfErr);
        return res.status(403).json({
          code: 'CAPTCHA_FAILED',
          message: 'Gagal memverifikasi keamanan Turnstile. Silakan coba kembali.',
        });
      }
    }

    // 2. Rate limiting dengan RPC registration_allowed(p_ip_hash text)
    const salt = process.env.RATE_LIMIT_SALT || 'spmb_default_rate_limit_salt';
    const ipHash = crypto.createHash('sha256').update(clientIp + salt).digest('hex');

    try {
      const { data: isAllowed, error: rateLimitErr } = await supabaseAdmin.rpc('registration_allowed', {
        p_ip_hash: ipHash,
      });

      if (!rateLimitErr && isAllowed === false) {
        return res.status(429).json({
          code: 'RATE_LIMITED',
          message: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
        });
      }
    } catch (rlEx) {
      console.warn('[RateLimit] Gagal menjalankan RPC registration_allowed:', rlEx);
    }

    // Ekstraksi & sanitasi input pendaftaran
    const rawNik = body?.nik ?? '';
    const rawNama = body?.nama ?? body?.nama_lengkap ?? '';
    const rawJurusan = body?.jurusan ?? body?.jurusan_pilihan ?? '';
    const rawWa = body?.whatsapp ?? body?.no_wa ?? '';
    const rawPassword = body?.password ?? '';

    const cleanNik = String(rawNik || '').trim().replace(/\D/g, '');
    const cleanNama = String(rawNama || '').trim();
    const cleanJurusan = String(rawJurusan || '').trim().toUpperCase();
    const cleanNoWa = String(rawWa || '').trim();
    const cleanPassword = String(rawPassword || '').trim();

    // 3. Validasi NIK di server: tepat 16 digit angka, bukan 16 digit sama, kode provinsi sah, tanggal & bulan valid
    if (!/^\d{16}$/.test(cleanNik)) {
      return res.status(400).json({ code: 'NIK_INVALID', message: 'NIK tidak valid' });
    }

    // Tolak jika 16 digit berupa angka yang sama persis (misal 0000000000000000 atau 1111111111111111)
    if (/^(\d)\1{15}$/.test(cleanNik)) {
      return res.status(400).json({ code: 'NIK_INVALID', message: 'NIK tidak valid' });
    }

    // Validasi kode provinsi Indonesia (2 digit pertama)
    const validProvinceCodes = new Set([
      '11', '12', '13', '14', '15', '16', '17', '18', '19', '21',
      '31', '32', '33', '34', '35', '36',
      '51', '52', '53',
      '61', '62', '63', '64', '65',
      '71', '72', '73', '74', '75', '76',
      '81', '82',
      '91', '92', '93', '94', '95', '96',
    ]);
    const provCode = cleanNik.slice(0, 2);
    if (!validProvinceCodes.has(provCode)) {
      return res.status(400).json({ code: 'NIK_INVALID', message: 'NIK tidak valid' });
    }

    // Validasi tanggal dan bulan lahir pada NIK
    // Digit 7-8: Tanggal (01-31 untuk laki-laki, 41-71 untuk perempuan)
    // Digit 9-10: Bulan (01-12)
    const tglInt = parseInt(cleanNik.slice(6, 8), 10);
    const blnInt = parseInt(cleanNik.slice(8, 10), 10);

    if (blnInt < 1 || blnInt > 12) {
      return res.status(400).json({ code: 'NIK_INVALID', message: 'NIK tidak valid' });
    }
    const isTglValid = (tglInt >= 1 && tglInt <= 31) || (tglInt >= 41 && tglInt <= 71);
    if (!isTglValid) {
      return res.status(400).json({ code: 'NIK_INVALID', message: 'NIK tidak valid' });
    }

    if (!cleanNama) {
      return res.status(400).json({ code: 'SERVER_ERROR', message: 'Nama lengkap wajib diisi.' });
    }
    if (!['TO', 'TJKT', 'AKL'].includes(cleanJurusan)) {
      return res.status(400).json({ code: 'SERVER_ERROR', message: 'Pilihan kompetensi keahlian / jurusan tidak valid.' });
    }

    // 4. Validasi Kata Sandi: minimal 8 karakter dan tolak kata sandi umum
    const lowerPass = cleanPassword.toLowerCase();
    const commonPasswords = [
      '12345678',
      '123456789',
      '1234567890',
      'password',
      'admin123',
      'qwertyui',
      'indonesia',
      'smkmuhiba',
    ];

    const isPasswordCommon =
      commonPasswords.includes(lowerPass) ||
      cleanPassword === cleanNik ||
      lowerPass.startsWith('muhiba@') ||
      (cleanNama && lowerPass === cleanNama.toLowerCase());

    if (cleanPassword.length < 8 || isPasswordCommon) {
      return res.status(400).json({
        code: 'WEAK_PASSWORD',
        message: 'Kata sandi minimal 8 karakter dan tidak boleh menggunakan kata sandi umum atau NIK.',
      });
    }

    // Cek duplikasi NIK di tabel students
    const { data: existingStudent, error: checkExistErr } = await supabaseAdmin
      .from('students')
      .select('nik')
      .eq('nik', cleanNik)
      .maybeSingle();

    if (checkExistErr) {
      console.error('[API /auth/register] Error memeriksa duplikasi NIK:', checkExistErr);
    }

    if (existingStudent) {
      return res.status(409).json({
        code: 'NIK_EXISTS',
        message: `NIK ${cleanNik} sudah terdaftar di sistem SPMB SMK Muhammadiyah Bawang. Silakan langsung login.`,
      });
    }

    // 5. Buat user dengan auth.admin.createUser (user_metadata HANYA nik dan full_name; JANGAN kirim role)
    const internalEmail = `nik_${cleanNik}@auth.smkmuhiba.sch.id`;
    const { data: authCreated, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: cleanPassword,
      email_confirm: true,
      user_metadata: {
        nik: cleanNik,
        full_name: cleanNama,
      },
    });

    if (createAuthErr || !authCreated?.user) {
      console.error('[API /auth/register] Supabase auth.admin.createUser error:', createAuthErr);
      if (createAuthErr?.message?.includes('already been registered') || createAuthErr?.message?.includes('exists')) {
        return res.status(409).json({
          code: 'NIK_EXISTS',
          message: `Akun untuk NIK ${cleanNik} sudah terdaftar. Silakan login dengan kata sandi Anda.`,
        });
      }
      return res.status(500).json({
        code: 'SERVER_ERROR',
        message: 'Gagal membuat akun autentikasi. Silakan coba beberapa saat lagi.',
      });
    }

    const userId = authCreated.user.id;

    // 6. Nomor pendaftaran dari RPC next_nomor_pendaftaran()
    let nomorPendaftaran = '';
    try {
      const { data: rpcNo, error: rpcErr } = await supabaseAdmin.rpc('next_nomor_pendaftaran');
      if (!rpcErr && rpcNo) {
        nomorPendaftaran = String(rpcNo);
      } else {
        console.warn('[API /auth/register] RPC next_nomor_pendaftaran belum tersedia / error:', rpcErr);
        // Fallback jika migrasi RPC belum selesai dijalankan
        const randSalt = Math.floor(10 + Math.random() * 90);
        nomorPendaftaran = `2026${Date.now().toString().slice(-4)}${randSalt}`;
      }
    } catch (rpcEx) {
      console.warn('[API /auth/register] RPC call exception:', rpcEx);
      const randSalt = Math.floor(10 + Math.random() * 90);
      nomorPendaftaran = `2026${Date.now().toString().slice(-4)}${randSalt}`;
    }

    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 7. Insert baris public.profiles dan public.students dari server (service role) dengan atomic rollback
    try {
      // Upsert profile
      const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
        id: userId,
        nik: cleanNik,
        full_name: cleanNama,
        role: 'student',
      });
      if (profileErr) throw profileErr;

      // Insert student record
      const studentPayload = {
        user_id: userId,
        nik: cleanNik,
        nama_lengkap: cleanNama,
        jurusan_pilihan: cleanJurusan,
        no_wa: cleanNoWa,
        status_pendaftaran: 'Berkas Fisik',
        nomor_pendaftaran: nomorPendaftaran,
        tanggal_daftar: dateFormatted,
        data_diri: {
          nik: cleanNik,
          nama_lengkap: cleanNama,
          no_hp: cleanNoWa,
        },
        data_alamat: {},
        data_orang_tua: {},
        data_berkas: {},
      };

      const { data: insertedStudent, error: studentErr } = await supabaseAdmin
        .from('students')
        .insert(studentPayload)
        .select()
        .single();

      if (studentErr) throw studentErr;

      // Sign in untuk mendapatkan session token resmi
      const { data: sessionData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
        email: internalEmail,
        password: cleanPassword,
      });

      if (signInErr || !sessionData?.session) {
        return res.status(201).json({
          success: true,
          user: {
            id: userId,
            nik: cleanNik,
            role: 'student',
            full_name: cleanNama,
            email: internalEmail,
          },
          student: insertedStudent,
        });
      }

      return res.status(201).json({
        success: true,
        session: sessionData.session,
        user: {
          id: userId,
          nik: cleanNik,
          role: 'student',
          full_name: cleanNama,
          email: internalEmail,
        },
        student: insertedStudent,
      });
    } catch (dbErr: any) {
      // ROLLBACK ATOMIK: Hapus auth user jika proses simpan data gagal
      console.error('[API /auth/register] DB insert failed, rolling back auth user:', dbErr);
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (delErr) {
        console.error('[API /auth/register] Failed to rollback auth user:', delErr);
      }
      return res.status(500).json({
        code: 'SERVER_ERROR',
        message: 'Gagal menyimpan data pendaftaran ke database. Akun telah dibatalkan, silakan coba kembali.',
      });
    }
  } catch (err: any) {
    console.error('[API /auth/register] Unexpected server error:', err);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Terjadi kesalahan sistem pada proses pendaftaran.',
    });
  }
}
