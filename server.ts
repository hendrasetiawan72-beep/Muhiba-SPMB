import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

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
 * Health check & configuration status endpoint
 */
app.get('/api/auth/status', (_req: Request, res: Response) => {
  res.json({
    supabaseUrlConfigured: Boolean(supabaseUrl),
    serviceRoleConfigured: Boolean(supabaseServiceRoleKey),
    anonKeyConfigured: Boolean(supabaseAnonKey),
    serverMode: 'fullstack-express-vite',
  });
});

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
 * Uses service_role to create auth user with email_confirm: true,
 * completely bypassing external SMTP / MX validation issues.
 */
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { nik, nama_lengkap, jurusan_pilihan, no_wa, password } = req.body;

    // 1. Validation
    const cleanNik = String(nik || '').trim().replace(/\D/g, '');
    const cleanNama = String(nama_lengkap || '').trim();
    const cleanNoWa = String(no_wa || '').trim();
    const cleanPassword = String(password || '').trim();

    if (!/^\d{16}$/.test(cleanNik)) {
      return res.status(400).json({ error: 'NIK harus terdiri dari 16 digit angka sesuai KTP / Kartu Keluarga.' });
    }
    if (!cleanNama) {
      return res.status(400).json({ error: 'Nama lengkap wajib diisi.' });
    }
    if (!['TO', 'TJKT', 'AKL'].includes(jurusan_pilihan)) {
      return res.status(400).json({ error: 'Pilihan jurusan tidak valid.' });
    }
    if (cleanPassword.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter demi keamanan akun.' });
    }

    if (!supabaseAdmin || !supabaseAnon) {
      return res.status(500).json({
        error:
          'Supabase belum terkonfigurasi di server. Pastikan SUPABASE_URL, SUPABASE_ANON_KEY, dan SUPABASE_SERVICE_ROLE_KEY telah diatur di file .env server.',
      });
    }

    // 2. Check duplicate NIK in public.students
    const { data: existingStudent } = await supabaseAdmin
      .from('students')
      .select('nik')
      .eq('nik', cleanNik)
      .maybeSingle();

    if (existingStudent) {
      return res.status(409).json({
        error: `NIK ${cleanNik} sudah terdaftar di sistem SPMB. Silakan login atau hubungi panitia.`,
      });
    }

    // 3. Provision User in Supabase Auth via Admin API
    const internalEmail = getInternalAuthEmail(cleanNik);

    const { data: authCreated, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: cleanPassword,
      email_confirm: true, // Automatically confirmed; no external SMTP/MX lookup required
      user_metadata: {
        nik: cleanNik,
        full_name: cleanNama,
        role: 'student',
      },
    });

    if (createAuthErr || !authCreated?.user) {
      // If user already exists in Auth, return helpful error
      if (createAuthErr?.message?.includes('already been registered') || createAuthErr?.message?.includes('exists')) {
        return res.status(409).json({
          error: `Akun Auth untuk NIK ${cleanNik} sudah ada di database. Silakan langsung login dengan password Anda.`,
        });
      }
      return res.status(500).json({
        error: `Gagal membuat akun autentikasi: ${createAuthErr?.message || 'Unknown auth error'}`,
      });
    }

    const userId = authCreated.user.id;

    // 4. Generate consecutive registration number
    const { count } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true });
    const nextSeq = (count || 0) + 1;
    const nomorPendaftaran = (2026470 + nextSeq).toString();

    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 5. Atomic database insertion: profiles & students
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
        jurusan_pilihan,
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

      // 6. Sign in to obtain official authenticated session tokens
      const { data: sessionData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
        email: internalEmail,
        password: cleanPassword,
      });

      if (signInErr || !sessionData?.session) {
        // Fallback: return user & student, client can sign in with NIK + Password
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
      console.error('Registration insertion failed, rolling back auth user:', insertError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({
        error: `Gagal menyimpan data pendaftaran ke database: ${insertError.message}`,
      });
    }
  } catch (err: any) {
    console.error('Register API error:', err);
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan pada server saat pendaftaran.' });
  }
});

/**
 * Endpoint: POST /api/auth/login
 * Handles both student (NIK + Password) and admin (username/email + Password).
 * Verifies credentials with Supabase Auth and validates roles from public.profiles table.
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
      // Clean user-facing error message
      return res.status(401).json({
        error: 'Login gagal: NIK / Username atau password salah.',
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

    // Verify role: If user logged in via admin panel / username, verify they actually have 'admin' role in database
    if (isAdmin && profile && profile.role !== 'admin') {
      return res.status(403).json({
        error: 'Akses ditolak: Akun ini tidak memiliki hak akses administrator di database.',
      });
    }

    const userRole = profile?.role || (isAdmin ? 'admin' : 'student');

    // 3. If student, fetch student record
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
