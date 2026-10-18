import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// CORS Configuration: hanya exact origin yang dikonfigurasi.
// Jangan pernah merefleksikan Origin arbitrer dengan credentials.
app.use((req: Request, res: Response, next) => {
  const allowedOrigin = (process.env.ALLOWED_ORIGIN || '').trim();
  const requestOrigin = String(req.headers?.origin || '').trim();

  if (requestOrigin && (!allowedOrigin || requestOrigin !== allowedOrigin)) {
    if (req.method === 'OPTIONS') {
      return res.status(403).end();
    }
    return res.status(403).json({
      code: 'CORS_FORBIDDEN',
      message: 'Origin tidak diizinkan.',
    });
  }

  if (allowedOrigin && requestOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Server-side Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  '';

// Supabase clients:
// 1. supabaseAdmin (with service_role) for secure user provisioning & admin operations (NEVER exposed to frontend)
const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey)
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// 2. supabaseAnon (public anon key) for standard auth operations
const supabaseAnon = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Helper to convert NIK to internal auth identifier
 */
function getInternalAuthEmail(nik: string): string {
  const clean = nik.replace(/\D/g, '');
  return `nik_${clean}@auth.smkmuhiba.sch.id`;
}

/**
 * Endpoint: POST /api/auth/register
 * Secure student registration via Supabase Admin API with atomic rollback.
 */
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin || !supabaseAnon) {
      console.error('[API /auth/register] Supabase server credentials not configured.');
      return res.status(500).json({
        code: 'SERVER_ERROR',
        message: 'Layanan pendaftaran sedang tidak dapat diakses (konfigurasi server belum lengkap).',
      });
    }

    // 1. Verifikasi Cloudflare Turnstile
    const turnstileSecret = (process.env.TURNSTILE_SECRET_KEY || '').trim();
    const turnstileToken = req.body?.turnstileToken || req.body?.token || req.body?.turnstile_token;
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    if (!turnstileSecret) {
      console.error('[Turnstile] TURNSTILE_SECRET_KEY belum dikonfigurasi; menolak pendaftaran.');
      return res.status(503).json({
        code: 'SERVER_MISCONFIGURED',
        message: 'Layanan pendaftaran sementara tidak tersedia.',
      });
    }

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

    // 2. Rate limiting dengan RPC registration_allowed(p_ip_hash text)
    const salt = (process.env.RATE_LIMIT_SALT || '').trim();
    if (!salt) {
      console.error('[RateLimit] RATE_LIMIT_SALT belum dikonfigurasi; menolak pendaftaran.');
      return res.status(503).json({
        code: 'SERVER_MISCONFIGURED',
        message: 'Layanan pendaftaran sementara tidak tersedia.',
      });
    }
    const ipHash = crypto.createHash('sha256').update(clientIp + salt).digest('hex');

    try {
      const { data: isAllowed, error: rateLimitErr } = await supabaseAdmin.rpc('registration_allowed', {
        p_ip_hash: ipHash,
      });

      if (rateLimitErr) {
        console.error('[RateLimit] RPC registration_allowed gagal:', rateLimitErr);
        return res.status(503).json({
          code: 'RATE_LIMIT_UNAVAILABLE',
          message: 'Layanan pendaftaran sementara tidak tersedia.',
        });
      }
      if (isAllowed === false) {
        return res.status(429).json({
          code: 'RATE_LIMITED',
          message: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
        });
      }
    } catch (rlEx) {
      console.error('[RateLimit] Gagal menjalankan RPC registration_allowed:', rlEx);
      return res.status(503).json({
        code: 'RATE_LIMIT_UNAVAILABLE',
        message: 'Layanan pendaftaran sementara tidak tersedia.',
      });
    }

    const rawNik = req.body?.nik ?? '';
    const rawNama = req.body?.nama ?? req.body?.nama_lengkap ?? '';
    const rawJurusan = req.body?.jurusan ?? req.body?.jurusan_pilihan ?? '';
    const rawWa = req.body?.whatsapp ?? req.body?.no_wa ?? '';
    const rawPassword = req.body?.password ?? '';

    const cleanNik = String(rawNik || '').trim().replace(/\D/g, '');
    const cleanNama = String(rawNama || '').trim();
    const cleanJurusan = String(rawJurusan || '').trim().toUpperCase();
    const cleanNoWa = String(rawWa || '').trim();
    const cleanPassword = String(rawPassword || '').trim();

    // 3. Validasi NIK di server: 16 digit, bukan 16 digit sama, kode provinsi sah, tanggal & bulan sah
    if (!/^\d{16}$/.test(cleanNik) || /^(\d)\1{15}$/.test(cleanNik)) {
      return res.status(400).json({ code: 'NIK_INVALID', message: 'NIK tidak valid' });
    }

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
      return res.status(400).json({ code: 'SERVER_ERROR', message: 'Pilihan jurusan tidak valid.' });
    }

    const cleanWaDigits = cleanNoWa.replace(/[-\s]/g, '');
    if (!cleanWaDigits || !/^(\+?62|0)8[1-9][0-9]{7,12}$/.test(cleanWaDigits)) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Nomor WhatsApp tidak valid. Format: 08xxxxxxxxxx atau 628xxxxxxxxxx (10-15 digit).',
      });
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

    // 5. Buat user auth via auth.admin.createUser (user_metadata HANYA nik dan full_name)
    const internalEmail = getInternalAuthEmail(cleanNik);
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
      console.error('[API /auth/register] Create user error:', createAuthErr);
      if (createAuthErr?.message?.includes('already been registered') || createAuthErr?.message?.includes('exists')) {
        return res.status(409).json({
          code: 'NIK_EXISTS',
          message: `Akun untuk NIK ${cleanNik} sudah ada di database. Silakan langsung login dengan kata sandi Anda.`,
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
    const currentYear = new Date().getFullYear().toString();
    try {
      const { data: rpcNo, error: rpcErr } = await supabaseAdmin.rpc('next_nomor_pendaftaran');
      if (!rpcErr && rpcNo) {
        nomorPendaftaran = String(rpcNo);
      } else {
        const { count } = await supabaseAdmin
          .from('students')
          .select('*', { count: 'exact', head: true });
        const seq = (count || 0) + 1;
        const seqStr = String(seq).length < 4 ? String(seq).padStart(4, '0') : String(seq);
        const randSalt = Math.floor(100 + Math.random() * 900);
        nomorPendaftaran = `${currentYear}${seqStr}${randSalt}`;
      }
    } catch {
      const randSalt = Math.floor(100 + Math.random() * 900);
      nomorPendaftaran = `${currentYear}${Date.now().toString().slice(-4)}${randSalt}`;
    }

    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 7. Atomic database insertion: profiles & students
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
            full_name: cleanNama,
            role: 'student',
            created_at: now.toISOString(),
          },
          student: insertedStudent,
          session: null,
        });
      }

      return res.status(201).json({
        success: true,
        session: sessionData.session,
        user: {
          id: userId,
          nik: cleanNik,
          full_name: cleanNama,
          role: 'student',
          created_at: now.toISOString(),
        },
        student: insertedStudent,
      });
    } catch (insertError: any) {
      // ROLLBACK: Cleanup orphan auth user if database insertion fails
      console.error('[API /auth/register] DB insert failed, rolling back auth user:', insertError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({
        code: 'SERVER_ERROR',
        message: 'Gagal menyimpan data pendaftaran ke database. Akun telah dibatalkan, silakan coba kembali.',
      });
    }
  } catch (err: any) {
    console.error('Register API error:', err);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Terjadi kesalahan sistem pada proses pendaftaran.',
    });
  }
});

