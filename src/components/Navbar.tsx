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

const LOGO_URL =
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgzWdtCjCcX2chJuhLX_26N5MmkVK-1SkyO7kgXznQQJPQa6_TB_EJzD1WWpztg7yX9RBRE7rGn0t2Z3FdG06mwwT6pQix8t6vnlcOBm_EgGl9z0jeJemJkppP0KIIjkXGksQvaCLh2dz-gOF6a2H213VQBL6Am8Elhmd76OOnphogk-EoTTbkYbg0TQJhv/s512/34690.png';

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
  { id: 'jurusan-to', short: 'TO', full: 'Teknik Otomotif', mobile: 'Teknik Otomotif (TO)', dot: 'bg-amber-400' },
  { id: 'jurusan-tjkt', short: 'TJKT', full: 'Teknik Komputer & Jaringan', mobile: 'Teknik Jaringan Komputer (TJKT)', dot: 'bg-blue-400' },
  { id: 'jurusan-akl', short: 'AKL', full: 'Akuntansi & Keuangan', mobile: 'Akuntansi & Keuangan (AKL)', dot: 'bg-emerald-400' },
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
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();

  const navigateTo = (view: View, sectionId?: string) => {
    setActiveView(view);
    setMenuOpen(false);
    setJurusanDropdownOpen(false);

    if (typeof window === 'undefined') return;
    if (sectionId) {
      scrollToSection(sectionId);
    } else if (view === 'home' && activeView === 'home') {
      // sudah di beranda: gulir halus ke atas. (Dari halaman lain, reset posisi ditangani transisi halaman.)
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Tutup dropdown saat klik di luar, dan menu saat menekan Escape
  useEffect(() => {
    if (!jurusanDropdownOpen && !menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (jurusanDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setJurusanDropdownOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setJurusanDropdownOpen(false);
        setMenuOpen(false);
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

  const mobileRow =
    'flex h-12 w-full items-center justify-between rounded-2xl px-4 text-left text-[0.95rem] font-medium text-slate-700 transition-colors active:bg-indigo-50 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';

  return (
    <>
      <header className="ui-header z-50">
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">

          {/* Brand */}
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="flex min-w-0 items-center gap-3 rounded-xl py-1 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="SPMB SMK Muhiba, ke beranda"
          >
            <img
              src={LOGO_URL}
              alt="Logo SMK Muhammadiyah Bawang"
              className="h-10 w-10 shrink-0 object-contain drop-shadow-md"
              referrerPolicy="no-referrer"
              loading="eager"
              decoding="async"
            />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[0.95rem] font-extrabold tracking-tight sm:text-base">SPMB SMK MUHIBA</span>
              <span className="hidden truncate text-xs text-indigo-100 min-[400px]:block">SMK Muhammadiyah Bawang</span>
            </span>
          </button>

          {/* Navigasi desktop */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
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

            {/* Jurusan */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setJurusanDropdownOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={jurusanDropdownOpen}
                className={`${linkBase} ${jurusanDropdownOpen ? linkActive : linkIdle} flex items-center gap-1`}
              >
                <span>Jurusan</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${jurusanDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {jurusanDropdownOpen && (
                  <motion.div
                    role="menu"
                    initial={reduce ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-100 bg-white p-1.5 text-slate-800 shadow-[0_30px_50px_-20px_rgba(30,27,75,.45)]"
                  >
                    {JURUSAN_MENU.map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        role="menuitem"
                        onClick={() => navigateTo('home', j.id)}
                        className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors hover:bg-indigo-50 focus-visible:bg-indigo-50 focus-visible:outline-none"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${j.dot}`} />
                        <span className="flex-1">{j.full}</span>
                        <span className="text-xs font-semibold text-slate-400">{j.short}</span>
                      </button>
                    ))}
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
          <div className="flex shrink-0 items-center gap-2">
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
                <button
                  type="button"
                  onClick={() => navigateTo('portal')}
                  onMouseEnter={onPreloadPortal}
                  onTouchStart={onPreloadPortal}
                  onFocus={onPreloadPortal}
                  className="flex h-10 cursor-pointer items-center rounded-xl bg-white px-4 text-sm font-bold text-indigo-700 shadow-[0_14px_24px_-14px_rgba(15,23,42,.6)] transition-transform hover:-translate-y-0.5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
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

        {/* Menu ponsel/tablet: melayang di bawah header, tidak mendorong isi halaman */}
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
              className="absolute inset-x-0 top-full max-h-[calc(100dvh_-_4.25rem)] overflow-y-auto rounded-b-[2rem] bg-white px-3 pb-5 pt-3 shadow-[0_40px_60px_-24px_rgba(30,27,75,.55)] lg:hidden"
            >
              <div className="mx-auto max-w-xl space-y-1">
                <button type="button" onClick={() => navigateTo('home')} className={mobileRow}>
                  <span>Beranda</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>
                <button type="button" onClick={() => navigateTo('home', 'profil-sekolah')} className={mobileRow}>
                  <span>Profil Sekolah</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>
                <button type="button" onClick={() => navigateTo('home', 'fasilitas-section')} className={mobileRow}>
                  <span>Fasilitas & Gedung</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>
                <button type="button" onClick={() => navigateTo('home', 'alur-pendaftaran')} className={mobileRow}>
                  <span>Alur Pendaftaran</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>
                <button type="button" onClick={() => navigateTo('home', 'kontak-section')} className={mobileRow}>
                  <span>Hubungi Kami</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>

                <p className="px-4 pb-1 pt-3 text-xs font-semibold text-slate-400">Jurusan</p>
                {JURUSAN_MENU.map((j) => (
                  <button key={j.id} type="button" onClick={() => navigateTo('home', j.id)} className={mobileRow}>
                    <span className="flex items-center gap-3">
                      <span className={`h-2 w-2 rounded-full ${j.dot}`} />
                      <span>{j.mobile}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </button>
                ))}

                <div className="space-y-2.5 border-t border-slate-100 pt-4">
                  {currentUser ? (
                    <>
                      <button
                        type="button"
                        onClick={() => navigateTo(currentUser.role === 'admin' ? 'admin-dashboard' : 'student-dashboard')}
                        className="flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-[0_18px_30px_-16px_rgba(91,61,240,.9)] transition-transform active:scale-[0.97]"
                      >
                        Buka Dashboard
                      </button>
                      <button
                        type="button"
                        onClick={onLogout}
                        className="flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50"
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
                        className="flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-[0_18px_30px_-16px_rgba(91,61,240,.9)] transition-transform active:scale-[0.97]"
                      >
                        Daftar Sekarang
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateTo('login')}
                        onTouchStart={onPreloadLogin}
                        onMouseEnter={onPreloadLogin}
                        className="flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-indigo-50 text-sm font-semibold text-indigo-700 transition-transform active:scale-[0.97]"
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
