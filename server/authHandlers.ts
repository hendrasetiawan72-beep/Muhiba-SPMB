import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variable retrieval
function getEnv(key: string, fallbackKey?: string): string {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[key]) return process.env[key]!;
    if (fallbackKey && process.env[fallbackKey]) return process.env[fallbackKey]!;
  }
  return '';
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

  const supabaseAdmin =
    supabaseUrl && serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

  const supabaseAnon =
    supabaseUrl && (anonKey || serviceRoleKey)
      ? createClient(supabaseUrl, anonKey || serviceRoleKey)
      : null;

  return { supabaseAdmin, supabaseAnon, supabaseUrl };
}

/**
 * Formats current date-time in Asia/Jakarta (WIB) with format: dd-mm-yyyy hh:mm
 */
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
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}`;
}

export interface ApiResponse {
  statusCode: number;
  body: {
    success: boolean;
    code?: string;
    error?: string;
    message?: string;
    session?: any;
    user?: any;
    student?: any;
  };
}

// ============================================================================
// KEAMANAN LOGIN: rate limit (fail-closed) + CAPTCHA (fail-closed)
// Batas bisa disesuaikan. Sekolah memakai Wi-Fi bersama, jadi batas per IP longgar.
// ============================================================================
const LOGIN_WINDOW_SECONDS = 600; // 10 menit
const LOGIN_LIMIT_PER_IP = 100;
const LOGIN_LIMIT_PER_ID = 10;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

type RateResult = 'ok' | 'limited' | 'unavailable';

async function rateLimitHit(
  admin: SupabaseClient | null,
  bucket: string,
  rawKey: string,
  limit: number,
  windowSeconds: number
): Promise<RateResult> {
  if (!admin) return 'unavailable';
  try {
    const salt = getEnv('RATE_LIMIT_SALT') || getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const keyHash = await sha256Hex(`${bucket}:${rawKey}:${salt}`);
    const { data, error } = await admin.rpc('rate_limit_hit', {
      p_bucket: bucket,
      p_key_hash: keyHash,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error('[RateLimit] RPC error (fail-closed):', error.message);
      return 'unavailable';
    }
    return data === false ? 'limited' : 'ok';
  } catch (e) {
    console.error('[RateLimit] Exception (fail-closed):', e);
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

/** Verifikasi Turnstile manual. Mengembalikan null jika lolos, atau ApiResponse error. */
async function checkTurnstile(token: unknown, clientIp: string): Promise<ApiResponse | null> {
  const secret = getEnv('TURNSTILE_SECRET_KEY');

  if (!secret) {
    // FAIL-CLOSED: tanpa secret, CAPTCHA tidak boleh dilewati melalui environment flag.
    console.error('[Turnstile] TURNSTILE_SECRET_KEY belum diset (fail-closed).');
    return {
      statusCode: 500,
      body: {
        success: false,
        code: 'SERVER_MISCONFIGURED',
        error: 'Konfigurasi keamanan server belum lengkap. Silakan hubungi panitia.',
      },
    };
  }

  const fail = (error: string): ApiResponse => ({
    statusCode: 403,
    body: { success: false, code: 'CAPTCHA_FAILED', error },
  });

  if (!token) return fail('Verifikasi keamanan Turnstile wajib diisi.');

  try {
    const form = new URLSearchParams();
    form.append('secret', secret);
    form.append('response', String(token));
    if (clientIp) form.append('remoteip', clientIp);

    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const outcome: any = await resp.json();
    if (!outcome.success) {
      console.warn('[Turnstile Login] Gagal:', outcome['error-codes']);
      return fail('Verifikasi keamanan gagal. Muat ulang halaman dan coba lagi.');
    }
    return null;
  } catch (cfErr) {
    console.error('[Turnstile Login] Error siteverify:', cfErr);
    return fail('Gagal memverifikasi keamanan. Silakan coba kembali.');
  }
}

/**
 * Shared Login Request Handler
 * - Verifikasi Cloudflare Turnstile (wajib)
 * - Auth via Supabase
 * - Role diambil dari public.profiles (bukan JWT claim)
 */
export async function handleLogin(body: any, clientIpRaw: string = ''): Promise<ApiResponse> {
  const { supabaseAdmin, supabaseAnon, supabaseUrl } = getSupabaseClients();

  if (!supabaseUrl || !supabaseAnon) {
    return {
      statusCode: 500,
      body: {
        success: false,
        code: 'SERVER_MISCONFIGURED',
        error: 'Konfigurasi server belum lengkap. Silakan hubungi panitia.',
      },
    };
  }

  let parsedBody = body;
  if (typeof body === 'string') {
    try {
      parsedBody = JSON.parse(body);
    } catch {
      return {
        statusCode: 400,
        body: {
          success: false,
          code: 'BAD_REQUEST',
          error: 'Format data permintaan tidak valid.',
        },
      };
    }
  }

  const { identifier, password } = parsedBody || {};
  const cleanId = String(identifier || '').trim();
  const cleanPass = String(password || '').trim();

  if (!cleanId || !cleanPass) {
    return {
      statusCode: 400,
      body: {
        success: false,
        code: 'MISSING_CREDENTIALS',
        error: 'Username / NIK dan password wajib diisi.',
      },
    };
  }

  if (cleanPass.length < 8) {
    return {
      statusCode: 400,
      body: {
        success: false,
        code: 'PASSWORD_TOO_SHORT',
        error: 'Password minimal 8 karakter.',
      },
    };
  }

  const clientIp = (clientIpRaw || '').trim();
  const turnstileToken =
    parsedBody?.turnstileToken ||
    parsedBody?.token ||
    parsedBody?.turnstile_token ||
    parsedBody?.captchaToken ||
    '';

  // ============================================================
  // 1. Rate limit per IP (sebelum menyentuh Turnstile/Supabase)
  // ============================================================
  const ipLimited = rateLimitResponse(
    await rateLimitHit(
      supabaseAdmin,
      'login:ip',
      clientIp || 'unknown',
      LOGIN_LIMIT_PER_IP,
      LOGIN_WINDOW_SECONDS
    )
  );
  if (ipLimited) return ipLimited;

  // ============================================================
  // 2. CAPTCHA
  //    Mode default: server memverifikasi Turnstile sendiri.
  //    Mode SUPABASE_CAPTCHA=true: token diteruskan ke Supabase Auth
  //    (aktifkan CAPTCHA di dashboard Supabase) sehingga jalur langsung
  //    ke Supabase dengan anon key pun wajib CAPTCHA.
  // ============================================================
  const supabaseCaptchaMode = getEnv('SUPABASE_CAPTCHA') === 'true';
  if (supabaseCaptchaMode) {
    if (!turnstileToken) {
      return {
        statusCode: 403,
        body: {
          success: false,
          code: 'CAPTCHA_FAILED',
          error: 'Verifikasi keamanan Turnstile wajib diisi.',
        },
      };
    }
  } else {
    const captchaError = await checkTurnstile(turnstileToken, clientIp);
    if (captchaError) return captchaError;
  }

  // Identitas login:
  //  - siswa : NIK 16 digit
  //  - admin : username "admin" ATAU email akun admin (mis. admin@smkmuhiba.sch.id)
  // Email sintetis siswa (nik_...@auth...) tidak boleh dipakai untuk login.
  const STUDENT_EMAIL_DOMAIN = '@auth.smkmuhiba.sch.id';
  const lowerId = cleanId.toLowerCase();
  const isNik = /^\d{16}$/.test(cleanId);
  const isEmailId =
    lowerId.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lowerId) &&
    !lowerId.endsWith(STUDENT_EMAIL_DOMAIN);
  const isAdminIdentifier = lowerId === 'admin' || isEmailId;

  let authEmail = '';
  if (isNik) {
    authEmail = `nik_${cleanId}${STUDENT_EMAIL_DOMAIN}`;
  } else if (lowerId === 'admin') {
    authEmail = 'admin@smkmuhiba.sch.id';
  } else if (isEmailId) {
    authEmail = lowerId;
  } else {
    return {
      statusCode: 400,
      body: {
        success: false,
        code: 'INVALID_IDENTIFIER',
        error: 'Masukkan NIK 16 digit angka sebagai username anda.',
      },
    };
  }

  // 3. Rate limit per NIK / admin (setelah CAPTCHA lolos, agar bot tanpa CAPTCHA
  //    tidak bisa mengunci akun orang lain)
  const idLimited = rateLimitResponse(
    await rateLimitHit(
      supabaseAdmin,
      'login:id',
      cleanId.toLowerCase(),
      LOGIN_LIMIT_PER_ID,
      LOGIN_WINDOW_SECONDS
    )
  );
  if (idLimited) return idLimited;

  try {
    const { data: authData, error: authErr } = await supabaseAnon.auth.signInWithPassword({
      email: authEmail,
      password: cleanPass,
      ...(supabaseCaptchaMode ? { options: { captchaToken: String(turnstileToken) } } : {}),
    });

    if (authErr || !authData?.user) {
      // CAPTCHA Supabase menolak: ini masalah konfigurasi/token, bukan password salah
      if (authErr && /captcha/i.test(authErr.message || '')) {
        console.error('[handleLogin] Supabase menolak karena CAPTCHA:', authErr.message);
        if (supabaseCaptchaMode) {
          return {
            statusCode: 403,
            body: {
              success: false,
              code: 'CAPTCHA_FAILED',
              error: 'Verifikasi keamanan gagal atau kedaluwarsa. Selesaikan CAPTCHA lagi lalu coba kembali.',
            },
          };
        }
        return {
          statusCode: 503,
          body: {
            success: false,
            code: 'CAPTCHA_CONFIG',
            error:
              'CAPTCHA Supabase aktif tetapi server belum meneruskan token. Atur variabel SUPABASE_CAPTCHA=true pada Worker, lalu coba lagi.',
          },
        };
      }
      return {
        statusCode: 401,
        body: {
          success: false,
          code: 'INVALID_CREDENTIALS',
          error: isNik
            ? 'NIK atau password yang Anda masukkan salah. Pastikan 16 digit NIK dan password sesuai saat pendaftaran.'
            : 'Username atau password admin salah.',
        },
      };
    }

    const authUser = authData.user;
    const clientForProfile = supabaseAdmin || supabaseAnon;

    // Source of Truth: role dari public.profiles
    const { data: profileData, error: profileErr } = await clientForProfile
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileErr) {
      console.warn('[handleLogin] Profile query notice:', profileErr.message);
    }

    const verifiedRole = profileData?.role === 'admin' ? 'admin' : 'student';

    if (isAdminIdentifier && verifiedRole !== 'admin') {
      return {
        statusCode: 403,
        body: {
          success: false,
          code: 'FORBIDDEN',
          error: 'Akses ditolak: Akun ini tidak memiliki hak akses administrator di database.',
        },
      };
    }

    const userObj = {
      id: authUser.id,
      nik: profileData?.nik || authUser.user_metadata?.nik || (isNik ? cleanId : ''),
      role: verifiedRole,
      full_name:
        profileData?.full_name ||
        authUser.user_metadata?.full_name ||
        (verifiedRole === 'admin' ? 'Administrator' : 'Siswa'),
      email: authUser.email || authEmail,
      must_change_password: !!(profileData as any)?.must_change_password,
      created_at: authUser.created_at,
    };

    let studentData: any = undefined;
    if (verifiedRole === 'student') {
      const { data: stdRecord } = await clientForProfile
        .from('students')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (!stdRecord) {
        await supabaseAnon.auth.signOut();
        return {
          statusCode: 404,
          body: {
            success: false,
            code: 'STUDENT_NOT_FOUND',
            error: 'Data pendaftaran tidak ditemukan. Hubungi panitia.',
          },
        };
      }
      studentData = stdRecord;
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        session: authData.session,
        user: userObj,
        student: studentData,
      },
    };
  } catch (err: any) {
    console.error('[handleLogin] Internal error:', err);
    return {
      statusCode: 500,
      body: {
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        error: 'Terjadi gangguan internal pada server saat login. Silakan coba kembali.',
      },
    };
  }
}

/**
 * Shared Register Request Handler
 * Catatan: production register utama ada di api/auth/register.ts (lebih lengkap:
 * NIK validation, rate limit, Turnstile, weak password, dll).
 * Handler ini tetap dipertahankan untuk kompatibilitas.
 */
export async function handleRegister(body: any): Promise<ApiResponse> {
  const { supabaseAdmin, supabaseAnon, supabaseUrl } = getSupabaseClients();

  if (!supabaseUrl || !supabaseAdmin || !supabaseAnon) {
    return {
      statusCode: 500,
      body: {
        success: false,
        code: 'SERVER_MISCONFIGURED',
        error:
          'Konfigurasi server belum lengkap: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diatur.',
      },
    };
  }

  let parsedBody = body;
  if (typeof body === 'string') {
    try {
      parsedBody = JSON.parse(body);
    } catch {
      return {
        statusCode: 400,
        body: {
          success: false,
          code: 'BAD_REQUEST',
          error: 'Format data permintaan pendaftaran tidak valid.',
        },
      };
    }
  }

  const rawNik = parsedBody?.nik ?? '';
  const rawNama = parsedBody?.nama ?? parsedBody?.nama_lengkap ?? '';
  const rawJurusan = parsedBody?.jurusan ?? parsedBody?.jurusan_pilihan ?? '';
  const rawWa = parsedBody?.whatsapp ?? parsedBody?.no_wa ?? '';
  const rawPassword = parsedBody?.password ?? '';

  const cleanNik = String(rawNik || '')
    .trim()
    .replace(/\D/g, '');
  const cleanNama = String(rawNama || '').trim();
  const cleanJurusan = String(rawJurusan || '').trim().toUpperCase();
  const cleanNoWa = String(rawWa || '').trim();
  const cleanPassword = String(rawPassword || '').trim();

  if (!/^\d{16}$/.test(cleanNik)) {
    return {
      statusCode: 400,
      body: {
        success: false,
        code: 'INVALID_NIK',
        error: 'NIK harus terdiri dari 16 digit angka sesuai KTP / Kartu Keluarga.',
      },
    };
  }
  if (!cleanNama) {
    return {
      statusCode: 400,
      body: {
        success: false,
        code: 'INVALID_NAMA',
        error: 'Nama lengkap wajib diisi.',
      },
    };
  }
  if (!['TO', 'TJKT', 'AKL'].includes(cleanJurusan)) {
    return {
      statusCode: 400,
      body: {
        success: false,
        code: 'INVALID_JURUSAN',
        error: 'Pilihan kompetensi keahlian / jurusan tidak valid.',
      },
    };
  }
  if (cleanPassword.length < 8) {
    return {
      statusCode: 400,
      body: {
        success: false,
        code: 'PASSWORD_TOO_SHORT',
        error: 'Password minimal 8 karakter demi keamanan akun Anda.',
      },
    };
  }

  try {
    const { data: existingStudent } = await supabaseAdmin
      .from('students')
      .select('nik')
      .eq('nik', cleanNik)
      .maybeSingle();

    if (existingStudent) {
      return {
        statusCode: 409,
        body: {
          success: false,
          code: 'NIK_ALREADY_REGISTERED',
          error: `NIK ${cleanNik} sudah terdaftar di sistem SPMB. Silakan langsung login.`,
        },
      };
    }

    const internalEmail = `nik_${cleanNik}@auth.smkmuhiba.sch.id`;
    // JANGAN kirim role di user_metadata (dicegah privilege escalation)
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
      if (
        createAuthErr?.message?.includes('already been registered') ||
        createAuthErr?.message?.includes('exists')
      ) {
        return {
          statusCode: 409,
          body: {
            success: false,
            code: 'AUTH_USER_EXISTS',
            error: `Akun Auth untuk NIK ${cleanNik} sudah terdaftar. Silakan login dengan password Anda.`,
          },
        };
      }
      return {
        statusCode: 500,
        body: {
          success: false,
          code: 'AUTH_PROVISION_FAILED',
          error: 'Gagal membuat akun autentikasi. Silakan hubungi panitia.',
        },
      };
    }

    const userId = authCreated.user.id;
    const tanggalDaftar = formatTanggalDaftarJakarta();

    try {
      const studentPayload: Record<string, any> = {
        user_id: userId,
        nik: cleanNik,
        nama_lengkap: cleanNama,
        jurusan_pilihan: cleanJurusan,
        no_wa: cleanNoWa,
        status_pendaftaran: 'Berkas Fisik',
        tanggal_daftar: tanggalDaftar,
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

      if (studentErr) {
        if (studentErr.message?.includes('nomor_pendaftaran')) {
          const { count } = await supabaseAdmin
            .from('students')
            .select('*', { count: 'exact', head: true });
          const currentYear = new Date().getFullYear().toString();
          const seq = (count || 0) + 1;
          const seqStr = String(seq).length < 4 ? String(seq).padStart(4, '0') : String(seq);
          const rand = Math.floor(100 + Math.random() * 900);
          studentPayload.nomor_pendaftaran = `${currentYear}${seqStr}${rand}`;
          const retry = await supabaseAdmin
            .from('students')
            .insert(studentPayload)
            .select()
            .single();
          if (retry.error) throw retry.error;
          return await completeRegistrationSession(
            supabaseAnon,
            internalEmail,
            cleanPassword,
            userId,
            cleanNik,
            cleanNama,
            retry.data
          );
        }
        throw studentErr;
      }

      return await completeRegistrationSession(
        supabaseAnon,
        internalEmail,
        cleanPassword,
        userId,
        cleanNik,
        cleanNama,
        insertedStudent
      );
    } catch (dbErr: any) {
      console.error('[handleRegister] DB insert failed, rolling back auth user:', dbErr);
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (rollbackErr) {
        console.error('[handleRegister] Rollback error:', rollbackErr);
      }
      return {
        statusCode: 500,
        body: {
          success: false,
          code: 'DATABASE_INSERT_FAILED',
          error:
            'Gagal menyimpan data pendaftaran ke database. Pendaftaran telah di-rollback, silakan coba kembali.',
        },
      };
    }
  } catch (err: any) {
    console.error('[handleRegister] Unexpected error:', err);
    return {
      statusCode: 500,
      body: {
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        error: 'Terjadi kesalahan internal pada proses registrasi.',
      },
    };
  }
}

async function completeRegistrationSession(
  supabaseAnon: SupabaseClient,
  internalEmail: string,
  cleanPassword: string,
  userId: string,
  cleanNik: string,
  cleanNama: string,
  studentData: any
): Promise<ApiResponse> {
  const { data: sessionData } = await supabaseAnon.auth.signInWithPassword({
    email: internalEmail,
    password: cleanPassword,
  });

  return {
    statusCode: 201,
    body: {
      success: true,
      session: sessionData?.session || null,
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

/**
 * Shared Admin Delete Student Request Handler
 */
export async function handleDeleteStudent(
  authHeader: string | undefined,
  body: any
): Promise<ApiResponse> {
  const { supabaseAdmin, supabaseAnon } = getSupabaseClients();

  if (!supabaseAdmin) {
    return {
      statusCode: 500,
      body: {
        success: false,
        code: 'SERVER_MISCONFIGURED',
        error: 'Konfigurasi server belum lengkap.',
      },
    };
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: {
        success: false,
        code: 'UNAUTHORIZED',
        error: 'Token otorisasi diperlukan.',
      },
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const clientForAuth = supabaseAnon || supabaseAdmin;
  const { data: authUserResult, error: authUserErr } = await clientForAuth.auth.getUser(token);

  if (authUserErr || !authUserResult?.user) {
    return {
      statusCode: 401,
      body: {
        success: false,
        code: 'INVALID_TOKEN',
        error: 'Sesi login tidak valid atau sudah kedaluwarsa.',
      },
    };
  }

  const callerUser = authUserResult.user;

  const { data: callerProfile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', callerUser.id)
    .maybeSingle();

  if (profileErr || callerProfile?.role !== 'admin') {
    return {
      statusCode: 403,
      body: {
        success: false,
        code: 'FORBIDDEN',
        error: 'Akses ditolak: Hanya administrator yang dapat menghapus data siswa.',
      },
    };
  }

  let parsedBody = body;
  if (typeof body === 'string') {
    try {
      parsedBody = JSON.parse(body);
    } catch {
      return {
        statusCode: 400,
        body: {
          success: false,
          code: 'BAD_REQUEST',
          error: 'Format data permintaan tidak valid.',
        },
      };
    }
  }

  const cleanNik = String(parsedBody?.nik || '').trim();
  if (!cleanNik) {
    return {
      statusCode: 400,
      body: {
        success: false,
        code: 'MISSING_NIK',
        error: 'NIK siswa yang akan dihapus wajib disertakan.',
      },
    };
  }

  const { data: targetStudent, error: findErr } = await supabaseAdmin
    .from('students')
    .select('id, user_id, nik, nama_lengkap')
    .eq('nik', cleanNik)
    .maybeSingle();

  if (findErr || !targetStudent) {
    return {
      statusCode: 404,
      body: {
        success: false,
        code: 'STUDENT_NOT_FOUND',
        error: `Data siswa dengan NIK ${cleanNik} tidak ditemukan.`,
      },
    };
  }

  const targetUserId = targetStudent.user_id;

  try {
    try {
      const { data: files } = await supabaseAdmin.storage
        .from('dokumen-ppdb')
        .list(targetUserId);

      if (files && files.length > 0) {
        const paths = files.map((f) => `${targetUserId}/${f.name}`);
        await supabaseAdmin.storage.from('dokumen-ppdb').remove(paths);
      }
    } catch (storageErr) {
      console.warn('[handleDeleteStudent] Storage cleanup notice (dokumen-ppdb):', storageErr);
    }

    try {
      const { data: legacyFiles } = await supabaseAdmin.storage
        .from('berkas-spmb')
        .list(cleanNik);

      if (legacyFiles && legacyFiles.length > 0) {
        const paths = legacyFiles.map((f) => `${cleanNik}/${f.name}`);
        await supabaseAdmin.storage.from('berkas-spmb').remove(paths);
      }
    } catch (storageErr) {
      console.warn('[handleDeleteStudent] Storage cleanup notice (berkas-spmb):', storageErr);
    }

    await supabaseAdmin.from('pembayaran').delete().eq('user_id', targetUserId);
    await supabaseAdmin.from('students').delete().eq('user_id', targetUserId);
    await supabaseAdmin.from('profiles').delete().eq('id', targetUserId);

    if (targetUserId) {
      await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        message: `Data pendaftar ${targetStudent.nama_lengkap} (NIK: ${cleanNik}) berhasil dihapus permanen.`,
      },
    };
  } catch (deleteErr: any) {
    console.error('[handleDeleteStudent] Delete execution error:', deleteErr);
    return {
      statusCode: 500,
      body: {
        success: false,
        code: 'DELETE_FAILED',
        error: 'Terjadi kesalahan saat menghapus data siswa.',
      },
    };
  }
}
