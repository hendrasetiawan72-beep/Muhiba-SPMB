import React, { useState } from 'react';
import { 
  Building2, 
  BookMarked, 
  Users, 
  CheckCircle, 
  FileText, 
  Phone, 
  Printer, 
  ArrowRight, 
  Lock, 
  User, 
  CreditCard, 
  AlertCircle,
  X,
  Check,
  ShieldAlert,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Hero, Stagger, StatCard, SegTabs, ViewTransition, PanelTitle, CountUp, itemVariants } from './ui/kit';
import { dbService } from '../services/supabase';
import { Student, User as UserType, JurusanType } from '../types/database';

interface RegistrationPortalProps {
  onSuccessRegister: (user: UserType, student: Student) => void;
  onNavigateLogin: () => void;
  onNavigateHome: () => void;
}

// ---------------------------------------------------------------------------
// Hook widget Cloudflare Turnstile (dengan status yang terlihat oleh pengguna)
// status: idle | loading | ready | error ; token hanya berlaku sekali -> reset()
// ---------------------------------------------------------------------------
type TsStatus = 'idle' | 'loading' | 'ready' | 'error';

function useTurnstile(active: boolean) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  const [token, setToken] = React.useState('');
  const [status, setStatus] = React.useState<TsStatus>('idle');
  const [errorCode, setErrorCode] = React.useState('');
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!siteKey || !active) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    setStatus('loading');
    setErrorCode('');
    setToken('');

    const fail = (code: string) => {
      if (cancelled) return;
      setToken('');
      setErrorCode(code);
      setStatus('error');
    };

    const tryRender = () => {
      if (cancelled) return;
      if (!containerRef.current) {
        if (tries++ < 20) timer = setTimeout(tryRender, 100);
        else fail('no_container');
        return;
      }
      const ts = (window as any).turnstile;
      if (!ts) {
        // Skrip api.js (async defer) mungkin belum selesai dimuat / diblokir
        if (tries++ < 75) timer = setTimeout(tryRender, 200);
        else fail('script_blocked');
        return;
      }
      try {
        widgetIdRef.current = ts.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (t: string) => {
            if (cancelled) return;
            setToken(t);
            setErrorCode('');
            setStatus('ready');
          },
          'expired-callback': () => {
            setToken('');
            setStatus('loading');
          },
          'timeout-callback': () => {
            setToken('');
            setStatus('loading');
          },
          'error-callback': (code?: unknown) => {
            fail(String(code ?? 'error'));
            return true;
          },
          'unsupported-callback': () => fail('unsupported'),
        });
      } catch (e) {
        console.warn('Turnstile render warning:', e);
        fail('render_failed');
      }
    };
    tryRender();

    // Pengaman: bila 25 detik belum ada token, tampilkan pesan + tombol "Coba lagi"
    const watchdog = setTimeout(() => {
      if (!cancelled) {
        setStatus((s) => (s === 'ready' ? s : 'error'));
        setErrorCode((c) => c || 'timeout');
      }
    }, 25000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearTimeout(watchdog);
      try {
        const ts = (window as any).turnstile;
        if (ts && widgetIdRef.current) ts.remove(widgetIdRef.current);
      } catch {}
      widgetIdRef.current = null;
      setToken('');
    };
  }, [siteKey, active, attempt]);

  const reset = React.useCallback(() => {
    setToken('');
    setStatus('loading');
    try {
      const ts = (window as any).turnstile;
      if (ts && widgetIdRef.current) ts.reset(widgetIdRef.current);
    } catch {}
  }, []);

  const retry = React.useCallback(() => setAttempt((a) => a + 1), []);

  return { siteKey, containerRef, token, status, errorCode, reset, retry };
}

function turnstileHint(code: string): string {
  if (code === 'script_blocked')
    return 'Skrip keamanan Cloudflare tidak termuat. Matikan pemblokir iklan/pelacak untuk situs ini, periksa koneksi, atau coba browser lain.';
  if (code === 'timeout')
    return 'Verifikasi terlalu lama. Periksa koneksi internet lalu ketuk "Coba lagi".';
  if (/^110(100|110|200|420|500)/.test(code) || code.startsWith('1102'))
    return 'Domain situs ini belum terdaftar di Cloudflare Turnstile. Hubungi panitia/pengelola situs.';
  if (code === 'unsupported')
    return 'Browser tidak mendukung verifikasi keamanan. Gunakan Chrome atau Firefox versi terbaru.';
  return 'Verifikasi keamanan gagal dimuat. Ketuk "Coba lagi" atau muat ulang halaman.';
}

// ---------------------------------------------------------------------------
// Validasi NIK (sama dengan aturan di server /api/auth/register)
// ---------------------------------------------------------------------------
const PROVINCE_CODES = new Set([
  '11','12','13','14','15','16','17','18','19','21','31','32','33','34','35','36',
  '51','52','53','61','62','63','64','65','71','72','73','74','75','76','81','82',
  '91','92','93','94','95','96',
]);

