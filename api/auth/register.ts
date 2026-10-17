import { handleRegister } from '../../server/authHandlers';

// Vercel Serverless Function: POST /api/auth/register
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

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

  const result = await handleRegister(req.body);
  return res.status(result.statusCode).json(result.body);
}
