import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function: POST /api/auth/register
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
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    '';

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({
      success: false,
      error: 'Konfigurasi server belum lengkap: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi di Environment Variables Vercel.',
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
        return res.status(400).json({ success: false, error: 'Request body bukan JSON yang valid.' });
      }
    }

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

    if (!/^\d{16}$/.test(cleanNik)) {
      return res.status(400).json({ success: false, error: 'NIK harus terdiri dari 16 digit angka sesuai KTP / Kartu Keluarga.' });
    }
    if (!cleanNama) {
      return res.status(400).json({ success: false, error: 'Nama lengkap wajib diisi.' });
    }
    if (!['TO', 'TJKT', 'AKL'].includes(cleanJurusan)) {
      return res.status(400).json({ success: false, error: 'Pilihan kompetensi keahlian / jurusan tidak valid.' });
    }
    if (cleanPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password minimal 6 karakter demi keamanan akun Anda.' });
    }

    // 1. Cek duplikasi NIK di public.students
    const { data: existingStudent } = await supabaseAdmin
      .from('students')
      .select('nik')
      .eq('nik', cleanNik)
      .maybeSingle();

    if (existingStudent) {
      return res.status(409).json({
        success: false,
        error: `NIK ${cleanNik} sudah terdaftar di sistem SPMB SMK Muhammadiyah 1 Baturetno. Silakan langsung login.`,
      });
    }

    // 2. Buat user Supabase Auth via Admin API (email_confirm: true bypass MX validator)
    const internalEmail = `nik_${cleanNik}@auth.smkmuhiba.sch.id`;
    const { data: authCreated, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: cleanPassword,
      email_confirm: true,
      user_metadata: {
        nik: cleanNik,
        full_name: cleanNama,
        role: 'student',
      },
    });

    if (createAuthErr || !authCreated?.user) {
      if (createAuthErr?.message?.includes('already been registered') || createAuthErr?.message?.includes('exists')) {
        return res.status(409).json({
          success: false,
          error: `Akun Auth untuk NIK ${cleanNik} sudah terdaftar. Silakan login dengan password Anda.`,
        });
      }
      return res.status(500).json({
        success: false,
        error: `Gagal membuat akun autentikasi: ${createAuthErr?.message || 'Unknown auth error'}`,
      });
    }

    const userId = authCreated.user.id;

    // 3. Nomor pendaftaran urut
    const { count } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true });
    const nextSeq = (count || 0) + 1;
    const nomorPendaftaran = (2026470 + nextSeq).toString();

    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 4. Atomic database insertion: profiles & students
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

      // 5. Sign in to obtain authenticated session tokens
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
      // ATOMIC ROLLBACK: Delete auth user if database insert fails
      console.error('[API /auth/register] DB insert failed, rolling back auth user:', dbErr);
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (delErr) {
        console.error('[API /auth/register] Failed to rollback auth user:', delErr);
      }
      return res.status(500).json({
        success: false,
        error: `Gagal menyimpan data pendaftaran ke database: ${dbErr?.message || 'Database error'}. Akun telah di-rollback, silakan coba kembali.`,
      });
    }
  } catch (err: any) {
    console.error('[API /auth/register] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Terjadi kesalahan internal server pada proses registrasi.',
    });
  }
}