function validateNik(nik: string): string | null {
  if (!nik) return 'NIK wajib diisi (16 digit angka sesuai KTP / Kartu Keluarga).';
  if (nik.length < 16) return `NIK belum lengkap: baru ${nik.length} dari 16 digit.`;
  if (/^(\d)\1{15}$/.test(nik)) return 'NIK tidak valid: tidak boleh 16 angka yang sama.';
  if (!PROVINCE_CODES.has(nik.slice(0, 2))) return 'NIK tidak valid: 2 digit pertama (kode provinsi) tidak dikenali.';
  const bln = parseInt(nik.slice(8, 10), 10);
  if (bln < 1 || bln > 12) return 'NIK tidak valid: digit ke-9 dan 10 (bulan lahir) harus 01–12.';
  const tgl = parseInt(nik.slice(6, 8), 10);
  if (!((tgl >= 1 && tgl <= 31) || (tgl >= 41 && tgl <= 71)))
    return 'NIK tidak valid: digit ke-7 dan 8 (tanggal lahir) harus 01–31 (laki-laki) atau 41–71 (perempuan).';
  return null;
}

function passwordStrength(pw: string): { label: string; color: string; width: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (!pw) return { label: '', color: 'bg-slate-200', width: '0%' };
  if (pw.length < 8) return { label: 'Terlalu pendek', color: 'bg-red-500', width: '25%' };
  if (score <= 2) return { label: 'Sedang', color: 'bg-amber-500', width: '60%' };
  return { label: 'Kuat', color: 'bg-emerald-500', width: '100%' };
}

