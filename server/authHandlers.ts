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
  return `\( {get('day')}- \){get('month')}-${get('year')} \( {get('hour')}: \){get('minute')}`;
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

/**
 * Shared Login Request Handler
 * - Verifikasi Cloudflare Turnstile (wajib jika TURNSTILE_SECRET_KEY diset)
 * - Auth via Supabase
 * - Role diambil dari public.profiles (bukan JWT claim)
 */
export async function handleLogin(body: any): Promise<ApiResponse> {
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

  // ============================================================
  // Verifikasi Cloudflare Turnstile (wajib jika secret diset)
  // ============================================================
  const turnstileSecret = getEnv('TURNSTILE_SECRET_KEY');
  const turnstileToken =
    parsedBody?.turnstileToken ||
    parsedBody?.token ||
    parsedBody?.turnstile_token ||
    parsedBody?.captchaToken ||
    '';

  if (turnstileSecret) {
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

    try {
      const verifyFormData = new URLSearchParams();
      verifyFormData.append('secret', turnstileSecret);
      verifyFormData.append('response', String(turnstileToken));

      const turnstileResp = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        { method: 'POST', body: verifyFormData }
      );
      const turnstileOutcome = await turnstileResp.json();

      if (!turnstileOutcome.success) {
        console.warn('[Turnstile Login] Gagal:', turnstileOutcome['error-codes']);
        return {
          statusCode: 403,
          body: {
            success: false,
            code: 'CAPTCHA_FAILED',
            error: 'Verifikasi keamanan gagal. Muat ulang halaman dan coba lagi.',
          },
        };
      }
    } catch (cfErr) {
      console.error('[Turnstile Login] Error siteverify:', cfErr);
      return {
        statusCode: 403,
        body: {
          success: false,
          code: 'CAPTCHA_FAILED',
          error: 'Gagal memverifikasi keamanan. Silakan coba kembali.',
        },
      };
    }
  }

  const isNik = /^\d{16}$/.test(cleanId);
  const isAdminIdentifier = cleanId.toLowerCase() === 'admin';

  let authEmail = '';
  if (isNik) {
    authEmail = `nik_${cleanId}@auth.smkmuhiba.sch.id`;
  } else if (isAdminIdentifier) {
    authEmail = 'admin@smkmuhiba.sch.id';
  } else {
    return {
      statusCode: 400,
      body: {
        success: false,
        code: 'INVALID_IDENTIFIER',
        error: 'NIK harus terdiri dari 16 digit angka atau username "admin".',
      },
    };
  }

  try {
    const { data: authData, error: authErr } = await supabaseAnon.auth.signInWithPassword({
      email: authEmail,
      password: cleanPass,
    });

    if (authErr || !authData?.user) {
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
