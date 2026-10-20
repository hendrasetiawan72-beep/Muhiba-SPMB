import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import registerHandler from './api/auth/register';
import loginHandler from './api/auth/login';
import deleteStudentHandler from './api/admin/delete-student';
import resetPasswordHandler from './api/admin/reset-password';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '128kb' }));

// CORS Configuration: proteksi endpoint /api/*
app.use((req: Request, res: Response, next) => {
  // Jangan pernah memblokir asset statis, skrip frontend, atau middleware Vite
  if (!req.path.startsWith('/api')) {
    return next();
  }

  const allowedOrigin = (process.env.ALLOWED_ORIGIN || '').trim();
  const requestOrigin = String(req.headers?.origin || '').trim();

  // Validasi origin yang diizinkan:
  // - Tanpa header origin (same-origin / direct server call)
  // - Cocok persis dengan ALLOWED_ORIGIN dari konfigurasi
  // - Lingkungan dev atau preview Google Cloud Run (*.run.app, localhost, 127.0.0.1)
  const isDevOrPreview =
    process.env.NODE_ENV !== 'production' ||
    requestOrigin.includes('localhost') ||
    requestOrigin.includes('127.0.0.1') ||
    requestOrigin.endsWith('.run.app');

  const isAllowed =
    !requestOrigin ||
    (allowedOrigin && requestOrigin === allowedOrigin) ||
    isDevOrPreview;

  if (!isAllowed) {
    if (req.method === 'OPTIONS') {
      return res.status(403).end();
    }
    return res.status(403).json({
      code: 'CORS_FORBIDDEN',
      message: 'Origin tidak diizinkan.',
    });
  }

  if (requestOrigin) {
    const acao = allowedOrigin && requestOrigin === allowedOrigin ? allowedOrigin : requestOrigin;
    res.setHeader('Access-Control-Allow-Origin', acao);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// ============================================================================
// API ROUTES (Unified across Express server & Cloudflare Worker)
// ============================================================================
app.all('/api/auth/register', (req: Request, res: Response) => registerHandler(req, res));
app.all('/api/auth/login', (req: Request, res: Response) => loginHandler(req, res));
app.all('/api/admin/delete-student', (req: Request, res: Response) => deleteStudentHandler(req, res));
app.all('/api/admin/reset-password', (req: Request, res: Response) => resetPasswordHandler(req, res));

// Explicit JSON 404 handler for unmatched /api/* requests (never return HTML for API calls)
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Endpoint API ${req.method} ${req.path} tidak ditemukan pada server.`,
  });
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SPMB Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
