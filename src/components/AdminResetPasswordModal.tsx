import React, { useEffect, useState } from 'react';
import { KeyRound, X, RefreshCw, AlertCircle, Copy, Check, MessageCircle, ShieldAlert } from 'lucide-react';
import { Student } from '../types/database';
import { dbService } from '../services/supabase';

interface AdminResetPasswordModalProps {
  student: Student;
  onClose: () => void;
  /** Dipanggil saat dialog ditutup setelah reset berhasil (untuk menyegarkan Log Aktivitas) */
  onDone: () => void;
}

type ResetResult = Awaited<ReturnType<typeof dbService.resetStudentPassword>>;

const toWaNumber = (no: string): string => {
  const d = (no || '').replace(/\D/g, '');
  if (d.startsWith('0')) return '62' + d.slice(1);
  if (d.startsWith('62')) return d;
  return '62' + d;
};

export const AdminResetPasswordModal: React.FC<AdminResetPasswordModalProps> = ({ student, onClose, onDone }) => {
  const [nomor, setNomor] = useState('');
  const [wa, setWa] = useState('');
  const [tgl, setTgl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => {
    if (loading) return;
    const wasDone = !!result;
    setResult(null); // hapus password dari memori tampilan
    if (wasDone) onDone();
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, result]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (!nomor.trim() || !wa.trim() || !tgl.trim()) {
      setError('Nomor pendaftaran, nomor WhatsApp, dan tanggal lahir pemohon wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const res = await dbService.resetStudentPassword(
        { user_id: student.user_id, nik: student.nik },
        { nomor_pendaftaran: nomor.trim(), no_wa: wa.trim(), tanggal_lahir: tgl.trim() }
      );
      setResult(res);
      setNomor('');
      setWa('');
      setTgl('');
    } catch (err: any) {
      setError(err?.message || 'Gagal mereset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.temporaryPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Tidak bisa menyalin otomatis. Salin password secara manual.');
    }
  };

  const waLink = result
    ? `https://wa.me/${toWaNumber(result.no_wa)}?text=${encodeURIComponent(
        `Assalamu'alaikum Warahmatullahi Wabarakatuh. Yth. ${result.nama_lengkap} (No. Pendaftaran: ${result.nomor_pendaftaran}).\n\n` +
          `Atas permintaan Anda, password akun SPMB SMK Muhammadiyah Bawang telah direset.\n` +
          `Username: NIK Anda\n` +
          `Password sementara: ${result.temporaryPassword}\n\n` +
          `Silakan login lalu segera ganti password Anda. Jangan bagikan password ini kepada siapa pun. Terima kasih.\n` +
          `- Panitia SPMB SMK Muhammadiyah Bawang`
      )}`
    : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reset password pendaftar"
      className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 sm:p-7 relative my-8">
        <button
          type="button"
          onClick={close}
          disabled={loading}
          aria-label="Tutup"
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div className="w-10 h-10 shrink-0 rounded-full bg-amber-100 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Reset password pendaftar</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-semibold text-slate-700">{student.nama_lengkap}</span> &middot; NIK {student.nik}
            </p>
          </div>
        </div>

        {result ? (
          <div className="mt-5 space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-xs font-semibold text-emerald-800 mb-2">Password sementara (hanya tampil sekali)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-white border border-emerald-200 rounded-md text-sm font-mono font-bold text-slate-900 break-all select-all">
                  {result.temporaryPassword}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-2 text-xs font-bold text-emerald-700 border border-emerald-300 hover:bg-emerald-100 rounded-md inline-flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>

            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Kirim ke WhatsApp terdaftar ({result.no_wa})</span>
            </a>

            <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>Kirim password hanya ke nomor WhatsApp yang terdaftar. Jangan ke nomor lain.</li>
              <li>Siswa diwajibkan mengganti password saat login pertama.</li>
              <li>
                {result.sessionsRevoked
                  ? 'Sesi login lama sudah dicabut.'
                  : 'Sesi login lama belum berhasil dicabut (periksa fungsi revoke_user_sessions di Supabase).'}
              </li>
              {!result.logged && <li className="text-red-600 font-semibold">Catatan di Log Aktivitas gagal disimpan.</li>}
              <li>Tutup dialog ini untuk menghapus password dari layar.</li>
            </ul>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={close}
              className="w-full py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-lg"
            >
              Selesai
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-relaxed flex gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-1">Verifikasi pemohon dulu</p>
                <ol className="list-decimal pl-4 space-y-0.5">
                  <li>Tanyakan nomor pendaftaran dan nomor WhatsApp yang didaftarkan.</li>
                  <li>
                    <strong>Ketik</strong> jawaban pemohon di bawah (jangan disalin dari layar). Sistem
                    mencocokkannya dengan data pendaftaran.
                  </li>
                  <li>Password sementara hanya boleh dikirim ke nomor WhatsApp yang terdaftar.</li>
                </ol>
                <p className="mt-1.5">Batas 3 kali reset per pendaftar per 24 jam. Semua percobaan tercatat di Log Aktivitas.</p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nomor pendaftaran (kata pemohon) *
              </label>
              <input
                type="text"
                value={nomor}
                onChange={(e) => setNomor(e.target.value)}
                autoComplete="off"
                className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nomor WhatsApp terdaftar (kata pemohon) *
              </label>
              <input
                type="tel"
                value={wa}
                onChange={(e) => setWa(e.target.value)}
                autoComplete="off"
                inputMode="tel"
                className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tanggal lahir pemohon * (wajib)
              </label>
              <input
                type="date"
                required
                value={tgl}
                onChange={(e) => setTgl(e.target.value)}
                className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-800 bg-white"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Wajib diisi sesuai tanggal lahir yang tercatat di akun siswa untuk keamanan.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={close}
                disabled={loading}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                <span>{loading ? 'Memverifikasi...' : 'Verifikasi & reset password'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
