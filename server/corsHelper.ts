/**
 * Shared CORS Configuration & Helper across Express server, Worker, and API handlers.
 * Resolves ALLOWED_ORIGIN, ALLOWED_ORIGINS, APP_URL, and dev origins consistently.
 */

export function getAllowedOrigins(): Set<string> {
  const allowed = new Set<string>();

  const rawOrigins = [
    process.env.ALLOWED_ORIGINS,
    process.env.ALLOWED_ORIGIN,
  ];

  for (const raw of rawOrigins) {
    if (!raw) continue;
    for (const origin of raw.split(',')) {
      const trimmed = origin.trim();
      if (trimmed) allowed.add(trimmed);
    }
  }

  // Tambahkan APP_URL jika dikonfigurasi (misalnya domain preview Cloud Run / custom domain)
  if (process.env.APP_URL) {
    try {
      allowed.add(new URL(process.env.APP_URL).origin);
    } catch {}
  }

  // Khusus dev server lokal pada development
  if (process.env.NODE_ENV === 'development') {
    allowed.add('http://localhost:3000');
    allowed.add('http://127.0.0.1:3000');
  }

  return allowed;
}

export function isOriginAllowed(requestOrigin: string): boolean {
  if (!requestOrigin) return true; // Same-origin / direct server call
  return getAllowedOrigins().has(requestOrigin);
}

export function applyCors(req: any, res: any): boolean {
  const requestOrigin = String(req.headers?.origin || '').trim();
  const allowed = isOriginAllowed(requestOrigin);

  if (!allowed) {
    if (req.method === 'OPTIONS') {
      res.status(403).end();
    } else {
      res.status(403).json({
        code: 'CORS_FORBIDDEN',
        message: 'Origin tidak diizinkan.',
      });
    }
    return false;
  }

  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  return true;
}
