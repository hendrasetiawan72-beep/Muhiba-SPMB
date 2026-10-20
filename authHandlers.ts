import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type JsonRecord = Record<string, unknown>;

function getEnv(key: string, fallbackKey?: string): string {
  try {
    const env = typeof process !== 'undefined' ? process.env : undefined;
    const value = env?.[key] || (fallbackKey ? env?.[fallbackKey] : '');
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

export function getSupabaseClients(): {
  supabaseAdmin: SupabaseClient | null;
  supabaseAnon: SupabaseClient | null;
  supabaseUrl: string;
} {
  const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey =
    getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY') ||
    getEnv('VITE_SUPABASE_PUBLISHABLE_KEY');

  // Never use the service-role key as a fallback for the public/anon client.
  const supabaseAdmin =
    supabaseUrl && serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

  const supabaseAnon =
    supabaseUrl && anonKey
      ? createClient(supabaseUrl, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

  return { supabaseAdmin, supabaseAnon, supabaseUrl };
}

/** Formats date/time in Asia/Jakarta: dd-mm-yyyy hh:mm. */
export function formatTanggalDaftarJakarta(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || '00';

  return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}`;
}

export interface ApiResponse {
  statusCode: number;
  body: {
    success: boolean;
    code?: string;
    error?: string;
    message?: string;
    session?: unknown;
    user?: unknown;
    student?: unknown;
  };
}

const LOGIN_WINDOW_SECONDS = 600;
const LOGIN_LIMIT_PER_IP = 40;
const LOGIN_LIMIT_PER_ID = 10;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

type RateResult = 'ok' | 'limited' | 'unavailable';

async function rateLimitHit(
  admin: SupabaseClient | null,
  bucket: string,
  rawKey: string,
  limit: number,
  windowSeconds: number,
): Promise<RateResult> {
  if (!admin) return 'unavailable';

  const salt = getEnv('RATE_LIMIT_SALT');
  if (salt.length < 16) {
    console.error('[RateLimit] RATE_LIMIT_SALT belum diset atau kurang dari 16 karakter.');
    return 'unavailable';
  }

  try {
    const keyHash = await sha256Hex(`${bucket}:${rawKey}:${salt}`);
    const { data, error } = await admin.rpc('rate_limit_hit', {
      p_bucket: bucket,
      p_key_hash: keyHash,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error('[RateLimit] RPC error:', error.message);
      return 'unavailable';
    }

    // RPC is expected to return true when allowed and false when limited.
    if (data === false) return 'limited';
    if (data === true) return 'ok';

    console.error('[RateLimit] RPC returned an unexpected value.');
    return 'unavailable';
  } catch (error) {
    console.error('[RateLimit] Exception:', error);
    return 'unavailable';
  }
}

function rateLimitResponse(result: RateResult): ApiResponse | null {
  if (result === 'ok') return null;

  if (result === 'limited') {
    return {
      statusCode: 429,
      body: {
        success: false,
        code: 'RATE_LIMITED',
        error: 'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.',
      },
    };
  }

  return {
    statusCode: 503,
    body: {
      success: false,
      code: 'RATE_LIMIT_UNAVAILABLE',
      error: 'Layanan login sementara tidak tersedia. Silakan coba beberapa saat lagi.',
    },
  };
}

function response(
  statusCode: number,
  code: string,
  error: string,
): ApiResponse {
  return { statusCode, body: { success: false, code, error } };
}

/** Verifies Cloudflare Turnstile. Returns null if verification succeeds. */
async function checkTurnstile(
  token: unknown,
  clientIp: string,
): Promise<ApiResponse | null> {
  const secret = getEnv('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.error('[Turnstile] TURNSTILE_SECRET_KEY belum diset.');
    return response(
      500,
      'SERVER_MISCONFIGURED',
      'Konfigurasi keamanan server belum lengkap. Silakan hubungi panitia.',
    );
  }

  if (typeof token !== 'string' || !token.trim()) {
    return response(403, 'CAPTCHA_FAILED', 'Verifikasi keamanan Turnstile wajib diisi.');
  }

  try {
    const form = new URLSearchParams();
    form.set('secret', secret);
    form.set('response', token.trim());
    if (clientIp) form.set('remoteip', clientIp);

    const verificationResponse = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body: form },
    );

    if (!verificationResponse.ok) {
      console.error('[Turnstile] Siteverify HTTP status:', verificationResponse.status);
      return response(503, 'CAPTCHA_UNAVAILABLE', 'Layanan verifikasi sedang bermasalah. Coba lagi.');
    }

    const result = (await verificationResponse.json()) as {
      success?: boolean;
      ['error-codes']?: string[];
    };

    if (!result.success) {
      console.warn('[Turnstile] Verification failed:', result['error-codes']);
      return response(403, 'CAPTCHA_FAILED', 'Verifikasi keamanan gagal. Muat ulang halaman dan coba lagi.');
    }

    return null;
  } catch (error) {
    console.error('[Turnstile] Verification exception:', error);
    return response(503, 'CAPTCHA_UNAVAILABLE', 'Gagal memverifikasi keamanan. Silakan coba kembali.');
  }
}

function parseBody(body: unknown): { data: JsonRecord | null; error: boolean } {
  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body);
      return {
        data: parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as JsonRecord)
          : null,
        error: false,
      };
    } catch {
      return { data: null, error: true };
    }
  }

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return { data: body as JsonRecord, error: false };
  }

  return { data: null, error: false };
}

/**
 * Shared login handler.
 * Required env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 * RATE_LIMIT_SALT, and TURNSTILE_SECRET_KEY unless SUPABASE_CAPTCHA=true.
 */
export async function handleLogin(
  body: unknown,
  clientIpRaw = '',
): Promise<ApiResponse> {
  const { supabaseAdmin, supabaseAnon, supabaseUrl } = getSupabaseClients();

  if (!supabaseUrl || !supabaseAnon || !supabaseAdmin) {
    return response(
      500,
      'SERVER_MISCONFIGURED',
      'Konfigurasi server belum lengkap. Periksa URL, anon key, dan service-role key.',
    );
  }

  const parsed = parseBody(body);
  if (parsed.error) return response(400, 'BAD_REQUEST', 'Format data permintaan tidak valid.');
  const requestBody = parsed.data || {};

  const identifier = String(requestBody.identifier ?? '').trim();
  // Do not trim passwords: whitespace can be part of a legitimate password.
  const password = typeof requestBody.password === 'string' ? requestBody.password : '';

  if (!identifier || !password) {
    return response(400, 'MISSING_CREDENTIALS', 'Username / NIK dan password wajib diisi.');
  }
  if (password.length < 8) {
    return response(400, 'PASSWORD_TOO_SHORT', 'Password minimal 8 karakter.');
  }

  const clientIp = clientIpRaw.trim();
  const ipLimit = rateLimitResponse(
    await rateLimitHit(
      supabaseAdmin,
      'login:ip',
      clientIp || 'unknown',
      LOGIN_LIMIT_PER_IP,
      LOGIN_WINDOW_SECONDS,
    ),
  );
  if (ipLimit) return ipLimit;

  const turnstileToken =
    requestBody.turnstileToken ??
    requestBody.token ??
    requestBody.turnstile_token ??
    requestBody.captchaToken ??
    '';

  const supabaseCaptchaMode = getEnv('SUPABASE_CAPTCHA').toLowerCase() === 'true';
  if (supabaseCaptchaMode) {
    if (typeof turnstileToken !== 'string' || !turnstileToken.trim()) {
      return response(403, 'CAPTCHA_FAILED', 'Verifikasi keamanan Turnstile wajib diisi.');
    }
  } else {
    const captchaError = await checkTurnstile(turnstileToken, clientIp);
    if (captchaError) return captchaError;
  }

  const studentEmailDomain = '@auth.smkmuhiba.sch.id';
  const lowerId = identifier.toLowerCase();
  const adminLoginId = getEnv('ADMIN_LOGIN_ID').toLowerCase();
  const adminAuthEmail = (getEnv('ADMIN_AUTH_EMAIL') || 'admin@smkmuhiba.sch.id').toLowerCase();
  const isNik = /^\d{16}$/.test(identifier);
  const isAdminIdentifier =
    Boolean(adminLoginId) &&
    (lowerId === adminLoginId || lowerId === adminAuthEmail);

  let authEmail: string;
  if (isNik) {
    authEmail = `nik_${identifier}${studentEmailDomain}`;
  } else if (isAdminIdentifier) {
    authEmail = adminAuthEmail;
  } else {
    return response(
      400,
      'INVALID_IDENTIFIER',
      'NIK harus 16 digit angka, atau gunakan username admin yang diberikan panitia.',
    );
  }

  const idLimit = rateLimitResponse(
    await rateLimitHit(
      supabaseAdmin,
      'login:id',
      lowerId,
      LOGIN_LIMIT_PER_ID,
      LOGIN_WINDOW_SECONDS,
    ),
  );
  if (idLimit) return idLimit;

  try {
    const { data: authData, error: authError } =
      await supabaseAnon.auth.signInWithPassword({
        email: authEmail,
        password,
        ...(supabaseCaptchaMode
          ? { options: { captchaToken: String(turnstileToken) } }
          : {}),
      });

    if (authError || !authData.user || !authData.session) {
      if (authError && /captcha/i.test(authError.message)) {
        return response(
          403,
          'CAPTCHA_FAILED',
          'Verifikasi keamanan gagal atau kedaluwarsa. Selesaikan CAPTCHA lagi lalu coba kembali.',
        );
      }
      return response(
        401,
        'INVALID_CREDENTIALS',
        isNik
          ? 'NIK atau password yang Anda masukkan salah.'
          : 'Username atau password admin salah.',
      );
    }

    const authUser = authData.user;
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, nik, full_name, role, must_change_password')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileError) {
      console.error('[handleLogin] Profile query failed:', profileError.message);
      return response(500, 'PROFILE_LOOKUP_FAILED', 'Gagal memverifikasi profil akun.');
    }

    // Fail closed if the profile is missing; never infer an admin role from metadata.
    if (!profile) {
      return response(403, 'PROFILE_NOT_FOUND', 'Profil akun belum tersedia. Hubungi panitia.');
    }

    const role = profile.role === 'admin' ? 'admin' : 'student';
    if (isAdminIdentifier && role !== 'admin') {
      return response(403, 'FORBIDDEN', 'Akun ini tidak memiliki hak akses administrator.');
    }

    const user = {
      id: authUser.id,
      nik: profile.nik || (isNik ? identifier : ''),
      role,
      full_name: profile.full_name || (role === 'admin' ? 'Administrator' : 'Siswa'),
      email: authUser.email || authEmail,
      must_change_password: Boolean(profile.must_change_password),
      created_at: authUser.created_at,
    };

    let student: unknown;
    if (role === 'student') {
      const { data: studentRecord, error: studentError } = await supabaseAdmin
        .from('students')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (studentError) {
        console.error('[handleLogin] Student query failed:', studentError.message);
        return response(500, 'STUDENT_LOOKUP_FAILED', 'Gagal memuat data pendaftaran.');
      }
      if (!studentRecord) {
        return response(404, 'STUDENT_NOT_FOUND', 'Data pendaftaran tidak ditemukan. Hubungi panitia.');
      }
      student = studentRecord;
    }

    return {
      statusCode: 200,
      body: { success: true, session: authData.session, user, student },
    };
  } catch (error) {
    console.error('[handleLogin] Internal error:', error);
    return response(500, 'INTERNAL_SERVER_ERROR', 'Terjadi gangguan internal saat login. Silakan coba kembali.');
  }
}

/** Shared registration handler. Registration must only be called by the intended public API endpoint. */
export async function handleRegister(body: unknown): Promise<ApiResponse> {
  const { supabaseAdmin, supabaseAnon, supabaseUrl } = getSupabaseClients();

  if (!supabaseUrl || !supabaseAdmin || !supabaseAnon) {
    return response(
      500,
      'SERVER_MISCONFIGURED',
      'Konfigurasi server belum lengkap: periksa SUPABASE_URL, anon key, dan service-role key.',
    );
  }

  const parsed = parseBody(body);
  if (parsed.error) return response(400, 'BAD_REQUEST', 'Format data pendaftaran tidak valid.');
  const requestBody = parsed.data || {};

  const cleanNik = String(requestBody.nik ?? '').trim().replace(/\D/g, '');
  const cleanNama = String(requestBody.nama ?? requestBody.nama_lengkap ?? '').trim();
  const cleanJurusan = String(requestBody.jurusan ?? requestBody.jurusan_pilihan ?? '')
    .trim()
    .toUpperCase();
  const cleanNoWa = String(requestBody.whatsapp ?? requestBody.no_wa ?? '').trim();
  const cleanPassword = typeof requestBody.password === 'string' ? requestBody.password : '';

  if (!/^\d{16}$/.test(cleanNik)) {
    return response(400, 'INVALID_NIK', 'NIK harus terdiri dari 16 digit angka.');
  }
  if (!cleanNama || cleanNama.length > 150) {
    return response(400, 'INVALID_NAMA', 'Nama lengkap wajib diisi (maksimal 150 karakter).');
  }
  if (!['TO', 'TJKT', 'AKL'].includes(cleanJurusan)) {
    return response(400, 'INVALID_JURUSAN', 'Pilihan jurusan tidak valid.');
  }
  if (cleanNoWa.length > 30) {
    return response(400, 'INVALID_WHATSAPP', 'Nomor WhatsApp terlalu panjang.');
  }
  if (cleanPassword.length < 8 || cleanPassword.length > 128) {
    return response(400, 'PASSWORD_TOO_SHORT', 'Password harus terdiri dari 8–128 karakter.');
  }

  try {
    const { data: existingStudent, error: existingError } = await supabaseAdmin
      .from('students')
      .select('nik')
      .eq('nik', cleanNik)
      .maybeSingle();

    if (existingError) {
      console.error('[handleRegister] Duplicate check failed:', existingError.message);
      return response(500, 'DATABASE_LOOKUP_FAILED', 'Gagal memeriksa data pendaftaran.');
    }
    if (existingStudent) {
      return response(409, 'NIK_ALREADY_REGISTERED', 'NIK sudah terdaftar. Silakan login atau hubungi panitia.');
    }

    const internalEmail = `nik_${cleanNik}@auth.smkmuhiba.sch.id`;
    const { data: createdAuth, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email: internalEmail,
        password: cleanPassword,
        email_confirm: true,
        user_metadata: { nik: cleanNik, full_name: cleanNama },
      });

    if (createAuthError || !createdAuth.user) {
      const message = createAuthError?.message || '';
      if (/already been registered|already exists|duplicate/i.test(message)) {
        return response(409, 'AUTH_USER_EXISTS', 'Akun untuk NIK ini sudah ada. Silakan login atau hubungi panitia.');
      }
      console.error('[handleRegister] Auth creation failed:', message);
      return response(500, 'AUTH_PROVISION_FAILED', 'Gagal membuat akun autentikasi. Silakan hubungi panitia.');
    }

    const userId = createdAuth.user.id;
    const studentPayload: Record<string, unknown> = {
      user_id: userId,
      nik: cleanNik,
      nama_lengkap: cleanNama,
      jurusan_pilihan: cleanJurusan,
      no_wa: cleanNoWa,
      status_pendaftaran: 'Berkas Fisik',
      tanggal_daftar: formatTanggalDaftarJakarta(),
      data_diri: { nik: cleanNik, nama_lengkap: cleanNama, no_hp: cleanNoWa },
      data_alamat: {},
      data_orang_tua: {},
      data_berkas: {},
    };

    let insertedStudent: Record<string, unknown> | null = null;

    try {
      const { data, error } = await supabaseAdmin
        .from('students')
        .insert(studentPayload)
        .select()
        .single();

      if (!error && data) {
        insertedStudent = data as Record<string, unknown>;
      } else if (error && /nomor_pendaftaran/i.test(error.message)) {
        // Compatibility fallback for schemas where nomor_pendaftaran is required
        // and has no database default. Prefer a database sequence/trigger if available.
        const { count, error: countError } = await supabaseAdmin
          .from('students')
          .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        const currentYear = new Date().getFullYear();
        const seqStr = String((count || 0) + 1).padStart(4, '0');
        const randomSuffix = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900 + 100);
        studentPayload.nomor_pendaftaran = `${currentYear}${seqStr}${randomSuffix}`;

        const retry = await supabaseAdmin
          .from('students')
          .insert(studentPayload)
          .select()
          .single();

        if (retry.error || !retry.data) throw retry.error || new Error('Insert student returned no data.');
        insertedStudent = retry.data as Record<string, unknown>;
      } else {
        throw error || new Error('Insert student returned no data.');
      }

      // The database should create the profiles row through a trusted trigger or
      // a separate controlled provisioning step. Do not assign the role in user metadata.
      const sessionResponse = await completeRegistrationSession(
        supabaseAnon,
        internalEmail,
        cleanPassword,
        userId,
        cleanNik,
        cleanNama,
        insertedStudent,
      );

      if (sessionResponse.statusCode >= 500) {
        console.warn('[handleRegister] Account/data created but session sign-in failed.');
      }
      return sessionResponse;
    } catch (databaseError) {
      console.error('[handleRegister] Student insert failed; rolling back auth user:', databaseError);
      const { error: rollbackError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (rollbackError) {
        console.error('[handleRegister] Auth rollback failed:', rollbackError.message);
      }
      return response(
        500,
        'DATABASE_INSERT_FAILED',
        'Gagal menyimpan data pendaftaran. Silakan coba kembali atau hubungi panitia.',
      );
    }
  } catch (error) {
    console.error('[handleRegister] Unexpected error:', error);
    return response(500, 'INTERNAL_SERVER_ERROR', 'Terjadi kesalahan internal pada proses registrasi.');
  }
}

async function completeRegistrationSession(
  supabaseAnon: SupabaseClient,
  internalEmail: string,
  cleanPassword: string,
  userId: string,
  cleanNik: string,
  cleanNama: string,
  studentData: unknown,
): Promise<ApiResponse> {
  try {
    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email: internalEmail,
      password: cleanPassword,
    });

    if (error || !data.session) {
      console.error('[completeRegistrationSession] Sign-in failed:', error?.message);
      return {
        statusCode: 201,
        body: {
          success: true,
          message: 'Pendaftaran tersimpan. Silakan login menggunakan NIK dan password Anda.',
          user: {
            id: userId,
            nik: cleanNik,
            role: 'student',
            full_name: cleanNama,
            email: internalEmail,
          },
          student: studentData,
        },
      };
    }

    return {
      statusCode: 201,
      body: {
        success: true,
        session: data.session,
        user: {
          id: userId,
          nik: cleanNik,
          role: 'student',
          full_name: cleanNama,
          email: internalEmail,
        },
        student: studentData,
      },
    };
  } catch (error) {
    console.error('[completeRegistrationSession] Unexpected error:', error);
    return {
      statusCode: 201,
      body: {
        success: true,
        message: 'Pendaftaran tersimpan. Silakan login menggunakan NIK dan password Anda.',
        user: {
          id: userId,
          nik: cleanNik,
          role: 'student',
          full_name: cleanNama,
          email: internalEmail,
        },
        student: studentData,
      },
    };
  }
}

/** Deletes a student only after validating the bearer token and database role. */
export async function handleDeleteStudent(
  authHeader: string | undefined,
  body: unknown,
): Promise<ApiResponse> {
  const { supabaseAdmin, supabaseAnon, supabaseUrl } = getSupabaseClients();

  if (!supabaseUrl || !supabaseAdmin || !supabaseAnon) {
    return response(500, 'SERVER_MISCONFIGURED', 'Konfigurasi server belum lengkap.');
  }

  if (!authHeader || !/^Bearer\s+\S+/i.test(authHeader)) {
    return response(401, 'UNAUTHORIZED', 'Token otorisasi diperlukan.');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  try {
    const { data: authResult, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !authResult.user) {
      return response(401, 'INVALID_TOKEN', 'Sesi login tidak valid atau sudah kedaluwarsa.');
    }

    const callerId = authResult.user.id;
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .maybeSingle();

    if (profileError) {
      console.error('[handleDeleteStudent] Admin profile lookup failed:', profileError.message);
      return response(500, 'PROFILE_LOOKUP_FAILED', 'Gagal memverifikasi hak akses administrator.');
    }
    if (callerProfile?.role !== 'admin') {
      return response(403, 'FORBIDDEN', 'Hanya administrator yang dapat menghapus data siswa.');
    }

    const parsed = parseBody(body);
    if (parsed.error) return response(400, 'BAD_REQUEST', 'Format data permintaan tidak valid.');

    const cleanNik = String(parsed.data?.nik ?? '').trim();
    if (!/^\d{16}$/.test(cleanNik)) {
      return response(400, 'INVALID_NIK', 'NIK siswa harus terdiri dari 16 digit angka.');
    }

    const { data: targetStudent, error: findError } = await supabaseAdmin
      .from('students')
      .select('id, user_id, nik, nama_lengkap')
      .eq('nik', cleanNik)
      .maybeSingle();

    if (findError) {
      console.error('[handleDeleteStudent] Student lookup failed:', findError.message);
      return response(500, 'STUDENT_LOOKUP_FAILED', 'Gagal mencari data siswa.');
    }
    if (!targetStudent) {
      return response(404, 'STUDENT_NOT_FOUND', 'Data siswa tidak ditemukan.');
    }

    const targetUserId = targetStudent.user_id as string | null;
    if (!targetUserId) {
      return response(500, 'STUDENT_USER_ID_MISSING', 'Data akun siswa tidak lengkap; penghapusan dibatalkan.');
    }

    // Delete files first. Fail the operation if Storage reports an error so the
    // admin knows cleanup was not completed; this is not a database transaction.
    const storageTargets = [
      { bucket: 'dokumen-ppdb', folder: targetUserId },
      { bucket: 'berkas-spmb', folder: cleanNik },
    ];

    for (const target of storageTargets) {
      const { data: files, error: listError } = await supabaseAdmin.storage
        .from(target.bucket)
        .list(target.folder);

      if (listError) {
        console.error(`[handleDeleteStudent] Storage list failed (${target.bucket}):`, listError.message);
        return response(500, 'STORAGE_LIST_FAILED', 'Gagal memeriksa berkas siswa. Tidak ada data database yang dihapus.');
      }

      const filePaths = (files || [])
        .filter((file) => file.name && !file.id?.startsWith('folder-placeholder'))
        .map((file) => `${target.folder}/${file.name}`);

      if (filePaths.length > 0) {
        const { error: removeError } = await supabaseAdmin.storage
          .from(target.bucket)
          .remove(filePaths);

        if (removeError) {
          console.error(`[handleDeleteStudent] Storage removal failed (${target.bucket}):`, removeError.message);
          return response(500, 'STORAGE_DELETE_FAILED', 'Gagal menghapus berkas siswa. Data database belum dihapus.');
        }
      }
    }

    // Check every database delete. This sequence is not transactional; if a later
    // operation fails, inspect the logs and reconcile the affected records.
    const { error: paymentError } = await supabaseAdmin
      .from('pembayaran')
      .delete()
      .eq('user_id', targetUserId);
    if (paymentError) {
      console.error('[handleDeleteStudent] Payment delete failed:', paymentError.message);
      return response(500, 'PAYMENT_DELETE_FAILED', 'Gagal menghapus data pembayaran siswa.');
    }

    const { error: studentDeleteError } = await supabaseAdmin
      .from('students')
      .delete()
      .eq('user_id', targetUserId);
    if (studentDeleteError) {
      console.error('[handleDeleteStudent] Student delete failed:', studentDeleteError.message);
      return response(500, 'STUDENT_DELETE_FAILED', 'Gagal menghapus data pendaftaran siswa.');
    }

    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', targetUserId);
    if (profileDeleteError) {
      console.error('[handleDeleteStudent] Profile delete failed:', profileDeleteError.message);
      return response(500, 'PROFILE_DELETE_FAILED', 'Data siswa terhapus, tetapi profil gagal dihapus. Perlu pemeriksaan admin.');
    }

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (authDeleteError) {
      console.error('[handleDeleteStudent] Auth delete failed:', authDeleteError.message);
      return response(500, 'AUTH_DELETE_FAILED', 'Data siswa terhapus, tetapi akun Auth gagal dihapus. Perlu pemeriksaan admin.');
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        message: `Data pendaftar ${String(targetStudent.nama_lengkap || '')} berhasil dihapus permanen.`,
      },
    };
  } catch (error) {
    console.error('[handleDeleteStudent] Unexpected error:', error);
    return response(500, 'DELETE_FAILED', 'Terjadi kesalahan saat menghapus data siswa.');
  }
}
