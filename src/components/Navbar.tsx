import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { User, Student } from '../types/database';
import {
Menu,
X,
ChevronDown,
ChevronRight,
UserCheck,
Shield,
LogOut,
} from 'lucide-react';
type View = 'home' | 'portal' | 'login' | 'student-dashboard' | 'admin-dashboard';
interface NavbarProps {
currentUser: User | null;
currentStudent?: Student | null;
activeView: View;
setActiveView: (view: View) => void;
onLogout: () => void;
onPreloadPortal?: () => void;
onPreloadLogin?: () => void;
}
/** Logo sama dengan yang dipakai di footer LandingPage */
const LOGO_URL =
'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEitrsbiiNxOvmcHcN42oOETm0n2rp4n_UYCdRDLH05Z0fD7mLw5rNXwVxft7SBrIMQyi3LSs9DUa-v6QZBrKjE8o9G7RQ171bu0cirIUmWWD6E8wxn9Ua-t61RbRENkAb-U9bhBgdtq-eh0JYAN3hu0r9sCeNdjGFODdPWaNN-5v-NmQB63uOuMRAvgkODt/s1774/69228.png';
/** Mencari section hingga muncul (halaman beranda bisa baru saja tampil) lalu menggulir halus ke sana. */
const scrollToSection = (sectionId: string) => {
// cegah skrip "gulir cepat ke Profil" di LandingPage membajak gulir dari menu
(window as any).__spmbNavLockUntil = Date.now() + 1800;
let tries = 0;
const attempt = () => {
const el = document.getElementById(sectionId);
if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
else if (tries++ < 15) window.setTimeout(attempt, 80);
};
window.setTimeout(attempt, 120);
};
const JURUSAN_MENU = [
{
id: 'jurusan-to',
short: 'TO',
full: 'Teknik Otomotif',
desc: 'Mesin, TBSM & teknologi kendaraan',
mobile: 'Teknik Otomotif (TO)',
dot: 'bg-amber-400',
accent: 'from-amber-500 to-orange-500',
},
{
id: 'jurusan-tjkt',
short: 'TJKT',
full: 'Teknik Komputer & Jaringan',
desc: 'Fiber optic, Mikrotik & keamanan siber',
mobile: 'Teknik Jaringan Komputer (TJKT)',
dot: 'bg-blue-400',
accent: 'from-blue-500 to-indigo-500',
},
{
id: 'jurusan-akl',
short: 'AKL',
full: 'Akuntansi & Keuangan',
desc: 'Fintech, perbankan & akuntansi digital',
mobile: 'Akuntansi & Keuangan (AKL)',
dot: 'bg-emerald-400',
accent: 'from-emerald-500 to-teal-500',
},
];
export const Navbar: React.FC<NavbarProps> = ({
currentUser,
currentStudent,
activeView,
setActiveView,
onLogout,
onPreloadPortal,
onPreloadLogin,
}) => {
const [menuOpen, setMenuOpen] = useState(false);
const [jurusanDropdownOpen, setJurusanDropdownOpen] = useState(false);
const [hoveredJurusan, setHoveredJurusan] = useState<string | null>(null);
const dropdownRef = useRef<HTMLDivElement | null>(null);
const reduce = useReducedMotion();
const navigateTo = (view: View, sectionId?: string) => {
setActiveView(view);
setMenuOpen(false);
setJurusanDropdownOpen(false);
setHoveredJurusan(null);
if (typeof window === 'undefined') return;
if (sectionId) {
scrollToSection(sectionId);
} else if (view === 'home' && activeView === 'home') {
window.scrollTo({ top: 0, behavior: 'smooth' });
}
};
// Tutup dropdown saat klik di luar, dan menu saat menekan Escape
useEffect(() => {
if (!jurusanDropdownOpen && !menuOpen) return;
const onDown = (e: MouseEvent) => {
if (jurusanDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
setJurusanDropdownOpen(false);
setHoveredJurusan(null);
}
};
const onKey = (e: KeyboardEvent) => {
if (e.key === 'Escape') {
setJurusanDropdownOpen(false);
setMenuOpen(false);
setHoveredJurusan(null);
}
};
document.addEventListener('mousedown', onDown);
document.addEventListener('keydown', onKey);
return () => {
document.removeEventListener('mousedown', onDown);
document.removeEventListener('keydown', onKey);
};
}, [jurusanDropdownOpen, menuOpen]);
const linkBase =
'relative rounded-xl px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70';
const linkIdle = 'text-white/80 hover:bg-white/10 hover:text-white';
const linkActive = 'bg-white/15 text-white';
// Mobile menu mengikuti warna navbar, bukan putih
const mobileRow =
'flex h-12 w-full items-center justify-between rounded-2xl px-4 text-left text-[0.95rem] font-medium text-white/90 transition-colors active:bg-white/15 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30';
return (
<>
<header className="ui-header !bg-gradient-to-r !from-blue-700 !via-indigo-700 !to-violet-600 z-50 overflow-visible">
  <div className="relative mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
    {/* Watermark Logo-1: hanya di area bar Navbar, tidak ikut memanjang ke menu mobile */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-14 w-28 -translate-x-1/2 -translate-y-1/2 bg-[url('/Logo-1.png')] bg-center bg-contain bg-no-repeat opacity-[0.15]"
      />
      {/* Brand — hanya logo (tanpa teks), ukuran dioptimalkan */}
      <button
        type="button"
        onClick={() => navigateTo('home')}
        className="relative z-10 flex shrink-0 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        aria-label="SPMB SMK Muhiba, ke beranda"
        >
        <img
        src={LOGO_URL}
        alt="Logo SMK Muhammadiyah Bawang"
        className="h-12 w-auto max-h-12 object-contain drop-shadow-md sm:h-14 sm:max-h-14"
        referrerPolicy="no-referrer"
        loading="eager"
        decoding="async"
        />
      </button>
      {/* Navigasi desktop */}
      <nav className="relative z-10 hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
        <button
          type="button"
          onClick={() => navigateTo('home')}
          aria-current={activeView === 'home' ? 'page' : undefined}
          className={`${linkBase} ${activeView === 'home' ? linkActive : linkIdle}`}
          >
          Home
        </button>
        <button type="button" onClick={() => navigateTo('home', 'profil-sekolah')} className={`${linkBase} ${linkIdle}`}>
          Profil Sekolah
        </button>
        {/* Jurusan — deskripsi tersembunyi, muncul saat hover/expand dengan animasi slide */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setJurusanDropdownOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={jurusanDropdownOpen}
            className={`${linkBase} ${jurusanDropdownOpen ? linkActive : linkIdle} flex items-center gap-1`}
            >
            <span>Jurusan</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${jurusanDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <AnimatePresence>
              {jurusanDropdownOpen && (
              <motion.div
              role="menu"
              initial={reduce ? false : { opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-100 bg-white p-1.5 text-slate-800 shadow-[0_30px_50px_-20px_rgba(30,27,75,.45)]"
              >
              {JURUSAN_MENU.map((j, idx) => {
              const isExpanded = hoveredJurusan === j.id;
              return (
              <motion.button
              key={j.id}
              type="button"
              role="menuitem"
              initial={reduce ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
              duration: 0.22,
              delay: reduce ? 0 : idx * 0.05,
              ease: [0.22, 1, 0.36, 1],
              }}
              onClick={() => navigateTo('home', j.id)}
              onMouseEnter={() => setHoveredJurusan(j.id)}
              onMouseLeave={() => setHoveredJurusan(null)}
              onFocus={() => setHoveredJurusan(j.id)}
              onBlur={() => setHoveredJurusan(null)}
              className="group relative flex w-full flex-col overflow-hidden rounded-xl px-3.5 py-2.5 text-left transition-colors hover:bg-indigo-50 focus-visible:bg-indigo-50 focus-visible:outline-none"
              >
              <div className="flex items-center gap-3">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${j.dot} shadow-sm ring-2 ring-white transition-transform duration-200 group-hover:scale-125`}
                  />
                  <span className="flex-1 text-sm font-semibold text-slate-800">{j.full}</span>
                  <span
                    className={`rounded-md bg-gradient-to-r ${j.accent} px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm`}
                    >
                    {j.short}
                  </span>
                </div>
                {/* Deskripsi tersembunyi → slide terbuka saat hover / fokus */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                  <motion.div
                  key="desc"
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                  >
                  <p className="mt-1.5 pl-5 text-xs leading-relaxed text-slate-500">
                    {j.desc}
                  </p>
                </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
            );
            })}
          </motion.div>
          )}
        </AnimatePresence>
      </div>
      <button type="button" onClick={() => navigateTo('home', 'fasilitas-section')} className={`${linkBase} ${linkIdle}`}>
        Fasilitas
      </button>
      <button type="button" onClick={() => navigateTo('home', 'alur-pendaftaran')} className={`${linkBase} ${linkIdle}`}>
        Alur Pendaftaran
      </button>
      <button type="button" onClick={() => navigateTo('home', 'kontak-section')} className={`${linkBase} ${linkIdle}`}>
        Kontak
      </button>
    </nav>
    {/* Aksi */}
    <div className="relative z-10 flex shrink-0 items-center gap-2">
      {currentUser ? (
      <div className="hidden items-center gap-2 sm:flex">
        {currentUser.role === 'admin' ? (
        <button
          type="button"
          onClick={() => navigateTo('admin-dashboard')}
          className="flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-indigo-700 shadow-[0_14px_24px_-14px_rgba(15,23,42,.6)] transition-transform hover:-translate-y-0.5 active:scale-95"
          >
          <Shield className="h-4 w-4" />
          <span>Panel Admin</span>
        </button>
        ) : (
        <button
          type="button"
          onClick={() => navigateTo('student-dashboard')}
          className="flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-indigo-700 shadow-[0_14px_24px_-14px_rgba(15,23,42,.6)] transition-transform hover:-translate-y-0.5 active:scale-95"
          >
          <UserCheck className="h-4 w-4" />
          <span>Dashboard ({currentStudent?.nama_lengkap?.split(' ')[0] || 'Siswa'})</span>
        </button>
        )}
        <button type="button" onClick={onLogout} title="Keluar" aria-label="Keluar" className="ui-hbtn !px-0 w-10">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      ) : (
      <>
      <button
        type="button"
        onClick={() => navigateTo('login')}
        onMouseEnter={onPreloadLogin}
        onTouchStart={onPreloadLogin}
        onFocus={onPreloadLogin}
        className="ui-hbtn hidden sm:inline-flex"
        >
        Login
      </button>
      {/* Daftar Sekarang → merah */}
      <button
        type="button"
        onClick={() => navigateTo('portal')}
        onMouseEnter={onPreloadPortal}
        onTouchStart={onPreloadPortal}
        onFocus={onPreloadPortal}
        className="flex h-10 cursor-pointer items-center rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 text-sm font-bold text-white shadow-[0_14px_24px_-14px_rgba(220,38,38,.55)] transition-all hover:from-red-500 hover:to-rose-500 hover:-translate-y-0.5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
        <span className="sm:hidden">Daftar</span>
        <span className="hidden sm:inline">Daftar Sekarang</span>
      </button>
    </>
    )}
    {/* Hamburger */}
    <button
      type="button"
      onClick={() => setMenuOpen((v) => !v)}
      className="ui-hbtn !px-0 w-10 lg:hidden"
      aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
      aria-expanded={menuOpen}
      aria-controls="mobile-nav"
      >
      {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  </div>
</div>
{/* Menu ponsel/tablet */}
<AnimatePresence>
  {menuOpen && (
  <motion.div
  id="mobile-nav"
  role="dialog"
  aria-label="Menu navigasi"
  initial={reduce ? false : { opacity: 0, y: -10 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
  className="absolute inset-x-0 top-full max-h-[calc(100dvh_-_4.25rem)] overflow-y-auto rounded-b-[2rem] !bg-gradient-to-b !from-indigo-700 !via-indigo-800 !to-violet-800 px-3 pb-5 pt-3 shadow-[0_40px_60px_-24px_rgba(30,27,75,.55)] lg:hidden"
  >
  <div className="mx-auto max-w-xl space-y-1">
    <button type="button" onClick={() => navigateTo('home')} className={mobileRow}>
      <span>Beranda</span>
      <ChevronRight className="h-4 w-4 text-white/50" />
    </button>
    <button type="button" onClick={() => navigateTo('home', 'profil-sekolah')} className={mobileRow}>
      <span>Profil Sekolah</span>
      <ChevronRight className="h-4 w-4 text-white/50" />
    </button>
    <button type="button" onClick={() => navigateTo('home', 'fasilitas-section')} className={mobileRow}>
      <span>Fasilitas & Gedung</span>
      <ChevronRight className="h-4 w-4 text-white/50" />
    </button>
    <button type="button" onClick={() => navigateTo('home', 'alur-pendaftaran')} className={mobileRow}>
      <span>Alur Pendaftaran</span>
      <ChevronRight className="h-4 w-4 text-white/50" />
    </button>
    <button type="button" onClick={() => navigateTo('home', 'kontak-section')} className={mobileRow}>
      <span>Hubungi Kami</span>
      <ChevronRight className="h-4 w-4 text-white/50" />
    </button>
    <p className="px-4 pb-1 pt-3 text-xs font-semibold text-white/55">Jurusan</p>
    {JURUSAN_MENU.map((j) => (
    <button
      key={j.id}
      type="button"
      onClick={() => navigateTo('home', j.id)}
      className={mobileRow}
      >
      <span className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${j.dot}`} />
        <span>{j.mobile}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-white/50" />
    </button>
    ))}
    <div className="space-y-2.5 border-t border-white/15 pt-4">
      {currentUser ? (
      <>
      <button
        type="button"
        onClick={() =>
        navigateTo(currentUser.role === 'admin' ? 'admin-dashboard' : 'student-dashboard')
        }
        className="flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-[0_18px_30px_-16px_rgba(91,61,240,.9)] transition-transform active:scale-[0.97]"
        >
        Buka Dashboard
      </button>
      <button
        type="button"
        onClick={onLogout}
        className="flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl text-sm font-semibold text-white/90 transition-colors hover:bg-white/10"
        >
        Keluar Akun
      </button>
    </>
    ) : (
    <div className="flex flex-col gap-2.5 sm:hidden">
      <button
        type="button"
        onClick={() => navigateTo('portal')}
        onTouchStart={onPreloadPortal}
        onMouseEnter={onPreloadPortal}
        className="flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-sm font-bold text-white shadow-[0_18px_30px_-16px_rgba(220,38,38,.7)] transition-transform active:scale-[0.97]"
        >
        Daftar Sekarang
      </button>
      <button
        type="button"
        onClick={() => navigateTo('login')}
        onTouchStart={onPreloadLogin}
        onMouseEnter={onPreloadLogin}
        className="flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white ring-1 ring-white/15 transition-transform active:scale-[0.97]"
        >
        Login Siswa
      </button>
    </div>
    )}
  </div>
</div>
</motion.div>
)}
</AnimatePresence>
</header>
{/* Latar redup di belakang menu ponsel */}
<AnimatePresence>
  {menuOpen && (
  <motion.button
  type="button"
  aria-label="Tutup menu"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.2 }}
  onClick={() => setMenuOpen(false)}
  className="fixed inset-0 z-[45] cursor-default bg-slate-950/30 backdrop-blur-[2px] lg:hidden"
  />
  )}
</AnimatePresence>
</>
);
};
