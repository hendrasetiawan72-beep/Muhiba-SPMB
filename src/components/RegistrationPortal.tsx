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
  EyeOff
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'info' | 'syarat' | 'kontak'>('info');
  const [showRegisterForm, setShowRegisterForm] = useState<boolean>(false);
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
    <div className="min-h-screen bg-slate-100 py-6 sm:py-10 px-4 sm:px-6 lg:px-8 print:bg-white print:py-0 print:px-0">
      
      <div className="max-w-5xl mx-auto space-y-6 print:hidden">

        {/* TOP WELCOME BAR */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-wide">
              SELAMAT DATANG CALON PESERTA DIDIK
            </h1>
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full text-[10px] font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>Terhubung</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowRegisterForm(true);
                setBuktiPendaftaran(null);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm transition-colors uppercase tracking-wider"
            >
              DAFTAR SEKARANG
            </button>
            <button
              onClick={onNavigateLogin}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors uppercase tracking-wider"
            >
              MASUK KE WEB
            </button>
          </div>
        </div>

        {/* 3 STATS COUNTERS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Data Sekolah</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums">59</p>
              <p className="text-[11px] text-slate-400">Sekolah Asal</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <BookMarked className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Data Jurusan</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums">3</p>
              <p className="text-[11px] text-slate-400">Program Keahlian</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Kuota Pendaftaran</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums">1.500</p>
              <p className="text-[11px] text-slate-400">Siswa Total Kuota</p>
            </div>
          </div>
        </div>

        {/* ALUR SPMB GAMBAR PENUH */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-3 sm:p-6">
          <div className="mx-auto w-full max-w-md sm:max-w-xl lg:max-w-2xl rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
            <img
              src={alurImageUrl}
              alt="Alur SPMB Online SMK Muhammadiyah Bawang - Sekolah SMART"
              className="block w-full h-auto"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* TABBED INFORMATION BOX */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-8">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-1.5 bg-slate-100/90 rounded-xl mb-6">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'info'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Informasi Pendaftaran</span>
            </button>

            <button
              onClick={() => setActiveTab('syarat')}
              className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'syarat'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Syarat Pendaftaran</span>
            </button>

            <button
              onClick={() => setActiveTab('kontak')}
              className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'kontak'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Phone className="w-4 h-4 shrink-0" />
              <span>Kontak Pendaftaran</span>
            </button>
          </div>

          <div className="bg-slate-50/70 p-5 sm:p-7 rounded-xl border border-slate-200/70">
            {activeTab === 'info' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Alur & Langkah Pendaftaran Online</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Ikuti 3 tahapan mudah untuk mendaftar sebagai calon peserta didik baru SMK Muhiba.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-colors">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 font-extrabold text-xs flex items-center justify-center mb-3">01</div>
                      <h4 className="font-bold text-sm text-slate-900 mb-1">Daftar Online</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Calon siswa mengisi data dasar (NIK, Nama, WhatsApp, Pilihan Jurusan) dan membuat password akun.
                      </p>
                    </div>
                    <div className="pt-4 mt-3 border-t border-slate-100">
                      <button
                        onClick={() => setShowRegisterForm(true)}
                        className="w-full py-2 px-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Daftar Sekarang</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 font-extrabold text-xs flex items-center justify-center mb-3">02</div>
                      <h4 className="font-bold text-sm text-slate-900 mb-1">Login Masuk</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Gunakan nomor pendaftaran / NIK dan password yang didapat untuk masuk ke dashboard siswa.
                      </p>
                    </div>
                    <div className="pt-4 mt-3 border-t border-slate-100">
                      <button
                        onClick={onNavigateLogin}
                        className="w-full py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Login Masuk</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-colors">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 font-extrabold text-xs flex items-center justify-center mb-3">03</div>
                      <h4 className="font-bold text-sm text-slate-900 mb-1">Lengkapi Berkas</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Lengkapi formulir biodata diri, alamat, data orang tua, serta serahkan / upload berkas pendaftaran.
                      </p>
                    </div>
                    <div className="pt-4 mt-3 border-t border-slate-100">
                      <div className="w-full py-2 px-3 text-xs font-semibold text-blue-700 bg-blue-50 rounded-md flex items-center justify-center gap-1 text-center">
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                        <span>Verifikasi Panitia</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'syarat' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Dokumen & Syarat Pendaftaran Siswa Baru</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Siapkan berkas-berkas berikut sebelum verifikasi dan penyerahan formulir:</p>
                  </div>
                  <span className="self-start sm:self-auto text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                    8 Berkas Wajib & Pendukung
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
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
                    <div
                      key={i}
                      className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs flex items-start gap-3 hover:border-blue-300 transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{item.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'kontak' && (
              <div className="space-y-4">
                <div className="pb-2 border-b border-slate-200/80">
                  <h3 className="text-base font-bold text-slate-900">Kontak Panitia SPMB SMK MUHIBA</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Ada pertanyaan seputar jurusan, biaya, atau alur pendaftaran? Hubungi panitia resmi kami.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-extrabold text-sm">ES</div>
                      <div>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">Panitia PPDB 1</span>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">EDI SETIANTO</h4>
                        <p className="text-xs text-slate-500">Pelayanan & Konsultasi Jurusan</p>
                      </div>
                    </div>
                    <a
                      href="https://wa.me/628561333392?text=Assalamu%27alaikum%20Warahmatullahi%20Wabarakatuh.%20Yth.%20Bapak%20Edi%20Setianto%2C%20perkenalkan%20saya%20calon%20pendaftar%20%2F%20orang%20tua%2C%20ingin%20berkonsultasi%20mengenai%20pelayanan%20pendaftaran%20dan%20pilihan%20konsentrasi%20keahlian%20di%20SMK%20Muhammadiyah%20Bawang.%20Terima%20kasih."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Chat WhatsApp (08561333392)</span>
                    </a>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-extrabold text-sm">SH</div>
                      <div>
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase">Panitia PPDB 2</span>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">SUGI HARNOTO</h4>
                        <p className="text-xs text-slate-500">Informasi Alur & Berkas Fisik</p>
                      </div>
                    </div>
                    <a
                      href="https://wa.me/6285741977501?text=Assalamu%27alaikum%20Warahmatullahi%20Wabarakatuh.%20Yth.%20Bapak%20Sugi%20Harnoto%2C%20perkenalkan%20saya%20calon%20pendaftar%20%2F%20orang%20tua%2C%20ingin%20menanyakan%20informasi%20terkait%20alur%20pendaftaran%20dan%20kelengkapan%20berkas%20fisik%20PPDB%20SMK%20Muhammadiyah%20Bawang.%20Terima%20kasih."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Chat WhatsApp (085741977501)</span>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

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
              Copyright © 2026 SPMB SMK MUHIBA | by @hndx07
            </span>
          </div>
        </div>

      </div>

      {/* REGISTRATION MODAL FORM */}
      {showRegisterForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 relative my-8 animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={closeRegisterForm}
              aria-label="Tutup formulir"
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Form Pendaftaran Awal</span>
              <h2 className="text-xl font-extrabold text-slate-900 mt-1">
                Registrasi Calon Siswa Baru
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Buat akun dengan NIK dan Password untuk mengakses formulir lengkap.
              </p>
            </div>

            {errorMessage && (
              <div
                ref={alertRef}
                role="alert"
                className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg flex items-start gap-2 text-xs text-red-700"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} noValidate className="space-y-4">
              {/* NIK */}
              <div>
                <label htmlFor="reg-nik" className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Induk Kependudukan (NIK) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
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
                    className={`w-full pl-9 pr-16 py-2 text-xs border rounded-lg focus:ring-2 ${
                      touched.nik && fieldErrors.nik
                        ? 'border-red-400 focus:ring-red-400 focus:border-red-400 bg-red-50/40'
                        : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                  <span
                    className={`absolute right-3 top-2.5 text-[11px] font-bold tabular-nums ${
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
                <label htmlFor="reg-nama" className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Siswa <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    id="reg-nama"
                    ref={namaRef}
                    type="text"
                    autoComplete="name"
                    value={namaLengkap}
                    onChange={(e) => setNamaLengkap(e.target.value)}
                    onBlur={() => touch('nama')}
                    placeholder="Nama lengkap sesuai ijazah / akta"
                    className={`w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:ring-2 ${
                      touched.nama && fieldErrors.nama
                        ? 'border-red-400 focus:ring-red-400 focus:border-red-400 bg-red-50/40'
                        : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                </div>
                {touched.nama && fieldErrors.nama && (
                  <p className="text-[11px] font-semibold text-red-600 mt-1">{fieldErrors.nama}</p>
                )}
              </div>

              {/* Jurusan */}
              <div>
                <label htmlFor="reg-jurusan" className="block text-xs font-bold text-slate-700 mb-1">
                  Pilihan Konsentrasi Keahlian (Jurusan) <span className="text-red-500">*</span>
                </label>
                <select
                  id="reg-jurusan"
                  value={jurusanPilihan}
                  onChange={(e) => setJurusanPilihan(e.target.value as JurusanType)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold"
                >
                  <option value="TO">Teknik Otomotif (TO)</option>
                  <option value="TJKT">Teknik Jaringan Komputer & Telekomunikasi (TJKT)</option>
                  <option value="AKL">Akuntansi dan Keuangan Lembaga (AKL)</option>
                </select>
              </div>

              {/* WhatsApp */}
              <div>
                <label htmlFor="reg-wa" className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor WhatsApp Siswa / Orang Tua <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
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
                    className={`w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:ring-2 ${
                      touched.wa && fieldErrors.wa
                        ? 'border-red-400 focus:ring-red-400 focus:border-red-400 bg-red-50/40'
                        : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'
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
                  <label htmlFor="reg-pass" className="block text-xs font-bold text-slate-700 mb-1">
                    Buat Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      id="reg-pass"
                      ref={passRef}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => touch('password')}
                      placeholder="Min. 8 karakter"
                      className={`w-full pl-9 pr-10 py-2 text-xs border rounded-lg focus:ring-2 ${
                        touched.password && fieldErrors.password
                          ? 'border-red-400 focus:ring-red-400 focus:border-red-400 bg-red-50/40'
                          : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      aria-pressed={showPassword}
                      className="absolute right-1.5 top-1 flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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
                  <label htmlFor="reg-confirm" className="block text-xs font-bold text-slate-700 mb-1">
                    Konfirmasi Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      id="reg-confirm"
                      ref={confirmRef}
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onBlur={() => touch('confirm')}
                      placeholder="Ulangi password"
                      className={`w-full pl-9 pr-10 py-2 text-xs border rounded-lg focus:ring-2 ${
                        touched.confirm && fieldErrors.confirm
                          ? 'border-red-400 focus:ring-red-400 focus:border-red-400 bg-red-50/40'
                          : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'}
                      aria-pressed={showConfirm}
                      className="absolute right-1.5 top-1 flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-md transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? 'Memproses Pendaftaran...' : 'Simpan & Dapatkan Bukti Pendaftaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
          <div id="print-section" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto print:absolute print:inset-0 print:bg-white print:p-0 print:block print:z-[99999]">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 relative my-8 animate-in fade-in duration-200 print:shadow-none print:m-0 print:max-w-full print:border-none print:p-0 print:block">
              
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

              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
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

              <div className="mt-4 text-[11px] text-slate-600 leading-relaxed bg-blue-50/60 p-3 rounded-lg border border-blue-100">
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
              <div className="mt-2 border-2 border-red-500 bg-red-50 p-4 sm:p-5 rounded-xl shadow-sm mb-6 print:hidden">
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
                      Anda <span className="font-black uppercase text-blue-700">Wajib Mendownload / Mencetak PDF Bukti Pendaftaran</span> ini agar kredensial Anda tersimpan dengan aman sebelum masuk ke Dashboard.
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
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95"
                >
                  <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>DOWNLOAD / CETAK PDF (WAJIB)</span>
                </button>

                <button
                  onClick={handleEnterDashboard}
                  disabled={isEntering}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
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
