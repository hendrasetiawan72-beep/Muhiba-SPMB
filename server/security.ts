/**
 * Helper keamanan bersama (SERVER ONLY — jangan diimpor dari src/).
 *
 *  - isUuid / timingSafeEqualStr          : validasi input & perbandingan konstan
 *  - validateTurnstileOutcome             : cek hostname + action hasil siteverify Turnstile
 *  - encryptSecret / decryptSecret        : AES-256-GCM untuk rahasia sekali-tampil (password sementara)
 *  - authenticateAdmin                    : JWT -> user -> role admin dari tabel profiles (server-side)
 *  - adminActionAllowed                   : rate limit aksi admin lewat RPC rate_limit_hit
 *
 * Semua fungsi memakai Web Crypto (tersedia di Cloudflare Workers dan Node >= 18).
 */
import { getAllowedOrigins } from './corsHelper';

export const GENERIC_ERROR_MESSAGE = 'Request tidak dapat diproses';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Perbandingan string waktu-konstan (mencegah timing attack pada secret/token) */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

// ============================================================================
// TURNSTILE — validasi hasil siteverify (hostname + action)
// ============================================================================
function allowedHostnames(): Set<string> {
  const hosts = new Set<string>();
  for (const origin of getAllowedOrigins()) {
    try {
      hosts.add(new URL(origin).hostname.toLowerCase());
    } catch {
      /* origin tidak valid -> diabaikan */
    }
  }
  return hosts;
}

/**
 * Memeriksa hasil siteverify setelah `success === true`.
 *  - hostname : bila allowlist origin dikonfigurasi, hostname widget HARUS salah satu darinya.
 *  - action   : bila widget mengirim action, harus sama dengan yang diharapkan endpoint.
 *               Set TURNSTILE_REQUIRE_ACTION=true agar token TANPA action juga ditolak
 *               (aktifkan setelah frontend baru ter-deploy; default longgar demi klien ter-cache).
 */
export function validateTurnstileOutcome(
  outcome: any,
  expectedAction: string
): { ok: true } | { ok: false; reason: 'not_success' | 'hostname_mismatch' | 'action_mismatch' | 'action_missing' } {
  if (!outcome || outcome.success !== true) return { ok: false, reason: 'not_success' };

  const strict = String(process.env.TURNSTILE_REQUIRE_ACTION || '').trim().toLowerCase() === 'true';
  const action = typeof outcome.action === 'string' ? outcome.action : '';
  if (action) {
    if (action !== expectedAction) return { ok: false, reason: 'action_mismatch' };
  } else if (strict) {
    return { ok: false, reason: 'action_missing' };
  }

  const hosts = allowedHostnames();
  const hostname = typeof outcome.hostname === 'string' ? outcome.hostname.toLowerCase() : '';
  if (hosts.size > 0) {
    if (hostname && !hosts.has(hostname)) return { ok: false, reason: 'hostname_mismatch' };
    if (!hostname && strict) return { ok: false, reason: 'hostname_mismatch' };
  }
  return { ok: true };
}

// ============================================================================
// SECRET BOX — AES-256-GCM (rahasia sekali-tampil, mis. password sementara)
// Kunci diturunkan (HKDF-SHA256) dari RESET_SECRET_KEY; bila tidak diset, dari
// SUPABASE_SERVICE_ROLE_KEY (yang memang hanya ada di server).
// ============================================================================
function b64uEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uDecode(text: string): Uint8Array {
  const p = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(p + '='.repeat((4 - (p.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveSecretKey(): Promise<CryptoKey> {
  const material = (process.env.RESET_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (material.length < 16) {
    throw new Error('SECRET_KEY_MISSING');
  }
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(material), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('spmb-one-time-secret'), info: enc.encode('aes-gcm-v1') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Enkripsi `plain`; `aad` mengikat ciphertext ke konteks (admin + target) sehingga tidak bisa dipindah-pakai. */
export async function encryptSecret(plain: string, aad: string): Promise<string> {
  const key = await deriveSecretKey();
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: enc.encode(aad) } as AesGcmParams,
      key,
      enc.encode(plain)
    )
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return b64uEncode(out);
}

export async function decryptSecret(token: string, aad: string): Promise<string> {
  const key = await deriveSecretKey();
  const raw = b64uDecode(token);
  if (raw.length < 13) throw new Error('SECRET_INVALID');
  const iv = raw.slice(0, 12);
  const ct = raw.slice(12);
  const enc = new TextEncoder();
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(aad) } as AesGcmParams,
    key,
    ct
  );
  return new TextDecoder().decode(plain);
}

// ============================================================================
// AUTENTIKASI ADMIN (server-side, tidak mempercayai klaim apa pun dari klien)
// ============================================================================
export type AdminAuthResult =
  | { ok: true; callerId: string; callerName: string }
  | { ok: false; status: number; message: string };

export async function authenticateAdmin(req: any, supabaseAdmin: any): Promise<AdminAuthResult> {
  const authHeader = String(req.headers?.authorization || '');
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, status: 401, message: 'Autentikasi diperlukan. Token tidak ditemukan.' };

  const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token);
  if (callerErr || !callerData?.user) {
    return { ok: false, status: 401, message: 'Token sesi kedaluwarsa atau tidak valid.' };
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('role, full_name')
    .eq('id', callerData.user.id)
    .maybeSingle();

  if (profileErr || profile?.role !== 'admin') {
    return { ok: false, status: 403, message: 'Akses ditolak: Hanya administrator yang diizinkan.' };
  }
  return { ok: true, callerId: callerData.user.id, callerName: profile?.full_name || 'Administrator' };
}

// ============================================================================
// RATE LIMIT AKSI ADMIN (memakai RPC rate_limit_hit yang sudah ada)
//  'limited' -> tolak.  'error' -> RPC tidak tersedia: dicatat, aksi admin tetap diizinkan
//  (admin sudah terautentikasi + tercatat audit log; ketersediaan operasional diutamakan).
// ============================================================================
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function adminActionAllowed(
  supabaseAdmin: any,
  bucket: string,
  callerId: string,
  limit: number,
  windowSeconds: number
): Promise<'ok' | 'limited' | 'error'> {
  try {
    const salt =
      (process.env.RATE_LIMIT_SALT || '').trim() ||
      (await sha256Hex('rl-salt:' + (process.env.SUPABASE_SERVICE_ROLE_KEY || '')));
    const keyHash = await sha256Hex(`${bucket}:${callerId}:${salt}`);
    const { data, error } = await supabaseAdmin.rpc('rate_limit_hit', {
      p_bucket: bucket,
      p_key_hash: keyHash,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error('[AdminRateLimit] RPC error:', error.message);
      return 'error';
    }
    return data === false ? 'limited' : 'ok';
  } catch (e: any) {
    console.error('[AdminRateLimit] Exception:', e?.message);
    return 'error';
  }
}
