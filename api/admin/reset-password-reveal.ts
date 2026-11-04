import { createClient } from '@supabase/supabase-js';
import { applyCors } from '../../server/corsHelper';
import { authenticateAdmin, decryptSecret, isUuid } from '../../server/security';

// Vercel / Cloudflare Worker / Express: POST /api/admin/reset-password-reveal
//
// Mengambil password sementara HASIL reset SEKALI SAJA.
//   - Hanya admin yang MEMBUAT rahasia tersebut (actor_id harus sama dengan pemanggil).
//   - Berlaku singkat (expires_at), dikonsumsi secara atomik, ciphertext dikosongkan setelah dipakai.
//   - Password tidak pernah dicatat di log; respons bersifat no-store.
export default async function handler(req: any, res: any) {
  if (!applyCors(req, res)) {
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metode tidak diizinkan.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ success: false, message: 'Konfigurasi server belum lengkap.' });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const auth = await authenticateAdmin(req, supabaseAdmin);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ success: false, message: 'Request tidak dapat diproses' });
      }
    }

    const secretId = typeof body?.secret_id === 'string' ? body.secret_id.trim() : '';
    if (!isUuid(secretId)) {
      return res.status(400).json({ success: false, message: 'Request tidak dapat diproses' });
    }

    const gone = () =>
      res.status(410).json({
        success: false,
        message: 'Password sementara sudah kedaluwarsa atau sudah pernah ditampilkan. Ulangi reset password.',
      });

    const nowIso = new Date().toISOString();

    // 1. Ambil ciphertext (hanya milik admin pemanggil, belum dipakai, belum kedaluwarsa)
    const { data: row, error: selErr } = await supabaseAdmin
      .from('password_reset_secrets')
      .select('id, target_user_id, ciphertext')
      .eq('id', secretId)
      .eq('actor_id', auth.callerId)
      .is('consumed_at', null)
      .gt('expires_at', nowIso)
      .maybeSingle();

    if (selErr) {
      console.error('[Reset Reveal] Gagal membaca rahasia:', selErr.message);
      return res.status(503).json({ success: false, message: 'Layanan sementara tidak tersedia.' });
    }
    if (!row?.ciphertext) {
      return gone();
    }

    // 2. Konsumsi ATOMIK: hanya satu permintaan yang berhasil menandai consumed_at.
    //    Ciphertext sekaligus dikosongkan agar tidak tersisa di database.
    const { data: consumed, error: consumeErr } = await supabaseAdmin
      .from('password_reset_secrets')
      .update({ consumed_at: nowIso, ciphertext: '' })
      .eq('id', secretId)
      .eq('actor_id', auth.callerId)
      .is('consumed_at', null)
      .select('id')
      .maybeSingle();

    if (consumeErr) {
      console.error('[Reset Reveal] Gagal mengonsumsi rahasia:', consumeErr.message);
      return res.status(503).json({ success: false, message: 'Layanan sementara tidak tersedia.' });
    }
    if (!consumed?.id) {
      return gone(); // kalah balapan: permintaan lain sudah mengambilnya
    }

    // 3. Dekripsi (terikat ke admin + target; gagal bila konteks berbeda)
    let temporaryPassword = '';
    try {
      temporaryPassword = await decryptSecret(row.ciphertext, `${auth.callerId}:${row.target_user_id}`);
    } catch (decErr: any) {
      console.error('[Reset Reveal] Dekripsi gagal:', decErr?.message);
      return res.status(500).json({
        success: false,
        message: 'Password sementara tidak dapat ditampilkan. Ulangi reset password.',
      });
    }

    return res.status(200).json({ success: true, temporaryPassword });
  } catch (err: any) {
    console.error('[Reset Reveal] Unexpected error:', err?.message);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
}
