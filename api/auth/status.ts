export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasAnonKey = Boolean(
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );

  return res.status(200).json({
    success: true,
    platform: 'vercel-serverless',
    supabaseUrlConfigured: Boolean(supabaseUrl),
    serviceRoleConfigured: hasServiceRole,
    anonKeyConfigured: hasAnonKey,
    timestamp: new Date().toISOString(),
  });
}
