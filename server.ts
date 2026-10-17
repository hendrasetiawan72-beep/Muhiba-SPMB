import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleLogin, handleRegister, handleDeleteStudent } from './server/authHandlers';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

/**
 * Health check endpoint (Item 13)
 */
app.get('/api/auth/status', (_req: Request, res: Response) => {
  res.json({ success: true });
});

/**
 * Endpoint: POST /api/auth/register
 */
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const result = await handleRegister(req.body);
  res.status(result.statusCode).json(result.body);
});

/**
 * Endpoint: POST /api/auth/login
 */
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const result = await handleLogin(req.body);
  res.status(result.statusCode).json(result.body);
});

/**
 * Endpoint: POST /api/admin/delete-student
 */
app.post('/api/admin/delete-student', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const result = await handleDeleteStudent(authHeader, req.body);
  res.status(result.statusCode).json(result.body);
});

// Explicit JSON 404 handler for unmatched /api/* requests
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
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