/**
 * Endpoint: POST /api/auth/login
 * Handles both student (NIK + Password) and admin (username/email + Password).
 */
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;
    const cleanIdentifier = String(identifier || '').trim();
    const cleanPassword = String(password || '').trim();

    if (!cleanIdentifier || !cleanPassword) {
      return res.status(400).json({ error: 'Username / NIK dan password wajib diisi.' });
    }

    if (!supabaseAnon) {
      return res.status(500).json({
        error: 'Koneksi Supabase belum terkonfigurasi di server. Periksa file .env.',
      });
    }

    const lower = cleanIdentifier.toLowerCase();
    const isNik = /^\d{10,16}$/.test(cleanIdentifier);
    const isAdmin =
      lower === 'admin' ||
      lower.includes('admin') ||
      cleanIdentifier.includes('@smkmuhiba.sch.id') ||
      cleanIdentifier.includes('@guru.smk.belajar.id');

    let authEmail: string;

    if (isNik) {
      authEmail = getInternalAuthEmail(cleanIdentifier);
    } else if (isAdmin) {
      authEmail = cleanIdentifier.includes('@') ? cleanIdentifier : 'admin@smkmuhiba.sch.id';
    } else {
      authEmail = cleanIdentifier.includes('@') ? cleanIdentifier : getInternalAuthEmail(cleanIdentifier);
    }

    // 1. Authenticate with Supabase Auth
    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: authEmail,
      password: cleanPassword,
    });

    if (signInError || !signInData?.user) {
      return res.status(401).json({
        error: isNik
          ? 'NIK atau kata sandi salah. Pastikan 16 digit NIK dan kata sandi sudah sesuai.'
          : 'Username atau kata sandi administrator salah.',
      });
    }

    const authUser = signInData.user;

    // 2. Fetch role from public.profiles table (DATABASE IS SOURCE OF TRUTH)
    const client = supabaseAdmin || supabaseAnon;
    const { data: profile, error: profileErr } = await client
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileErr) {
      console.warn('Error fetching profile:', profileErr);
    }

    if (isAdmin && profile && profile.role !== 'admin') {
      return res.status(403).json({
        error: 'Akses ditolak: Akun ini tidak memiliki hak akses administrator di database.',
      });
    }

    const userRole = profile?.role || (isAdmin ? 'admin' : 'student');

    let studentData = null;
    if (userRole === 'student') {
      const { data: std } = await client
        .from('students')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      studentData = std;
    }

    const appUser = {
      id: authUser.id,
      nik: profile?.nik || (isNik ? cleanIdentifier : authUser.user_metadata?.nik || ''),
      role: userRole,
      full_name: profile?.full_name || authUser.user_metadata?.full_name || (userRole === 'admin' ? 'Administrator' : 'Siswa'),
      email: authUser.email,
      created_at: authUser.created_at,
    };

    return res.json({
      success: true,
      session: signInData.session,
      user: appUser,
      student: studentData,
    });
  } catch (err: any) {
    console.error('Login API error:', err);
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan pada server saat login.' });
  }
});

