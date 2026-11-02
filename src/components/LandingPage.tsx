import React, { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, useReducedMotion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { 
  Wrench, 
  Cpu, 
  Calculator, 
  MapPin, 
  Phone, 
  MessageCircle, 
  ExternalLink, 
  CheckCircle2, 
  Award, 
  Play, 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  BookOpen,
  ArrowRight,
  ArrowUp,
  Volume2,
  VolumeX,
  X,
  Globe,
  UserPlus,
  ClipboardList,
  CloudUpload,
  FileSearch,
  ShieldCheck,
  Megaphone,
  ChevronsDown,
  ChevronsUp,
  RotateCcw,
  LogIn,
  AlertTriangle,
  Instagram,
  Youtube,
  Code2,
  Eye,
  EyeOff
} from 'lucide-react';

// ===========================================================================
// KOMPONEN ALUR PENDAFTARAN SPMB
// ===========================================================================
interface AlurPendaftaranProps {
  onRegisterClick?: () => void;
  onLoginClick?: () => void;
}

interface Step {
  title: string;
  desc: React.ReactNode;
  color: string;
  icon: LucideIcon;
  chip?: string;
  warn?: boolean;
  action?: 'register' | 'login';
}

const STEPS: Step[] = [
  {
    title: 'Buka Website SPMB',
    color: '#6c63d9',
    icon: Globe,
    desc: <>Scan barcode atau buka alamat website SPMB SMK Muhammadiyah Bawang.</>,
  },
  {
    title: 'Klik “Daftar Sekarang”',
    color: '#e8344a',
    icon: UserPlus,
    desc: (
      <>
        Tekan tombol <b>Daftar Sekarang</b> di halaman utama SPMB.
      </>
    ),
    action: 'register',
  },
  {
    title: 'Isi Data Awal',
    color: '#1fa463',
    icon: ClipboardList,
    desc: (
      <>
        Isi <b>NIK, nama, nomor WhatsApp, pilihan jurusan</b> (TO / TJKT / AKL), lalu buat{' '}
        <b>password</b>.
      </>
    ),
    chip: 'Catat No. Pendaftaran & password untuk login',
    warn: true,
  },
  {
    title: 'Login & Lengkapi Formulir',
    color: '#1c3f8f',
    icon: CloudUpload,
    desc: (
      <>
        Login dengan No. Pendaftaran / NIK. Isi <b>biodata, alamat, data orang tua</b>, lalu upload{' '}
        <b>KK, Ijazah/SKL, Akta Lahir</b>.
      </>
    ),
    chip: 'Status: Menunggu Verifikasi',
    action: 'login',
  },
  {
    title: 'Verifikasi oleh Admin SPMB',
    color: '#f28c1e',
    icon: FileSearch,
    desc: <>Panitia memeriksa data dan berkas. Pantau status & catatan panitia di dashboard.</>,
    chip: 'Menunggu Verifikasi → Terverifikasi',
  },
  {
    title: 'Terverifikasi: Bayar & Cetak',
    color: '#0f9d8a',
    icon: ShieldCheck,
    desc: (
      <>
        Buka menu <b>Biaya & Pembayaran</b>, lalu cetak formulir pendaftaran.
      </>
    ),
  },
  {
    title: 'Pengumuman Hasil Seleksi',
    color: '#2f80ed',
    icon: Megaphone,
    desc: (
      <>
        Cek hasil: <b>Diterima</b> atau <b>Cadangan</b>. Ikuti arahan panitia untuk daftar ulang,
        seragam & MPLS.
      </>
    ),
    chip: 'Cek dashboard secara berkala',
  },
];

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

const AlurPendaftaran: React.FC<AlurPendaftaranProps> = ({
  onRegisterClick,
  onLoginClick,
}) => {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  const [active, setActive] = useState<number>(0);
  const [alurImageOpen, setAlurImageOpen] = useState(false);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const alurImageRef = useRef<HTMLDivElement | null>(null);
  const mounted = useRef(false);

  const { scrollYProgress: alurImageProgress } = useScroll({
    target: alurImageRef,
    offset: ['start end', 'end start'],
  });
  const alurImageY = useTransform(alurImageProgress, [0, 0.5, 1], reduce ? [0, 0, 0] : [34, 0, -26]);
  const alurImageScale = useTransform(
    alurImageProgress,
    [0, 0.5, 1],
    reduce ? [1, 1, 1] : [0.94, 1, 0.96],
  );

  const allOpen = open.size === STEPS.length;
  const progress = (active + 1) / STEPS.length;

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const t = window.setTimeout(() => {
      itemRefs.current[active]?.scrollIntoView({
        behavior: reduce ? 'auto' : 'smooth',
        block: 'nearest',
      });
    }, 280);
    return () => window.clearTimeout(t);
  }, [active, reduce]);

  const toggle = (i: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
    setActive(i);
  };

  const openAll = () => setOpen(new Set(STEPS.map((_, i) => i)));
  const closeAll = () => setOpen(new Set());

  const goNext = (i: number) => {
    if (i >= STEPS.length - 1) {
      setOpen(new Set([0]));
      setActive(0);
      return;
    }
    setOpen(new Set([i + 1]));
    setActive(i + 1);
  };

  const runAction = (a?: Step['action']) => {
    if (a === 'register') onRegisterClick?.();
    if (a === 'login') onLoginClick?.();
  };

  return (
    <section
      id="alur-pendaftaran"
      className="relative scroll-mt-24 section-snap overflow-hidden bg-gradient-to-b from-slate-50 via-blue-50/60 to-white py-16 sm:py-20"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-10 max-w-2xl text-center"
        >
          <span className="inline-block rounded-full bg-amber-100 px-4 py-1 text-xs font-bold uppercase tracking-widest text-amber-700">
            Panduan Pendaftaran
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Alur SPMB Online
          </h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            SMK Muhammadiyah Bawang · Ikuti 7 langkah dari awal sampai pengumuman.
          </p>
        </motion.div>

        <motion.div
          ref={alurImageRef}
          initial={reduce ? false : { opacity: 0 }}
          whileInView={reduce ? undefined : { opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          style={{ y: alurImageY, scale: alurImageScale }}
          className="relative z-10 mx-auto mb-10 w-full max-w-6xl [transform-style:preserve-3d]"
        >
          <button
            type="button"
            onClick={() => setAlurImageOpen((value) => !value)}
            aria-label={alurImageOpen ? 'Perkecil infografis alur pendaftaran' : 'Perbesar infografis alur pendaftaran'}
            aria-pressed={alurImageOpen}
            className="group relative block w-full overflow-hidden rounded-3xl border border-white/80 bg-white p-1 shadow-[0_20px_60px_-25px_rgba(30,64,175,0.35)] outline-none transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-28px_rgba(30,64,175,0.45)] focus-visible:ring-4 focus-visible:ring-blue-300/60 active:scale-[0.995]"
          >
            <div className="relative overflow-hidden rounded-[1.35rem] bg-slate-100">
              <motion.img
                src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhiIuDeq9J_WXO2KBegPfvLCQivkwkbWElfSF07iItWPEB79-w0y7zyYxkSA9jkni23z6pkuzm7KYKoqsfOZ7XbYqmw7_Ic8vwU6UQhyphenhyphen4g_P5P-zvADaKnp-tJCISFdODUggAa9OiuK5QMBP_i5xJ8X3lnJR5PZoA51SqxzZfTy5yVxqq7BIYPLewRPa1Jt/s1672/69252.png"
                alt="Infografis alur pendaftaran SPMB SMK Muhammadiyah Bawang"
                loading="lazy"
                decoding="async"
                className={`block h-auto w-full select-none object-contain transition-transform duration-700 ease-out ${
                  alurImageOpen ? 'scale-[1.025]' : 'scale-100 group-hover:scale-[1.015]'
                }`}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-blue-950/15 via-transparent to-white/10 opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-slate-950/75 px-3 py-1.5 text-[10px] font-bold tracking-wide text-white opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 sm:text-xs">
                {alurImageOpen ? 'Tekan untuk perkecil' : 'Tekan untuk lihat lebih jelas'}
              </span>
            </div>
          </button>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-[17rem_1fr] lg:gap-12">
          <aside className="self-start lg:sticky lg:top-24">
            <div className="flex items-center gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-col lg:gap-4 lg:p-6">
              <div className="relative h-28 w-28 shrink-0">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle cx="60" cy="60" r={RING_R} fill="none" stroke="#e2e8f0" strokeWidth="10" />
                  <motion.circle
                    cx="60"
                    cy="60"
                    r={RING_R}
                    fill="none"
                    stroke={STEPS[active].color}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={RING_C}
                    initial={false}
                    animate={{ strokeDashoffset: RING_C * (1 - progress), stroke: STEPS[active].color }}
                    transition={{ duration: reduce ? 0 : 0.6, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold text-slate-900">
                    {active + 1}
                    <span className="text-sm font-semibold text-slate-400">/{STEPS.length}</span>
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Langkah
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1 lg:w-full lg:text-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={active}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm font-bold leading-snug"
                    style={{ color: STEPS[active].color }}
                  >
                    {STEPS[active].title}
                  </motion.p>
                </AnimatePresence>

                <div className="mt-3 flex flex-wrap gap-2 lg:justify-center">
                  <button
                    type="button"
                    onClick={allOpen ? closeAll : openAll}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700 active:scale-95"
                  >
                    {allOpen ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                    {allOpen ? 'Tutup Semua' : 'Buka Semua'}
                  </button>
                  <button
                    type="button"
                    onClick={onRegisterClick}
                    className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700 active:scale-95"
                  >
                    Daftar Sekarang
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <ol className="relative">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isOpen = open.has(i);
              const isActive = active === i;
              const done = i < active;
              const panelId = `alur-panel-${i}`;
              return (
                <motion.li
                  key={s.title}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  initial={reduce ? false : { opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.45, delay: Math.min(i, 3) * 0.05 }}
                  className="relative flex gap-4 pb-5 sm:gap-6 last:pb-0"
                >
                  <div className="relative flex w-14 shrink-0 flex-col items-center sm:w-16">
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      aria-label={`Langkah ${i + 1}: ${s.title}`}
                      className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white text-white shadow-lg transition-transform hover:scale-110 active:scale-95 sm:h-16 sm:w-16"
                      style={{ backgroundColor: s.color }}
                    >
                      {isActive && !reduce && (
                        <motion.span
                          className="absolute inset-0 rounded-full"
                          style={{ backgroundColor: s.color }}
                          animate={{ scale: [1, 1.55], opacity: [0.45, 0] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                        />
                      )}
                      <Icon className="relative h-6 w-6 sm:h-7 sm:w-7" />
                      <span
                        className="absolute -top-1.5 -left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-extrabold shadow"
                        style={{ color: s.color }}
                      >
                        {i + 1}
                      </span>
                    </button>

                    {i < STEPS.length - 1 && (
                      <div className="relative -mt-1 w-1 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <motion.div
                          className="absolute inset-0 origin-top rounded-full"
                          style={{ backgroundColor: s.color }}
                          initial={false}
                          animate={{ scaleY: done ? 1 : 0 }}
                          transition={{ duration: reduce ? 0 : 0.5 }}
                        />
                      </div>
                    )}
                  </div>

                  <div
                    className={`min-w-0 flex-1 self-start overflow-hidden rounded-2xl border bg-white transition-shadow ${
                      isActive ? 'shadow-lg' : 'shadow-sm hover:shadow-md'
                    }`}
                    style={{
                      borderColor: isActive ? s.color : '#e2e8f0',
                      borderLeftWidth: 6,
                      borderLeftColor: s.color,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-6"
                    >
                      <span className="text-base font-bold leading-snug sm:text-xl" style={{ color: s.color }}>
                        {s.title}
                      </span>
                      <motion.span
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: reduce ? 0 : 0.25 }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                      >
                        <ChevronDown className="h-5 w-5" />
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={panelId}
                          key="panel"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: reduce ? 0 : 0.3, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-5 sm:px-6">
                            <p className="text-sm leading-relaxed text-slate-600 sm:text-base [&_b]:font-bold [&_b]:text-slate-900">
                              {s.desc}
                            </p>

                            {s.chip && (
                              <span
                                className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold sm:text-sm"
                                style={{
                                  color: s.color,
                                  backgroundColor: `${s.color}1a`,
                                  borderColor: `${s.color}55`,
                                }}
                              >
                                {s.warn && <AlertTriangle className="h-4 w-4" />}
                                {s.chip}
                              </span>
                            )}

                            <div className="mt-4 flex flex-wrap gap-2">
                              {s.action && (
                                <button
                                  type="button"
                                  onClick={() => runAction(s.action)}
                                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow transition hover:brightness-110 active:scale-95"
                                  style={{ backgroundColor: s.color }}
                                >
                                  {s.action === 'login' ? (
                                    <LogIn className="h-4 w-4" />
                                  ) : (
                                    <UserPlus className="h-4 w-4" />
                                  )}
                                  {s.action === 'login' ? 'Login Sekarang' : 'Daftar Sekarang'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => goNext(i)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-95"
                              >
                                {i === STEPS.length - 1 ? (
                                  <>
                                    <RotateCcw className="h-4 w-4" /> Ulangi dari awal
                                  </>
                                ) : (
                                  <>
                                    Langkah berikutnya <ArrowRight className="h-4 w-4" />
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>

        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={() =>
              document.getElementById('kontak-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200/90 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-blue-50 hover:text-blue-700"
            title="Lanjut ke Bagian Kontak & Lokasi Peta"
          >
            <span>Lanjut ke Kontak & Lokasi Peta</span>
            <ChevronDown className="h-3.5 w-3.5 animate-bounce text-blue-600 transition-transform group-hover:translate-y-0.5" />
          </button>
        </div>
      </div>
    </section>
  );
};

// ===========================================================================
// HELPER GULIR HALUS
// ===========================================================================