export const RegistrationPortal: React.FC<RegistrationPortalProps> = ({
  onSuccessRegister,
  onNavigateLogin,
  onNavigateHome,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<'info' | 'syarat' | 'kontak'>('info');
  const [showRegisterForm, setShowRegisterForm] = useState<boolean>(false);
  const [alurLoaded, setAlurLoaded] = useState(false);
  const [buktiPendaftaran, setBuktiPendaftaran] = useState<{
    student: Student;
    rawPassword: string;
  } | null>(null);

  // Form states
  const [nik, setNik] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [jurusanPilihan, setJurusanPilihan] = useState<JurusanType>('TO');
  const [noWa, setNoWa] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const nikRef = React.useRef<HTMLInputElement | null>(null);
  const namaRef = React.useRef<HTMLInputElement | null>(null);
  const waRef = React.useRef<HTMLInputElement | null>(null);
  const passRef = React.useRef<HTMLInputElement | null>(null);
  const confirmRef = React.useRef<HTMLInputElement | null>(null);
  const alertRef = React.useRef<HTMLDivElement | null>(null);

  const formTs = useTurnstile(showRegisterForm);

  const touch = (f: string) => setTouched((t) => (t[f] ? t : { ...t, [f]: true }));
  const normalizeWa = (v: string) => v.trim().replace(/[-\s]/g, '');
  const waError = (v: string): string | null => {
    const c = normalizeWa(v);
    if (!c) return 'Nomor WhatsApp wajib diisi.';
    if (!/^(\+?62|0)8[1-9][0-9]{7,12}$/.test(c))
      return 'Nomor WhatsApp tidak valid. Format: 08xxxxxxxxxx atau 628xxxxxxxxxx.';
    return null;
  };
  const passwordError = (v: string): string | null => {
    if (!v) return 'Password wajib diisi.';
    if (v.length < 8) return `Password minimal 8 karakter (sekarang ${v.length}).`;
    const lower = v.toLowerCase();
    if (
      ['12345678', '123456789', '1234567890', 'password', 'admin123', 'qwertyui', 'indonesia', 'smkmuhiba'].includes(lower) ||
      v === nik ||
      lower.startsWith('muhiba@') ||
      (namaLengkap && lower === namaLengkap.trim().toLowerCase())
    )
      return 'Password terlalu mudah ditebak. Gunakan kombinasi huruf dan angka.';
    return null;
  };

  const fieldErrors = {
    nik: validateNik(nik),
    nama: namaLengkap.trim() ? null : 'Nama lengkap wajib diisi.',
    wa: waError(noWa),
    password: passwordError(password),
    confirm: password !== confirmPassword ? 'Konfirmasi password belum sama dengan password.' : null,
  };
  const strength = passwordStrength(password);

  const raiseError = (field: 'nik' | 'nama' | 'wa' | 'password' | 'confirm' | 'captcha', message: string) => {
    setErrorMessage(message);
    const map: Record<string, React.RefObject<HTMLInputElement | null>> = {
      nik: nikRef, nama: namaRef, wa: waRef, password: passRef, confirm: confirmRef,
    };
    window.setTimeout(() => {
      alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      map[field]?.current?.focus({ preventScroll: true });
    }, 30);
  };

  const closeRegisterForm = () => {
    setShowRegisterForm(false);
    setErrorMessage('');
    setTouched({});
    setShowPassword(false);
    setShowConfirm(false);
  };

  const [needsLogin, setNeedsLogin] = useState(false);
  const enterTs = useTurnstile(!!buktiPendaftaran && needsLogin);
  const [isEntering, setIsEntering] = useState(false);
  const [enterError, setEnterError] = useState('');

  React.useEffect(() => {
    if (!buktiPendaftaran) {
      setNeedsLogin(false);
      setEnterError('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const client = dbService.getClient();
        if (!client) return;
        const { data } = await client.auth.getSession();
        if (!cancelled) setNeedsLogin(!data?.session);
      } catch {
        if (!cancelled) setNeedsLogin(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buktiPendaftaran]);

  const alurImageUrl =
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjWidT8Ag5CtNDVGLjtJIQXHWfQnzoKmsl3JXqy_yOzjdlw6GQ9kOCGRg4KFIGTi3avq5jYlh410UldZZxPHISNJfoncMjXVUfzi_AfMCU3mHhqcQlqkkIZP-Z8GPHYt0HwMAOr0h_zfMO5kWQHKy737mvC3JfR3NluDkBSAs5VLJ0-YNQ9HmBXlK6lCfam/s4908/58636.png';
  
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanNik = nik.trim();
    setTouched({ nik: true, nama: true, wa: true, password: true, confirm: true });

    // Urutan pemeriksaan = urutan kolom; berhenti di kolom pertama yang salah
    if (fieldErrors.nik) return raiseError('nik', fieldErrors.nik);
    if (fieldErrors.nama) return raiseError('nama', fieldErrors.nama);
    if (fieldErrors.wa) return raiseError('wa', fieldErrors.wa);
    if (fieldErrors.password) return raiseError('password', fieldErrors.password);
    if (fieldErrors.confirm) return raiseError('confirm', fieldErrors.confirm);

    if (formTs.siteKey && !formTs.token) {
      if (formTs.status === 'error') {
        return raiseError('captcha', `Verifikasi keamanan gagal. ${turnstileHint(formTs.errorCode)}`);
      }
      return raiseError('captcha', 'Verifikasi keamanan (CAPTCHA) masih berjalan. Tunggu beberapa detik sampai muncul tanda centang hijau, lalu tekan tombol lagi.');
    }

    const cleanNoWa = normalizeWa(noWa);

    setIsSubmitting(true);
    try {
      const res = await dbService.register({
        nik: cleanNik,
        nama_lengkap: namaLengkap,
        jurusan_pilihan: jurusanPilihan,
        no_wa: cleanNoWa,
        password: password,
        turnstileToken: formTs.token || undefined,
      });

      setBuktiPendaftaran({
        student: res.student,
        rawPassword: password,
      });
      closeRegisterForm();
    } catch (err: any) {
      formTs.reset();
      if (err.code === 'NIK_EXISTS') {
        setErrorMessage(err.message || 'NIK ini sudah terdaftar. Silakan langsung login.');
      } else if (err.code === 'NIK_INVALID') {
        setErrorMessage('NIK tidak valid. Pastikan 16 digit angka sesuai dokumen resmi.');
      } else if (err.code === 'WEAK_PASSWORD') {
        setErrorMessage(err.message || 'Kata sandi tidak aman.');
      } else if (err.code === 'RATE_LIMITED') {
        setErrorMessage(err.message || 'Terlalu banyak percobaan pendaftaran. Coba lagi beberapa menit lagi.');
      } else if (err.code === 'CAPTCHA_FAILED') {
        setErrorMessage(err.message || 'Verifikasi keamanan Turnstile gagal. Silakan coba lagi.');
      } else {
        setErrorMessage(err.message || 'Gagal mendaftar. Silakan coba kembali.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEnterDashboard = async () => {
    if (!buktiPendaftaran) return;
    setEnterError('');

    if (needsLogin && enterTs.siteKey && !enterTs.token) {
      setEnterError('Selesaikan verifikasi keamanan (CAPTCHA) terlebih dahulu.');
      return;
    }

    setIsEntering(true);
    try {
      const { student, rawPassword } = buktiPendaftaran;
      if (needsLogin) {
        const res = await dbService.login(student.nik, rawPassword, enterTs.token || undefined);
        onSuccessRegister(res.user, res.student || student);
      } else {
        const loggedUser: UserType = {
          id: student.user_id,
          nik: student.nik,
          role: 'student',
          full_name: student.nama_lengkap,
          created_at: new Date().toISOString(),
        };
        onSuccessRegister(loggedUser, student);
      }
    } catch (err: any) {
      setEnterError(
        err?.message || 'Gagal masuk ke dashboard. Silakan login dengan NIK dan password Anda.'
      );
      enterTs.reset();
    } finally {
      setIsEntering(false);
    }
  };

  return (
    <div className="ui-scope ui-page px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pt-8 print:bg-white print:py-0 print:px-0">

      <div className="mx-auto max-w-5xl space-y-5 print:hidden">

        {/* HERO SELAMAT DATANG */}
        <Hero
          chip="Terhubung"
          title="Selamat Datang Calon Peserta Didik"
          subtitle="SPMB SMK Muhammadiyah Bawang • Tahun Ajaran 2026/2027"
          actions={
            <>
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                onClick={() => {
                  setShowRegisterForm(true);
                  setBuktiPendaftaran(null);
                }}
                className="ui-cta ui-shine"
              >
                <FileText className="h-5 w-5 text-indigo-600" />
                <span>Daftar Sekarang</span>
              </motion.button>
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                onClick={onNavigateLogin}
                className="ui-cta ui-cta--ghost"
              >
                <LogIn className="h-5 w-5" />
                <span>Masuk ke Web</span>
              </motion.button>
            </>
          }
        />

        {/* 3 KARTU STATISTIK */}
        <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <StatCard
            tone="blue"
            index={0}
            label="Data Sekolah"
            icon={Building2}
            value={<CountUp value={59} />}
            unit="sekolah asal"
          />
          <StatCard
            tone="amber"
            index={1}
            label="Data Jurusan"
            icon={BookMarked}
            value={<CountUp value={3} />}
            unit="program keahlian"
          />
          <StatCard
            tone="green"
            index={2}
            className="col-span-2 lg:col-span-1"
            label="Kuota Pendaftaran"
            icon={Users}
            value={<CountUp value={1500} />}
            unit="siswa total kuota"
          />
        </Stagger>

        {/* ALUR SPMB GAMBAR PENUH */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45 }}
          className="ui-panel space-y-4 p-4 sm:p-7"
        >
          <PanelTitle title="Alur SPMB Online" live />
          <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-slate-50 sm:max-w-xl lg:max-w-2xl">
            {!alurLoaded && <div className="ui-skel absolute inset-0 !rounded-none" aria-hidden />}
            <img
              src={alurImageUrl}
              alt="Alur SPMB Online SMK Muhammadiyah Bawang - Sekolah SMART"
              className={`block h-auto w-full min-h-[14rem] transition-opacity duration-500 ${alurLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onLoad={() => setAlurLoaded(true)}
              onError={() => setAlurLoaded(true)}
            />
          </div>
        </motion.div>

        {/* INFORMASI: TAB */}
        <div className="ui-panel space-y-5 p-4 sm:p-7">
          <SegTabs
            id="portal"
            ariaLabel="Informasi pendaftaran"
            className="w-full justify-between sm:w-auto"
            active={activeTab}
            onChange={(k) => setActiveTab(k as 'info' | 'syarat' | 'kontak')}
            items={[
              { key: 'info', icon: FileText, label: <><span className="sm:hidden">Info</span><span className="hidden sm:inline">Informasi Pendaftaran</span></> },
              { key: 'syarat', icon: CheckCircle, label: <><span className="sm:hidden">Syarat</span><span className="hidden sm:inline">Syarat Pendaftaran</span></> },
              { key: 'kontak', icon: Phone, label: <><span className="sm:hidden">Kontak</span><span className="hidden sm:inline">Kontak Pendaftaran</span></> },
            ]}
          />

          <ViewTransition viewKey={activeTab}>
            {activeTab === 'info' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-900">Alur & Langkah Pendaftaran Online</h3>
                  <p className="mt-1 text-sm text-slate-500">Ikuti 3 tahapan mudah untuk mendaftar sebagai calon peserta didik baru SMK Muhiba.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {[
                    { n: 1, title: 'Daftar Online', desc: 'Calon siswa mengisi data dasar (NIK, Nama, WhatsApp, Pilihan Jurusan) dan membuat password akun.', grad: 'from-indigo-500 to-violet-600', tile: 'violet' },
                    { n: 2, title: 'Login Masuk', desc: 'Gunakan nomor pendaftaran / NIK dan password yang didapat untuk masuk ke dashboard siswa.', grad: 'from-emerald-500 to-teal-600', tile: 'green' },
                    { n: 3, title: 'Lengkapi Berkas', desc: 'Lengkapi formulir biodata diri, alamat, data orang tua, serta serahkan / upload berkas pendaftaran.', grad: 'from-sky-500 to-blue-600', tile: 'blue' },
                  ].map((st) => (
                    <motion.div
                      key={st.n}
                      whileHover={shouldReduceMotion ? undefined : { y: -4 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                      className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/80 p-5 shadow-[0_18px_30px_-24px_rgba(67,56,202,.5)]"
                    >
                      <div>
                        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${st.grad} text-base font-extrabold text-white shadow-md`}>
                          {st.n}
                        </div>
                        <h4 className="mb-1 text-base font-bold text-slate-900">{st.title}</h4>
                        <p className="text-sm leading-relaxed text-slate-600">{st.desc}</p>
                      </div>
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        {st.n === 1 && (
                          <motion.button
                            type="button"
                            whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                            onClick={() => setShowRegisterForm(true)}
                            className="ui-shine flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-[0_16px_26px_-16px_rgba(91,61,240,.95)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
                          >
                            <FileText className="h-4 w-4" />
                            <span>Daftar Sekarang</span>
                          </motion.button>
                        )}
                        {st.n === 2 && (
                          <motion.button
                            type="button"
                            whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                            onClick={onNavigateLogin}
                            className="ui-shine flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-bold text-white shadow-[0_16px_26px_-16px_rgba(5,150,105,.95)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                          >
                            <ArrowRight className="h-4 w-4" />
                            <span>Login Masuk</span>
                          </motion.button>
                        )}
                        {st.n === 3 && (
                          <div className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-50 text-sm font-semibold text-blue-700">
                            <Check className="h-4 w-4 text-blue-600" />
                            <span>Verifikasi Panitia</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'syarat' && (
              <div className="space-y-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-slate-900">Dokumen & Syarat Pendaftaran Siswa Baru</h3>
                    <p className="mt-1 text-sm text-slate-500">Siapkan berkas-berkas berikut sebelum verifikasi dan penyerahan formulir:</p>
                  </div>
                  <span className="ui-live self-start sm:self-auto">8 Berkas Wajib & Pendukung</span>
                </div>

                <Stagger className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {[
                    { title: 'Surat Keterangan Lulus (SKL) Asli', desc: 'Asli dari SMP / MTs yang telah dilegalisir' },
                    { title: 'Fotocopy Ijazah SMP / MTs / Paket B', desc: 'FC Ijazah SD/MI jika ijazah SMP belum terbit' },
                    { title: 'Fotocopy Akta Kelahiran', desc: '1 lembar fotocopy yang jelas terbaca' },
                    { title: 'Fotocopy Kartu Keluarga (KK)', desc: '1 lembar fotocopy KK terbaru' },
                    { title: 'Fotocopy KTP Orang Tua', desc: 'KTP Ayah & KTP Ibu masing-masing 1 lembar' },
                    { title: 'Pas Foto 3x4 Sejumlah 5 Lembar', desc: 'Foto formal berseragam sekolah asal' },
                    { title: 'Fotocopy KIP / PKH / KKS / SKTM', desc: 'Khusus bagi pemegang kartu bantuan pemerintah' },
                    { title: 'Fotocopy Piagam Penghargaan', desc: 'Bagi pendaftar jalur prestasi akademik / non-akademik' },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      variants={itemVariants}
                      className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition-colors hover:border-indigo-200 hover:bg-white"
                    >
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-4 ring-emerald-50">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </Stagger>
              </div>
            )}

            {activeTab === 'kontak' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-900">Kontak Panitia SPMB SMK MUHIBA</h3>
                  <p className="mt-1 text-sm text-slate-500">Ada pertanyaan seputar jurusan, biaya, atau alur pendaftaran? Hubungi panitia resmi kami.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-extrabold text-white shadow-md">ES</div>
                      <div>
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">Panitia PPDB 1</span>
                        <h4 className="mt-1 text-base font-bold text-slate-900">EDI SETIANTO</h4>
                        <p className="text-xs text-slate-500">Pelayanan & Konsultasi Jurusan</p>
                      </div>
                    </div>
                    <a
                      href="https://wa.me/628561333392?text=Assalamu%27alaikum%20Warahmatullahi%20Wabarakatuh.%20Yth.%20Bapak%20Edi%20Setianto%2C%20perkenalkan%20saya%20calon%20pendaftar%20%2F%20orang%20tua%2C%20ingin%20berkonsultasi%20mengenai%20pelayanan%20pendaftaran%20dan%20pilihan%20konsentrasi%20keahlian%20di%20SMK%20Muhammadiyah%20Bawang.%20Terima%20kasih."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-semibold text-white shadow-[0_14px_24px_-14px_rgba(16,185,129,.9)] transition-all hover:bg-emerald-600 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                    >
                      <Phone className="h-4 w-4" />
                      <span>Chat WhatsApp (08561333392)</span>
                    </a>
                  </div>

                  <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-extrabold text-white shadow-md">SH</div>
                      <div>
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">Panitia PPDB 2</span>
                        <h4 className="mt-1 text-base font-bold text-slate-900">SUGI HARNOTO</h4>
                        <p className="text-xs text-slate-500">Informasi Alur & Berkas Fisik</p>
                      </div>
                    </div>
                    <a
                      href="https://wa.me/6285741977501?text=Assalamu%27alaikum%20Warahmatullahi%20Wabarakatuh.%20Yth.%20Bapak%20Sugi%20Harnoto%2C%20perkenalkan%20saya%20calon%20pendaftar%20%2F%20orang%20tua%2C%20ingin%20menanyakan%20informasi%20terkait%20alur%20pendaftaran%20dan%20kelengkapan%20berkas%20fisik%20PPDB%20SMK%20Muhammadiyah%20Bawang.%20Terima%20kasih."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-semibold text-white shadow-[0_14px_24px_-14px_rgba(16,185,129,.9)] transition-all hover:bg-emerald-600 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                    >
                      <Phone className="h-4 w-4" />
                      <span>Chat WhatsApp (085741977501)</span>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </ViewTransition>
        </div>

        {/* INFO SEKOLAH */}
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
              <span>Kunjungi Web Sekolah (smkmuhiba.sch.id)</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <span className="text-[11px] text-slate-400">Copyright © 2026 SPMB SMK MUHIBA | by @hndx07</span>
          </div>
        </div>

      </div>

      {/* REGISTRATION MODAL FORM */}
      <AnimatePresence>
        {showRegisterForm && (
          <div data-swipe-lock className="ui-scope fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeRegisterForm}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            />
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-[2rem] shadow-[0_40px_80px_-30px_rgba(30,27,75,.65)] max-w-lg w-full p-5 sm:p-8 relative my-4 sm:my-8 z-10 overflow-hidden"
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" aria-hidden />
              <motion.button
                whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                type="button"
                onClick={closeRegisterForm}
                aria-label="Tutup formulir"
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-2.5 rounded-full hover:bg-slate-100 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <X className="w-5 h-5" />
              </motion.button>

              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] font-bold text-indigo-700 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Form Pendaftaran Awal</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Registrasi Calon Siswa Baru
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Buat akun dengan NIK dan Password untuk mengakses formulir lengkap.
                </p>
              </div>

              {errorMessage && (
                <motion.div
                  ref={alertRef}
                  role="alert"
                  initial={shouldReduceMotion ? false : { opacity: 0, x: -6 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { x: [-6, 6, -4, 4, 0], opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span className="font-semibold flex-1">{errorMessage}</span>
                </motion.div>
              )}

            <form onSubmit={handleRegisterSubmit} noValidate className="space-y-5">
              {/* NIK */}
              <div>
                <label htmlFor="reg-nik" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nomor Induk Kependudukan (NIK) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <CreditCard className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                  <input
                    id="reg-nik"
                    ref={nikRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={16}
                    value={nik}
                    onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
                    onBlur={() => touch('nik')}
                    aria-invalid={!!(touched.nik && fieldErrors.nik)}
                    placeholder="16 digit angka sesuai KTP / KK"
                    className={`w-full pl-11 pr-16 h-12 text-base sm:text-sm border-2 rounded-2xl outline-none transition-all duration-200 focus:ring-4 ${
                      touched.nik && fieldErrors.nik
                        ? 'border-red-400 focus:ring-red-100 focus:border-red-500 bg-red-50/50'
                        : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 focus:bg-white focus:ring-indigo-100 focus:border-indigo-500'
                    }`}
                  />
                  <span
                    className={`absolute right-4 top-3.5 text-xs font-bold tabular-nums ${
                      nik.length === 16 && !fieldErrors.nik
                        ? 'text-emerald-600'
                        : touched.nik
                        ? 'text-red-500'
                        : 'text-slate-400'
                    }`}
                  >
                    {nik.length}/16
                  </span>
                </div>
                {touched.nik && fieldErrors.nik ? (
                  <p className="text-[11px] font-semibold text-red-600 mt-1">{fieldErrors.nik}</p>
                ) : (
                  <p className="text-[10px] text-slate-500 mt-1">NIK akan digunakan sebagai username login.</p>
                )}
              </div>

              {/* Nama */}
              <div>
                <label htmlFor="reg-nama" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nama Lengkap Siswa <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                  <input
                    id="reg-nama"
                    ref={namaRef}
                    type="text"
                    autoComplete="name"
                    value={namaLengkap}
                    onChange={(e) => setNamaLengkap(e.target.value)}
                    onBlur={() => touch('nama')}
                    placeholder="Nama lengkap sesuai ijazah / akta"
                    className={`w-full pl-11 pr-3 h-12 text-base sm:text-sm border-2 rounded-2xl outline-none transition-all duration-200 focus:ring-4 ${
                      touched.nama && fieldErrors.nama
                        ? 'border-red-400 focus:ring-red-100 focus:border-red-500 bg-red-50/50'
                        : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 focus:bg-white focus:ring-indigo-100 focus:border-indigo-500'
                    }`}
                  />
                </div>
                {touched.nama && fieldErrors.nama && (
                  <p className="text-[11px] font-semibold text-red-600 mt-1">{fieldErrors.nama}</p>
                )}
              </div>

              {/* Jurusan */}
              <div>
                <label htmlFor="reg-jurusan" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Pilihan Konsentrasi Keahlian (Jurusan) <span className="text-red-500">*</span>
                </label>
                <select
                  id="reg-jurusan"
                  value={jurusanPilihan}
                  onChange={(e) => setJurusanPilihan(e.target.value as JurusanType)}
                  className="w-full h-12 px-3.5 text-base sm:text-sm border-2 border-slate-200 bg-slate-50/80 hover:border-slate-300 rounded-2xl outline-none transition-all duration-200 focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 font-semibold"
                >
                  <option value="TO">Teknik Otomotif (TO)</option>
                  <option value="TJKT">Teknik Jaringan Komputer & Telekomunikasi (TJKT)</option>
                  <option value="AKL">Akuntansi dan Keuangan Lembaga (AKL)</option>
                </select>
              </div>

              {/* WhatsApp */}
              <div>
                <label htmlFor="reg-wa" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nomor WhatsApp Siswa / Orang Tua <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                  <input
                    id="reg-wa"
                    ref={waRef}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={16}
                    value={noWa}
                    onChange={(e) => setNoWa(e.target.value)}
                    onBlur={() => touch('wa')}
                    placeholder="Contoh: 081234567890"
                    className={`w-full pl-11 pr-3 h-12 text-base sm:text-sm border-2 rounded-2xl outline-none transition-all duration-200 focus:ring-4 ${
                      touched.wa && fieldErrors.wa
                        ? 'border-red-400 focus:ring-red-100 focus:border-red-500 bg-red-50/50'
                        : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 focus:bg-white focus:ring-indigo-100 focus:border-indigo-500'
                    }`}
                  />
                </div>
                {touched.wa && fieldErrors.wa && (
                  <p className="text-[11px] font-semibold text-red-600 mt-1">{fieldErrors.wa}</p>
                )}
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-pass" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Buat Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                    <input
                      id="reg-pass"
                      ref={passRef}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => touch('password')}
                      placeholder="Min. 8 karakter"
                      className={`w-full pl-11 pr-10 h-12 text-base sm:text-sm border-2 rounded-2xl outline-none transition-all duration-200 focus:ring-4 ${
                        touched.password && fieldErrors.password
                          ? 'border-red-400 focus:ring-red-100 focus:border-red-500 bg-red-50/50'
                          : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 focus:bg-white focus:ring-indigo-100 focus:border-indigo-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      aria-pressed={showPassword}
                      className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-100 hover:text-indigo-600 active:scale-90"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-1.5">
                      <div className="h-1 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: strength.width }} />
                      </div>
                      <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Kekuatan: {strength.label}</p>
                    </div>
                  )}
                  {touched.password && fieldErrors.password && (
                    <p className="text-[11px] font-semibold text-red-600 mt-1">{fieldErrors.password}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="reg-confirm" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Konfirmasi Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                    <input
                      id="reg-confirm"
                      ref={confirmRef}
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onBlur={() => touch('confirm')}
                      placeholder="Ulangi password"
                      className={`w-full pl-11 pr-10 h-12 text-base sm:text-sm border-2 rounded-2xl outline-none transition-all duration-200 focus:ring-4 ${
                        touched.confirm && fieldErrors.confirm
                          ? 'border-red-400 focus:ring-red-100 focus:border-red-500 bg-red-50/50'
                          : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 focus:bg-white focus:ring-indigo-100 focus:border-indigo-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'}
                      aria-pressed={showConfirm}
                      className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-100 hover:text-indigo-600 active:scale-90"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && !fieldErrors.confirm && (
                    <p className="text-[11px] font-semibold text-emerald-600 mt-1">Password cocok</p>
                  )}
                  {touched.confirm && fieldErrors.confirm && (
                    <p className="text-[11px] font-semibold text-red-600 mt-1">{fieldErrors.confirm}</p>
                  )}
                </div>
              </div>

              {/* Verifikasi keamanan (Turnstile) dengan status yang jelas */}
              {formTs.siteKey && (
                <div className="space-y-2">
                  <div ref={formTs.containerRef} className="flex justify-center min-h-[4px]" />
                  {formTs.status === 'loading' && (
                    <p className="text-center text-[11px] font-semibold text-slate-500">
                      Memeriksa keamanan, mohon tunggu...
                    </p>
                  )}
                  {formTs.status === 'ready' && (
                    <p className="text-center text-[11px] font-semibold text-emerald-600">
                      Verifikasi keamanan berhasil
                    </p>
                  )}
                  {formTs.status === 'error' && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-800">
                      <p className="font-semibold">{turnstileHint(formTs.errorCode)}</p>
                      <p className="mt-1 text-amber-700/80">Kode: {formTs.errorCode || '-'}</p>
                      <button
                        type="button"
                        onClick={formTs.retry}
                        className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-700"
                      >
                        Coba lagi
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2">
                <motion.button
                  whileTap={shouldReduceMotion || isSubmitting ? undefined : { scale: 0.96 }}
                  whileHover={shouldReduceMotion || isSubmitting ? undefined : { scale: 1.01 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="ui-shine w-full h-14 bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 text-white font-bold text-base rounded-2xl shadow-[0_22px_36px_-18px_rgba(91,61,240,.95)] transition-[filter] duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Memproses Pendaftaran...</span>
                    </>
                  ) : (
                    <span>Simpan & Dapatkan Bukti Pendaftaran</span>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

      {/* BUKTI PENDAFTARAN MODAL / CARD DENGAN PRINT CSS FIX */}
      {buktiPendaftaran && (
        <>
          {/* CSS khusus saat mode print berjalan untuk memastikan tampilan hanya sebatas area Bukti Pendaftaran tanpa page break tambahan */}
          <style type="text/css" media="print">
            {`
              @page { size: A4 portrait; margin: 15mm; }
              html, body { 
                background: white !important; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
                height: 100vh !important; 
                overflow: hidden !important; 
              }
              /* Sembunyikan semua elemen di luar area print agar tidak bertabrakan */
              body * { visibility: hidden; }
              /* Munculkan kembali hanya area print beserta isinya */
              #print-section, #print-section * { visibility: visible; }
            `}
          </style>

          {/* Menghilangkan modal layang pada saat dicetak, dibuat seakan dokumen statis full layar */}
          <div id="print-section" data-swipe-lock className="ui-scope fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto print:absolute print:inset-0 print:bg-white print:p-0 print:block print:z-[99999]">
            <div className="bg-white rounded-[2rem] shadow-[0_40px_80px_-30px_rgba(30,27,75,.65)] max-w-lg w-full p-5 sm:p-8 relative my-4 sm:my-8 animate-in fade-in zoom-in-95 duration-300 print:rounded-none print:shadow-none print:m-0 print:max-w-full print:border-none print:p-0 print:block">
              
              <div className="flex items-start justify-between border-b pb-4 mb-5">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 tracking-wider uppercase">
                    BUKTI PENDAFTARAN PESERTA DIDIK BARU
                  </h3>
                  <p className="text-[11px] font-semibold text-blue-700">
                    SPMB SMK MUHAMMADIYAH BAWANG
                  </p>
                </div>
                <button
                  onClick={() => setBuktiPendaftaran(null)}
                  className="text-slate-400 hover:text-slate-600 print:hidden"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs sm:text-sm">
                <table className="w-full divide-y divide-slate-200">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-slate-50/50">
                      <td className="px-4 py-2.5 font-semibold text-slate-600 w-1/3">Nama Peserta</td>
                      <td className="px-4 py-2.5 font-bold text-slate-900">{buktiPendaftaran.student.nama_lengkap}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-semibold text-slate-600">No. Pendaftaran</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-blue-700">{buktiPendaftaran.student.nomor_pendaftaran}</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="px-4 py-2.5 font-semibold text-slate-600">NIK (Username)</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{buktiPendaftaran.student.nik}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-semibold text-slate-600">Password</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{buktiPendaftaran.rawPassword}</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="px-4 py-2.5 font-semibold text-slate-600">Jurusan Pilihan</td>
                      <td className="px-4 py-2.5 font-semibold text-emerald-700">{buktiPendaftaran.student.jurusan_pilihan}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-semibold text-slate-600">Tanggal Daftar</td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{buktiPendaftaran.student.tanggal_daftar}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 text-[11px] sm:text-xs text-slate-600 leading-relaxed bg-blue-50/60 p-3.5 rounded-2xl border border-blue-100">
                <p className="font-semibold text-blue-900 mb-1">
                  Dengan ini menyatakan bahwa peserta didik di atas telah <span className="font-extrabold uppercase">BERHASIL MELAKUKAN PENDAFTARAN</span> secara online.
                </p>
                <p>
                  Silakan login menggunakan <strong>Nomor Pendaftaran / NIK</strong> dan <strong>Password</strong> untuk melengkapi data formulir dan mengikuti tahapan selanjutnya.
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400 border-b pb-4 mb-4">
                <span>Dicetak pada: {buktiPendaftaran.student.tanggal_daftar}</span>
                <span className="font-semibold text-slate-600">Panitia SPMB SMK Muhammadiyah Bawang</span>
              </div>

              {/* PERINGATAN KEAMANAN HIGHLIGHT BESAR (Sembunyikan saat di print) */}
              <div className="mt-2 border-2 border-red-500 bg-red-50 p-4 sm:p-5 rounded-3xl shadow-sm mb-6 print:hidden">
                <div className="flex items-start gap-3 sm:gap-4">
                  <ShieldAlert className="w-8 h-8 sm:w-10 sm:h-10 text-red-600 shrink-0 animate-bounce mt-1" />
                  <div>
                    <h4 className="text-sm sm:text-base font-black text-red-700 uppercase tracking-widest">
                      PERHATIAN SANGAT PENTING!
                    </h4>
                    <p className="text-xs sm:text-sm text-red-900 mt-1.5 font-semibold leading-relaxed">
                      Jaga kerahasiaan dan <span className="font-black underline text-red-700 text-sm sm:text-base">JANGAN SAMPAI LUPA</span> <br className="hidden sm:block"/> 
                      NIK dan Password Anda! Anda sangat membutuhkannya untuk login kembali.
                    </p>
                    <p className="text-xs sm:text-sm text-red-900 mt-2 font-medium leading-relaxed bg-red-100/50 p-2 rounded border border-red-200">
                      Anda <span className="font-black uppercase text-blue-700">Silakan SCREENSHOT/ Download / cetak PDF Bukti Pendaftaran</span> ini agar kredensial Anda tersimpan dengan aman sebelum masuk ke Dashboard.
                    </p>
                  </div>
                </div>
              </div>

              {needsLogin && enterTs.siteKey && (
                <div className="mt-5 print:hidden">
                  <p className="text-[11px] text-slate-500 mb-2 text-center">
                    Selesaikan verifikasi keamanan di bawah ini untuk masuk ke dashboard.
                  </p>
                  <div ref={enterTs.containerRef} className="flex justify-center" />
                </div>
              )}

              {enterError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 print:hidden">
                  {enterError}
                </div>
              )}

              {/* Action buttons (Sembunyikan saat di print) */}
              <div className="mt-2 flex flex-col sm:flex-row gap-3 print:hidden">
                <button
                  onClick={handlePrint}
                  className="flex-1 min-h-12 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white font-extrabold text-xs sm:text-sm rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_18px_28px_-16px_rgba(59,68,220,.9)] active:scale-95"
                >
                  <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>DOWNLOAD / CETAK PDF (WAJIB)</span>
                </button>

                <button
                  onClick={handleEnterDashboard}
                  disabled={isEntering}
                  className="flex-1 min-h-12 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_18px_28px_-16px_rgba(5,150,105,.9)] active:scale-95 disabled:opacity-50"
                >
                  <span>{isEntering ? 'Memproses...' : 'Masuk Ke Dashboard Siswa'}</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

            </div>
          </div>
        </>
      )}

    </div>
  );
};
