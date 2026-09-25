import React, { useState } from 'react';
import { dbService } from '../services/supabase';
import { User, Student } from '../types/database';
import { AlertCircle, Lock, User as UserIcon, Phone, ArrowLeft, ShieldAlert } from 'lucide-react';

interface LoginPageProps {
  onSuccessLogin: (user: User, student?: Student) => void;
  onNavigateRegister: () => void;
  onNavigateHome: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccessLogin,
  onNavigateRegister,
  onNavigateHome,
}) => {
  const [usernameNik, setUsernameNik] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!usernameNik.trim()) {
      setErrorMessage('Nomor Pendaftaran / NIK wajib diisi.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Password wajib diisi.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await dbService.login(usernameNik, password);
      onSuccessLogin(res.user, res.student);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login gagal. Periksa kembali NIK dan password.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoStudent = () => {
    setUsernameNik('3325028202892999');
    setPassword('12345');
    setErrorMessage('');
  };

  const fillDemoAdmin = () => {
    setUsernameNik('admin');
    setPassword('admin123');
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="max-w-4xl mx-auto w-full space-y-6">

        {/* Top bar with back to home */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 sm:p-5 flex items-center justify-between">
          <h1 className="text-base sm:text-lg font-bold text-slate-800">
            SELAMAT DATANG CALON PESERTA DIDIK
          </h1>
          <button
            onClick={onNavigateHome}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors uppercase tracking-wider"
          >
            MASUK KE WEB
          </button>
        </div>

        {/* Login Cards Grid (Exact match to Screenshot 8) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Left card: LOGIN MASUK (Screenshot 8) */}
          <div className="md:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
            <h2 className="text-sm font-extrabold text-slate-800 tracking-wider uppercase mb-6 pb-2 border-b border-slate-100">
              LOGIN MASUK
            </h2>

            {errorMessage && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Masukan No Pendaftaran / NIK
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={usernameNik}
                    onChange={(e) => setUsernameNik(e.target.value)}
                    placeholder="username"
                    className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Masukan Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 bg-white"
                  />
                </div>
              </div>

              <div className="text-[11px] text-slate-500 space-y-1 pt-1">
                <p>* Masukan sesuai username dan password yang diberikan</p>
                <p>* jika belum dapat password silahkan hubungi panitia</p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Memverifikasi...' : 'Masuk'}
                </button>
              </div>
            </form>

            {/* Quick Demo Login Fillers */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                Tombol Uji Coba Cepat (Demo):
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={fillDemoStudent}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-semibold transition-colors border border-blue-200"
                >
                  Demo Siswa: Eko Juniarto
                </button>
                <button
                  type="button"
                  onClick={fillDemoAdmin}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-semibold transition-colors border border-slate-300"
                >
                  Demo Admin PPDB: admin
                </button>
              </div>
            </div>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={onNavigateRegister}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                Belum punya akun? Daftar Sekarang disini
              </button>
            </div>
          </div>

          {/* Right card: Info Lebih Lanjut (Screenshot 8) */}
          <div className="md:col-span-5 bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 sm:p-7 space-y-5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Info Lebih Lanjut
            </h3>

            <div className="space-y-4">
              <div className="flex items-center gap-3.5 p-3 rounded-lg border border-slate-100 bg-slate-50/70">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">EDI SETIANTO</p>
                  <a
                    href="https://wa.me/628561333392"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <Phone className="w-3 h-3" />
                    <span>08561333392</span>
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3.5 p-3 rounded-lg border border-slate-100 bg-slate-50/70">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">SUGI HARNOTO</p>
                  <a
                    href="https://wa.me/6285741977501"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <Phone className="w-3 h-3" />
                    <span>085741977501</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-amber-50/70 border border-amber-200/60 text-xs text-amber-800 leading-relaxed">
              <p className="font-bold mb-1">Penting:</p>
              <p>Simpan username dan password Anda baik-baik untuk login ke sistem, cek pengumuman seleksi, dan melengkapi berkas pendaftaran.</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
