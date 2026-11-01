import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { dbService } from '../services/supabase';
import { User, Student } from '../types/database';
import { AlertCircle, Lock, User as UserIcon, Phone, ArrowLeft, ShieldCheck, HelpCircle, Loader2 } from 'lucide-react';

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
  const shouldReduceMotion = useReducedMotion();

  // Cloudflare Turnstile: wajib karena CAPTCHA Supabase Auth aktif (token sekali pakai)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tryRender = () => {
      if (cancelled || !turnstileContainerRef.current) return;
      const ts = (window as any).turnstile;
      if (!ts) {
        if (tries++ < 50) timer = setTimeout(tryRender, 200);
        return;
      }
      try {
        turnstileWidgetIdRef.current = ts.render(turnstileContainerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
        });
      } catch (e) {
        console.warn('Turnstile render warning:', e);
      }
    };
    tryRender();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      try {
        const ts = (window as any).turnstile;
        if (ts && turnstileWidgetIdRef.current) ts.remove(turnstileWidgetIdRef.current);
      } catch {}
      turnstileWidgetIdRef.current = null;
    };
  }, [siteKey]);

  const resetTurnstile = () => {
    setTurnstileToken('');
    try {
      const ts = (window as any).turnstile;
      if (ts && turnstileWidgetIdRef.current) ts.reset(turnstileWidgetIdRef.current);
    } catch {}
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

    if (siteKey && !turnstileToken) {
      setErrorMessage('Selesaikan verifikasi keamanan (CAPTCHA) terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await dbService.login(usernameNik, password, turnstileToken || undefined);
      onSuccessLogin(res.user, res.student);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login gagal. Periksa kembali NIK dan password.');
      resetTurnstile();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 flex flex-col justify-center relative">
      <div className="max-w-4xl mx-auto w-full space-y-6">

        {/* Top bar with back to home */}
        <motion.div 
          initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-sm ring-1 ring-white/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-800 tracking-tight">
                PORTAL MASUK PESERTA DIDIK
              </h1>
              <p className="text-xs text-slate-500 font-medium">SMK Muhammadiyah Bawang</p>
            </div>
          </div>

          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
            whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.97] rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Web</span>
          </motion.button>
        </motion.div>

        {/* Login Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Left card: Form Login Masuk */}
          <motion.div 
            initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="md:col-span-7 bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-8"
          >
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] font-bold text-indigo-700 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>SPMB 2026 / 2027</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Masuk ke Akun Pendaftaran
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Masukkan 16 digit NIK atau Nomor Pendaftaran dan password Anda.
              </p>
            </div>

            {errorMessage && (
              <motion.div 
                initial={shouldReduceMotion ? false : { x: -6, opacity: 0 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { x: [-6, 6, -4, 4, 0], opacity: 1 }}
                transition={{ duration: 0.25 }}
                className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nomor Pendaftaran / NIK
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={usernameNik}
                    onChange={(e) => setUsernameNik(e.target.value)}
                    placeholder="Contoh: 3325123456780001"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 text-slate-800 bg-slate-50/50 transition-all duration-200 focus-visible:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kata Sandi (Password)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 text-slate-800 bg-slate-50/50 transition-all duration-200 focus-visible:outline-none"
                  />
                </div>
              </div>

              {siteKey && <div ref={turnstileContainerRef} className="pt-1" />}

              <div className="text-[11px] text-slate-500 space-y-1 pt-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p>• Gunakan <strong>NIK 16 digit</strong> atau nomor pendaftaran resmi sebagai username.</p>
                <p>
                  • Lupa password? Hubungi panitia via kontak WhatsApp di samping dengan menyebutkan nomor pendaftaran.
                </p>
              </div>

              <div className="pt-2">
                <motion.button
                  whileTap={shouldReduceMotion || isLoading ? undefined : { scale: 0.96 }}
                  whileHover={shouldReduceMotion || isLoading ? undefined : { scale: 1.01 }}
                  type="submit"
                  disabled={isLoading || (!!siteKey && !turnstileToken)}
                  className="w-full py-3.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-indigo-700 active:brightness-95 rounded-xl shadow-md shadow-indigo-500/20 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memverifikasi Akun...</span>
                    </>
                  ) : (
                    <span>Masuk ke Dashboard</span>
                  )}
                </motion.button>
              </div>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={onNavigateRegister}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors active:scale-[0.98] py-1 px-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Belum punya akun? <span className="underline">Daftar Sekarang di Sini</span>
              </button>
            </div>
          </motion.div>

          {/* Right card: Info & Kontak Panitia */}
          <motion.div 
            initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: shouldReduceMotion ? 0 : 0.08 }}
            className="md:col-span-5 bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-7 space-y-5"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Bantuan & Kontak Panitia
              </h3>
            </div>

            <div className="space-y-3">
              <motion.div 
                whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-100 bg-slate-50/80 transition-all duration-150 hover:shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-bold">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900">EDI SETIANTO</p>
                  <p className="text-[11px] text-slate-500">Panitia PPDB</p>
                  <a
                    href="https://wa.me/628561333392?text=Assalamu%27alaikum%20Warahmatullahi%20Wabarakatuh.%20Yth.%20Bapak%20Edi%20Setianto%20(Panitia%20PPDB%20SMK%20Muhammadiyah%20Bawang)%2C%20perkenalkan%20saya%20ingin%20menanyakan%20informasi%20mengenai%20pendaftaran%20dan%20akun%20login%20siswa.%20Terima%20kasih."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 active:scale-[0.97] transition-all mt-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>0856-1333-392</span>
                  </a>
                </div>
              </motion.div>

              <motion.div 
                whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-100 bg-slate-50/80 transition-all duration-150 hover:shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-bold">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900">SUGI HARNOTO</p>
                  <p className="text-[11px] text-slate-500">Panitia PPDB</p>
                  <a
                    href="https://wa.me/6285741977501?text=Assalamu%27alaikum%20Warahmatullahi%20Wabarakatuh.%20Yth.%20Bapak%20Sugi%20Harnoto%20(Panitia%20PPDB%20SMK%20Muhammadiyah%20Bawang)%2C%20perkenalkan%20saya%20ingin%20menanyakan%20informasi%20mengenai%20alur%20pendaftaran%20dan%20akun%20login%20siswa.%20Terima%20kasih."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 active:scale-[0.97] transition-all mt-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>0857-4197-7501</span>
                  </a>
                </div>
              </motion.div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/60 text-xs text-amber-900 leading-relaxed">
              <p className="font-bold mb-1">Catatan Penting:</p>
              <p>Simpan username dan password Anda dengan aman untuk melengkapi berkas pendaftaran, konfirmasi pembayaran, serta melihat pengumuman seleksi.</p>
            </div>
          </motion.div>

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
              className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:scale-[0.97] text-indigo-700 font-bold rounded-xl text-xs transition-all duration-150 border border-indigo-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              smkmuhiba.sch.id
            </a>
            <span className="text-[11px] text-slate-400">
              © 2026 SPMB SMK MUHIBA
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
