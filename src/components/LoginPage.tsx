import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { dbService } from '../services/supabase';
import { User, Student } from '../types/database';
import { AlertCircle, Lock, User as UserIcon, Phone, ArrowLeft, ArrowRight, ShieldCheck, HelpCircle, Loader2, Eye, EyeOff, MapPin, ExternalLink, Info } from 'lucide-react';
import { Hero, Stagger, PanelTitle, itemVariants } from './ui/kit';

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
  const [showPassword, setShowPassword] = useState(false);
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

  const fieldBase =
    'peer w-full h-14 pl-12 pr-4 rounded-2xl border-2 border-slate-200 bg-slate-50/80 text-base text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';
  const iconBase =
    'pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors duration-200 peer-focus:text-indigo-600';

  return (
    <div className="ui-scope ui-page px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pt-8">
      <div className="mx-auto w-full max-w-5xl space-y-5">

        <Hero
          chip="SPMB 2026 / 2027"
          title="Masuk ke Akun Pendaftaran"
          subtitle="Gunakan 16 digit NIK atau nomor pendaftaran, lalu masukkan kata sandi Anda."
          actions={
            <motion.button
              type="button"
              whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
              onClick={onNavigateHome}
              className="ui-cta ui-cta--ghost !px-5 !py-3 !text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Web</span>
            </motion.button>
          }
        />

        <Stagger className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">

          {/* Kartu form masuk */}
          <motion.div variants={itemVariants} className="ui-panel p-5 sm:p-8 lg:col-span-7">
            <div className="mb-6 flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-[0_14px_24px_-12px_rgba(91,61,240,.9)]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-tight tracking-tight text-slate-900 sm:text-xl">Portal Masuk Peserta Didik</h2>
                <p className="text-sm text-slate-500">SMK Muhammadiyah Bawang</p>
              </div>
            </div>

            {errorMessage && (
              <motion.div
                role="alert"
                initial={shouldReduceMotion ? false : { x: -6, opacity: 0 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { x: [-6, 6, -4, 4, 0], opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-nik" className="mb-2 block text-sm font-semibold text-slate-700">
                  Nomor Pendaftaran / NIK
                </label>
                <div className="relative">
                  <input
                    id="login-nik"
                    type="text"
                    required
                    autoComplete="username"
                    value={usernameNik}
                    onChange={(e) => setUsernameNik(e.target.value)}
                    placeholder="Contoh: 3325123456780001"
                    className={fieldBase}
                  />
                  <UserIcon className={iconBase} />
                </div>
              </div>

              <div>
                <label htmlFor="login-pass" className="mb-2 block text-sm font-semibold text-slate-700">
                  Kata Sandi (Password)
                </label>
                <div className="relative">
                  <input
                    id="login-pass"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className={`${fieldBase} !pr-14`}
                  />
                  <Lock className={iconBase} />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    aria-pressed={showPassword}
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-100 hover:text-indigo-600 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {siteKey && <div ref={turnstileContainerRef} className="pt-1" />}

              <div className="flex gap-3 rounded-2xl bg-indigo-50/80 p-4 text-[13px] leading-relaxed text-slate-600">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <div className="space-y-1">
                  <p>Gunakan <strong className="text-slate-800">NIK 16 digit</strong> atau nomor pendaftaran resmi sebagai username.</p>
                  <p>Lupa password? Hubungi panitia via kontak WhatsApp dengan menyebutkan nomor pendaftaran.</p>
                </div>
              </div>

              <motion.button
                whileTap={shouldReduceMotion || isLoading ? undefined : { scale: 0.97 }}
                type="submit"
                disabled={isLoading || (!!siteKey && !turnstileToken)}
                className="ui-shine group flex h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 text-base font-bold text-white shadow-[0_22px_36px_-18px_rgba(91,61,240,.95)] transition-[filter,box-shadow] duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 disabled:pointer-events-none disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Memverifikasi Akun...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Dashboard</span>
                    <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
                  </>
                )}
              </motion.button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-5 text-center">
              <button
                type="button"
                onClick={onNavigateRegister}
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Belum punya akun? <span className="font-bold text-indigo-600 underline decoration-indigo-300 underline-offset-4">Daftar sekarang</span>
              </button>
            </div>
          </motion.div>

          {/* Kartu bantuan & kontak */}
          <motion.div variants={itemVariants} className="ui-panel space-y-5 p-5 sm:p-7 lg:col-span-5">
            <PanelTitle title="Bantuan & Kontak Panitia" />

            <div className="space-y-3">
              {[
                { name: 'EDI SETIANTO', initials: 'ES', tone: 'from-blue-500 to-indigo-600', tel: '0856-1333-392', href: 'https://wa.me/628561333392?text=Assalamu%27alaikum%20Warahmatullahi%20Wabarakatuh.%20Yth.%20Bapak%20Edi%20Setianto%20(Panitia%20PPDB%20SMK%20Muhammadiyah%20Bawang)%2C%20perkenalkan%20saya%20ingin%20menanyakan%20informasi%20mengenai%20pendaftaran%20dan%20akun%20login%20siswa.%20Terima%20kasih.' },
                { name: 'SUGI HARNOTO', initials: 'SH', tone: 'from-amber-400 to-orange-500', tel: '0857-4197-7501', href: 'https://wa.me/6285741977501?text=Assalamu%27alaikum%20Warahmatullahi%20Wabarakatuh.%20Yth.%20Bapak%20Sugi%20Harnoto%20(Panitia%20PPDB%20SMK%20Muhammadiyah%20Bawang)%2C%20perkenalkan%20saya%20ingin%20menanyakan%20informasi%20mengenai%20alur%20pendaftaran%20dan%20akun%20login%20siswa.%20Terima%20kasih.' },
              ].map((c) => (
                <motion.div
                  key={c.name}
                  whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                  className="rounded-3xl border border-slate-100 bg-slate-50/80 p-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${c.tone} text-sm font-extrabold text-white shadow-md`}>
                      {c.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">Panitia PPDB</p>
                    </div>
                  </div>
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-semibold text-white shadow-[0_14px_24px_-14px_rgba(16,185,129,.9)] transition-all hover:bg-emerald-600 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                  >
                    <Phone className="h-4 w-4" />
                    <span>{c.tel}</span>
                  </a>
                </motion.div>
              ))}
            </div>

            <div className="ui-tile text-left" data-tone="amber" style={{ padding: '1rem 1.1rem 1.15rem', textAlign: 'left' }}>
              <p className="mb-1 text-sm font-bold">Catatan Penting</p>
              <p className="text-[13px] leading-relaxed">
                Simpan username dan password Anda dengan aman untuk melengkapi berkas pendaftaran, konfirmasi pembayaran, serta melihat pengumuman seleksi.
              </p>
            </div>
          </motion.div>
        </Stagger>

        {/* Info sekolah */}
        <div className="flex flex-col items-center justify-between gap-4 px-2 pt-2 text-center sm:flex-row sm:text-left">
          <div className="flex items-start gap-2.5 text-slate-500">
            <MapPin className="mt-0.5 hidden h-4 w-4 shrink-0 text-indigo-400 sm:block" />
            <div>
              <p className="text-sm font-semibold text-slate-700">SMK Muhammadiyah Bawang</p>
              <p className="mt-0.5 text-xs leading-relaxed">
                Jl. Raya Bawang - Sukorejo KM 01, Jlamprang, Bawang, Kabupaten Batang, Jawa Tengah 51274
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 sm:items-end">
            <a
              href="https://www.smkmuhiba.sch.id"
              target="_blank"
              rel="noopener noreferrer"
              className="ui-linkpill !py-2 !text-xs"
            >
              <span>smkmuhiba.sch.id</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <span className="text-[11px] text-slate-400">© 2026 SPMB SMK MUHIBA</span>
          </div>
        </div>

      </div>
    </div>
  );
};
