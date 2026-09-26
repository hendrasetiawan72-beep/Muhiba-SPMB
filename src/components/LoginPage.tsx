import React, { useState } from 'react';
import { dbService, SUPABASE_SQL_SCHEMA } from '../services/supabase';
import { User, Student } from '../types/database';
import { AlertCircle, Lock, User as UserIcon, Phone, ArrowLeft, ShieldAlert, Database, X, Check, Copy } from 'lucide-react';

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

  // Supabase connection modal
  const [showDbModal, setShowDbModal] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState(() => dbService.getStoredSupabaseConfig().url);
  const [supabaseKey, setSupabaseKey] = useState(() => dbService.getStoredSupabaseConfig().key);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  const handleSaveDbConfig = () => {
    dbService.saveSupabaseConfig(supabaseUrl.trim(), supabaseKey.trim());
    setSaveToast(true);
    setErrorMessage('');
    setTimeout(() => {
      setSaveToast(false);
      setShowDbModal(false);
    }, 1200);
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

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

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="max-w-4xl mx-auto w-full space-y-6">

        {/* Top bar with back to home */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 sm:p-5 flex items-center justify-between">
          <h1 className="text-base sm:text-lg font-bold text-slate-800">
            SELAMAT DATANG CALON PESERTA DIDIK
          </h1>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowDbModal(true)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-colors cursor-pointer ${
                dbService.isSupabaseConnected()
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
              }`}
              title="Konfigurasi Database Supabase"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {dbService.isSupabaseConnected() ? 'Supabase Terhubung' : 'Setup Supabase'}
              </span>
            </button>
            <button
              onClick={onNavigateHome}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors uppercase tracking-wider"
            >
              MASUK KE WEB
            </button>
          </div>
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
                <div className="flex-1 space-y-2">
                  <div>{errorMessage}</div>
                  {errorMessage.includes('Supabase') && (
                    <button
                      type="button"
                      onClick={() => setShowDbModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold shadow-sm transition-colors cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Hubungkan Supabase Sekarang</span>
                    </button>
                  )}
                </div>
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

            <div className="mt-8 text-center">
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

        {/* Footer info & website */}
        <div className="pt-4 border-t border-slate-200/80 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            <p className="font-semibold text-slate-700">SMK Muhammadiyah Bawang</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Jl. Raya Bawang - Sukorejo KM 01, Jlamprang, Bawang, Kabupaten Batang, Jawa Tengah 51274
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <a
              href="https://www.smkmuhiba.sch.id"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded text-xs transition-colors border border-blue-200"
            >
              Kunjungi Web Sekolah (smkmuhiba.sch.id)
            </a>
            <span className="text-[11px] text-slate-400">
              Copyright © 2026 by @hndx07
            </span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL SETUP KONEKSI SUPABASE LANGSUNG DARI HALAMAN LOGIN */}
      {/* ========================================================================= */}
      {showDbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 sm:p-8 relative my-8 animate-in fade-in duration-200 space-y-5">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                  Database & Autentikasi Cloud
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  Konfigurasi Koneksi Supabase
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDbModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Masukkan <strong>Project URL</strong> dan <strong>Anon Key / Publishable Key</strong> dari dashboard project Supabase Anda (Settings &gt; API).
            </p>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Supabase Anon Key / Publishable Key
                </label>
                <input
                  type="password"
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveDbConfig}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-md shadow-sm transition-colors cursor-pointer"
                >
                  {saveToast ? 'Tersimpan & Terhubung!' : 'Simpan & Hubungkan'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDbModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>

            {/* SQL Script Viewer */}
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase">
                  Skema SQL (Jalankan di Supabase SQL Editor)
                </h4>
                <button
                  type="button"
                  onClick={handleCopySchema}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedSchema ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSchema ? 'Tersalin!' : 'Salin SQL'}</span>
                </button>
              </div>

              <pre className="bg-slate-900 text-emerald-400 p-3.5 rounded-lg text-[10px] font-mono overflow-x-auto max-h-40 leading-relaxed">
                {SUPABASE_SQL_SCHEMA}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
