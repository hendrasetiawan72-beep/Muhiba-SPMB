// Cloudflare Worker entry: menjalankan endpoint /api/* (yang aslinya fungsi Vercel)
// dan menyajikan hasil build Vite (folder dist) lewat binding ASSETS.
import registerHandler from '../api/auth/register';
import loginHandler from '../api/auth/login';
import deleteStudentHandler from '../api/admin/delete-student';
import resetPasswordHandler from '../api/admin/reset-password';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

type VercelStyleHandler = (req: any, res: any) => unknown;

const routes: Record<string, VercelStyleHandler> = {
  '/api/auth/register': registerHandler,
  '/api/auth/login': loginHandler,
  '/api/admin/delete-student': deleteStudentHandler,
  '/api/admin/reset-password': resetPasswordHandler,
};

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Membungkus Request/Response Workers menjadi objek req/res bergaya Vercel/Express
// supaya handler di folder api/ bisa dipakai apa adanya.
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
      body = text; // handler akan membalas 400 sendiri bila bukan JSON valid
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
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const handler = routes[url.pathname.replace(/\/+$/, '')];
      if (!handler) {
        return jsonResponse(404, { success: false, code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' });
      }
      return runHandler(handler, request);
    }

    return env.ASSETS.fetch(request);
  },
};