/**
 * Endpoint: POST /api/admin/delete-student
 * Securely deletes a student, their storage files in dokumen-ppdb, and their auth account
 */
app.post('/api/admin/delete-student', async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, message: 'Server Supabase credentials tidak tersedia.' });
    }

    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ success: false, message: 'Autentikasi admin diperlukan.' });
    }

    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token);
    if (callerErr || !callerData?.user) {
      return res.status(401).json({ success: false, message: 'Token sesi admin tidak valid.' });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', callerData.user.id)
      .maybeSingle();

    if (callerProfile?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya admin yang diizinkan.' });
    }

    const targetUserId = req.body?.user_id;
    const targetNik = req.body?.nik;

    let userIdToDelete = targetUserId;
    if (!userIdToDelete && targetNik) {
      const { data: std } = await supabaseAdmin
        .from('students')
        .select('user_id')
        .eq('nik', targetNik)
        .maybeSingle();
      if (std?.user_id) userIdToDelete = std.user_id;
    }

    if (!userIdToDelete) {
      return res.status(400).json({ success: false, message: 'user_id atau NIK calon siswa wajib dicantumkan.' });
    }

    // Hapus storage folder dokumen-ppdb/<user_id>/
    try {
      const { data: fileList } = await supabaseAdmin.storage
        .from('dokumen-ppdb')
        .list(userIdToDelete);

      if (fileList && fileList.length > 0) {
        const pathsToDelete = fileList.map((f) => `${userIdToDelete}/${f.name}`);
        await supabaseAdmin.storage.from('dokumen-ppdb').remove(pathsToDelete);
      }
    } catch (storageErr) {
      console.warn('[Admin Delete] Warning saat membersihkan dokumen-ppdb storage:', storageErr);
    }

    // Hapus akun dari auth.admin.deleteUser (cascade ke students dan profiles)
    const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);
    if (delAuthErr) {
      if (targetNik) {
        await supabaseAdmin.from('students').delete().eq('nik', targetNik);
      }
      return res.status(500).json({ success: false, message: `Gagal menghapus user auth: ${delAuthErr.message}` });
    }

    return res.json({
      success: true,
      message: 'Data pendaftar dan akun berhasil dihapus secara permanen.',
    });
  } catch (err: any) {
    console.error('Delete student error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Gagal menghapus data siswa.' });
  }
});

/**
 * Endpoint: POST /api/admin/reset-password
 * Resets user password to a secure temporary password by an administrator
 */
app.post('/api/admin/reset-password', async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, message: 'Server Supabase credentials tidak tersedia.' });
    }

    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ success: false, message: 'Autentikasi admin diperlukan.' });
    }

    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token);
    if (callerErr || !callerData?.user) {
      return res.status(401).json({ success: false, message: 'Token sesi admin tidak valid.' });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', callerData.user.id)
      .maybeSingle();

    if (callerProfile?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya admin yang diizinkan.' });
    }

    const targetUserId = req.body?.user_id;
    const targetNik = req.body?.nik;

    let userId = targetUserId;
    if (!userId && targetNik) {
      const { data: std } = await supabaseAdmin
        .from('students')
        .select('user_id')
        .eq('nik', targetNik)
        .maybeSingle();
      if (std?.user_id) userId = std.user_id;
    }

    if (!userId) {
      return res.status(400).json({ success: false, message: 'user_id atau NIK siswa target wajib dicantumkan.' });
    }

    // Generate password sementara minimal 10 karakter
    const randomHex = crypto.randomBytes(6).toString('hex');
    const tempPassword = `Mhb@${randomHex}`;

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (updateErr) {
      return res.status(500).json({ success: false, message: `Gagal mereset kata sandi: ${updateErr.message}` });
    }

    return res.json({
      success: true,
      temporaryPassword: tempPassword,
      message: 'Kata sandi berhasil direset oleh administrator.',
    });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Gagal mereset kata sandi.' });
  }
});

// Explicit JSON 404 handler for unmatched /api/* requests (never return HTML for API calls)
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Endpoint API ${req.method} ${req.path} tidak ditemukan pada server.`,
  });
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SPMB Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
