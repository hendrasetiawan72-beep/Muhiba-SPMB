import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function: POST /api/auth/login
export default async function handler(req: any, res: any) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: `Method ${req.method} not allowed. Gunakan POST.` });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl) {
    return res.status(500).json({
      success: false,
      error: 'Konfigurasi Supabase URL belum diatur di server.',
    });
  }

  const clientKey = supabaseAnonKey || supabaseServiceKey;
  const supabase = createClient(supabaseUrl, clientKey);

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ success: false, error: 'Request body bukan JSON valid.' });
      }
    }

    const { identifier, password } = body || {};
    const cleanId = String(identifier || '').trim();
    const cleanPass = String(password || '').trim();

    if (!cleanId || !cleanPass) {
      return res.status(400).json({ success: false, error: 'Username / NIK dan password wajib diisi.' });
    }

    let authEmail = cleanId;
    const isNik = /^\d{16}$/.test(cleanId);
    const isAdmin = cleanId.toLowerCase() === 'admin';

    if (isNik) {
      authEmail = `nik_${cleanId}@auth.smkmuhiba.sch.id`;
    } else if (isAdmin) {
      authEmail = 'admin@smkmuhiba.sch.id';
    }

    // Authenticate with Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: cleanPass,
    });

    if (authErr || !authData?.user) {
      return res.status(401).json({
        success: false,
        error: isNik
          ? 'NIK atau password yang Anda masukkan salah. Pastikan 16 digit NIK dan password sesuai saat pendaftaran.'
          : 'Username atau password admin salah.',
      });
    }

    const authUser = authData.user;

    // Verify role directly from public.profiles table in database
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileErr) {
      console.warn('[API /auth/login] Warning fetching profile:', profileErr);
    }

    const verifiedRole = profileData?.role === 'admin' ? 'admin' : 'student';

    if (isAdmin && verifiedRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Akses ditolak: Akun ini tidak memiliki hak akses administrator di database.',
      });
    }

    const userObj = {
      id: authUser.id,
      nik: profileData?.nik || authUser.user_metadata?.nik || (isNik ? cleanId : ''),
      role: verifiedRole,
      full_name: profileData?.full_name || authUser.user_metadata?.full_name || (isAdmin ? 'Administrator' : 'Siswa'),
      email: authUser.email || authEmail,
      created_at: authUser.created_at,
    };

    let studentData: any = undefined;
    if (verifiedRole === 'student') {
      const { data: stdRecord } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();
      if (stdRecord) {
        studentData = stdRecord;
      }
    }

    return res.status(200).json({
      success: true,
      session: authData.session,
      user: userObj,
      student: studentData,
    });
  } catch (err: any) {
    console.error('[API /auth/login] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Terjadi kesalahan pada proses login.',
    });
  }
}
