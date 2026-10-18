import React, { useEffect, useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, X, RefreshCw, AlertCircle, LogOut, CheckCircle } from 'lucide-react';
import { dbService } from '../services/supabase';

interface ChangePasswordModalProps {
  /** true = siswa WAJIB mengganti password sementara (dialog tidak bisa ditutup) */
  forced: boolean;
  nik?: string;
  /** Dipanggil setelah siswa menekan "Lanjutkan" setelah berhasil mengganti password */
  onChanged: () => void;
  /** Hanya untuk mode sukarela */
  onClose?: () => void;
  /** Tombol keluar pada mode wajib */
  onLogout?: () => void;
}

const COMMON_PASSWORDS = [
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'admin123',
  'qwertyui',
  'qwerty123',
  'indonesia',
  'smkmuhiba',
];

const validatePassword = (pw: string, nik?: string): string | null => {
  if (pw.length < 8) return 'Password minimal 8 karakter.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password harus mengandung huruf dan angka.';
  const lower = pw.toLowerCase();
  if (COMMON_PASSWORDS.includes(lower) || lower.startsWith('muhiba@')) {
    return 'Password terlalu mudah ditebak. Gunakan kombinasi lain.';
  }
  if (nik && pw.includes(nik)) return 'Password tidak boleh memuat NIK.';
  if (/^Mhb@[0-9a-f]{12}$/i.test(pw)) return 'Gunakan password baru yang berbeda dari password sementara.';
  return null;
};

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  forced,
  nik,
  onChanged,
  onClose,
  onLogout,
}) => {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (forced || done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [forced, done, loading, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    const problem = validatePassword(pw, nik);
    if (problem) {
      setError(problem);
      return;
    }
    if (pw !== pw2) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      await dbService.changeMyPassword(pw);
      setPw('');
      setPw2('');
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Gagal mengganti password. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ganti password"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-7 relative my-8">
        {!forced && !done && (
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Tutup"
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {done ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Password berhasil diganti</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Gunakan password baru Anda saat login berikutnya. Jangan bagikan password kepada siapa pun,
              termasuk panitia.
            </p>
            <button
              type="button"
              onClick={onChanged}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors"
            >
              Lanjutkan
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 shrink-0 rounded-full bg-blue-100 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  {forced ? 'Ganti password sementara' : 'Ganti password'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {forced
                    ? 'Password Anda baru direset oleh panitia. Demi keamanan akun, buat password baru yang hanya Anda ketahui.'
                    : 'Buat password baru untuk akun Anda.'}
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password baru</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={show ? 'text' : 'password'}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="w-full pl-9 pr-10 py-2.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 bg-white"
                  placeholder="Minimal 8 karakter, huruf dan angka"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ulangi password baru</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={show ? 'text' : 'password'}
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 bg-white"
                  placeholder="Ketik ulang password baru"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              {forced ? (
                onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    disabled={loading}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar</span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg"
                >
                  Batal
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !pw || !pw2}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center justify-center gap-2"
              >
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{loading ? 'Menyimpan...' : 'Simpan password baru'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
