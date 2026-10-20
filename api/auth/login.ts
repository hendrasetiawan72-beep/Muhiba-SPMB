import { handleLogin } from '../../server/authHandlers';

// Cloudflare Worker / Vercel: POST /api/auth/login
export default async function handler(req: any, res: any) {
  const allowedOrigin = (process.env.ALLOWED_ORIGIN || '').trim();
  const requestOrigin = (req.headers?.origin || '').trim();

  if (allowedOrigin && requestOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (allowedOrigin && !requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      error: `Method ${req.method} tidak diizinkan. Gunakan POST.`,
    });
  }

  const clientIp =
    (req.headers?.['cf-connecting-ip'] as string | undefined)?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    '127.0.0.1';

  const body = req.body || {};
  const identifier = String(body.identifier || body.nik || '').trim();
  const password = String(body.password || '').trim();

  if (identifier.length > 100 || password.length > 128) {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'Panjang karakter identitas atau kata sandi melebihi batas wajar.',
    });
  }

  const result = await handleLogin(req.body, clientIp);
  return res.status(result.statusCode).json(result.body);
}
