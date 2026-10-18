// Cloudflare Worker entry: menjalankan endpoint /api/* (yang aslinya fungsi Vercel)
// dan menyajikan hasil build Vite (folder dist) lewat binding ASSETS.
import registerHandler from '../api/auth/register';
import loginHandler from '../api/auth/login';
import deleteStudentHandler from '../api/admin/delete-student';
import resetPasswordHandler from '../api/admin/reset-password';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  [key: string]: unknown;
}

// Salin variabel/secret Worker ke process.env, karena handler di folder api/
// membacanya lewat process.env (gaya Node/Vercel).
function syncEnvToProcess(env: Env) {
  const proc = (globalThis as any).process;
  if (!proc || !proc.env) return;
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') proc.env[key] = value;
  }
}

type VercelStyleHandler = (req: any, res: any) => unknown;

const routes: Record<string, VercelStyleHandler> = {
  '/api/auth/register': registerHandler,
  '/api/auth/login': loginHandler,
  '/api/admin/delete-student': deleteStudentHandler,
  '/api/admin/reset-password': resetPasswordHandler,
};

function jsonResponse(status: number, payload: unknown, extraHeaders: Record<string, string> = {}): Response {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...extraHeaders,
  });
  return new Response(JSON.stringify(payload), { status, headers });
}

/** Security headers yang diterapkan ke SEMUA response (API + static) */
function applySecurityHeaders(headers: Headers) {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // CSP longgar agar React + Turnstile + Google Fonts tetap jalan.
  // Sesuaikan domain Supabase Anda jika perlu.
  headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://blogger.googleusercontent.com https://images.unsplash.com",
      "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com https://www.tiktok.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
}

// Membungkus Request/Response Workers menjadi objek req/res bergaya Vercel/Express
async function runHandler(handler: VercelStyleHandler, request: Request): Promise<Response> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const clientIp = request.headers.get('cf-connecting-ip');
  if (clientIp) headers['x-forwarded-for'] = clientIp;

  let body: unknown = undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const text = await request.text();
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = text;
    }
  }

  const req = {
    method: request.method,
    headers,
    body,
    socket: { remoteAddress: clientIp || '127.0.0.1' },
  };

  return new Promise<Response>((resolve) => {
    const outHeaders = new Headers();
    let statusCode = 200;
    let done = false;

    const finish = (payload: string) => {
      if (done) return;
      done = true;
      applySecurityHeaders(outHeaders);
      const noBody = statusCode === 204 || statusCode === 205 || statusCode === 304;
      resolve(new Response(noBody ? null : payload, { status: statusCode, headers: outHeaders }));
    };

    const res: any = {
      setHeader(key: string, value: unknown) {
        outHeaders.set(key, String(value));
        return res;
      },
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(obj: unknown) {
        outHeaders.set('Content-Type', 'application/json');
        outHeaders.set('Cache-Control', 'no-store');
        finish(JSON.stringify(obj));
        return res;
      },
      send(data: unknown) {
        finish(typeof data === 'string' ? data : JSON.stringify(data));
        return res;
      },
      end(data?: string) {
        finish(data ?? '');
        return res;
      },
    };

    Promise.resolve(handler(req, res))
      .then(() => finish(''))
      .catch((err) => {
        console.error('[Worker] Unhandled error in API handler:', err);
        statusCode = 500;
        outHeaders.set('Content-Type', 'application/json');
        finish(
          JSON.stringify({
            success: false,
            code: 'SERVER_ERROR',
            message: 'Terjadi kesalahan sistem pada server.',
          })
        );
      });
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    syncEnvToProcess(env);
    const url = new URL(request.url);

    // ============================================================
    // HEALTH CHECK — DILINDUNGI / DINONAKTIFKAN DI PRODUCTION
    // Hanya aktif jika HEALTH_CHECK_SECRET diset dan cocok.
    // ============================================================
    if (url.pathname === '/api/health') {
      const secret = typeof env.HEALTH_CHECK_SECRET === 'string' ? env.HEALTH_CHECK_SECRET : '';
      const provided = url.searchParams.get('token') || request.headers.get('x-health-token') || '';

      // Jika secret tidak diset → endpoint dimatikan (404)
      if (!secret || secret.length < 16) {
        return jsonResponse(404, { success: false, message: 'Not found' });
      }
      if (provided !== secret) {
        return jsonResponse(403, { success: false, message: 'Forbidden' });
      }

      // Hanya kembalikan status boolean, jangan bocorkan nama secret
      const names = [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'TURNSTILE_SECRET_KEY',
        'RATE_LIMIT_SALT',
        'ALLOWED_ORIGIN',
      ];
      const present: Record<string, boolean> = {};
      for (const n of names) {
        const v = env[n];
        present[n] = typeof v === 'string' && v.trim().length > 0;
      }
      return jsonResponse(200, {
        ok: true,
        version: 'worker-v3-secured',
        env: present,
      });
    }

    if (url.pathname.startsWith('/api/')) {
      const handler = routes[url.pathname];
      if (!handler) {
        return jsonResponse(404, { success: false, message: 'Endpoint tidak ditemukan.' });
      }
      return runHandler(handler, request);
    }

    // Static assets dari Vite build
    const assetResponse = await env.ASSETS.fetch(request);
    // Clone supaya bisa set header
    const newHeaders = new Headers(assetResponse.headers);
    applySecurityHeaders(newHeaders);
    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers: newHeaders,
    });
  },
};
