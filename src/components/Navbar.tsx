import React, { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { User, Student } from '../types/database';

type View = 'home' | 'portal' | 'login' | 'student-dashboard' | 'admin-dashboard';

interface NavbarProps {
  currentUser: User | null;
  currentStudent?: Student | null;
  activeView: View;
  setActiveView: (view: View) => void;
  onLogout: () => void;
}

const LOGO_URL =
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgzWdtCjCcX2chJuhLX_26N5MmkVK-1SkyO7kgXznQQJPQa6_TB_EJzD1WWpztg7yX9RBRE7rGn0t2Z3FdG06mwwT6pQix8t6vnlcOBm_EgGl9z0jeJemJkppP0KIIjkXGksQvaCLh2dz-gOF6a2H213VQBL6Am8Elhmd76OOnphogk-EoTTbkYbg0TQJhv/s512/34690.png';

// Urutan menu mengikuti urutan bagian di halaman Beranda
const NAV_ITEMS: { label: string; id: string; accent?: boolean }[] = [
  { label: 'Beranda', id: 'top' },
  { label: 'Profil', id: 'profil-sekolah' },
  { label: 'Jurusan', id: 'jurusan-section' },
  { label: 'Fasilitas', id: 'fasilitas-section' },
  { label: 'Alur Pendaftaran', id: 'alur-pendaftaran', accent: true },
  { label: 'Kontak', id: 'kontak-section' },
];

/**
 * Kunci singkat agar skrip "gulir cepat ke Profil Sekolah" di LandingPage
 * tidak membajak gulir yang dipicu menu (penyebab menu Alur Pendaftaran
 * sebelumnya melompat ke Profil Sekolah).
 */
const lockAutoScroll = (ms = 1800) => {
  (window as any).__spmbNavLockUntil = Date.now() + ms;
};

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentStudent,
  activeView,
  setActiveView,
  onLogout,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  // ---- Navigasi ke bagian halaman -----------------------------------------
  const scrollToId = (id: string) => {
    lockAutoScroll();
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Tunggu bagian ter-render (mis. saat pindah dari halaman Login/Portal)
    let tries = 0;
    const attempt = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (tries++ < 40) window.setTimeout(attempt, 50);
    };
    attempt();
  };

  const goSection = (id: string) => {
    setMenuOpen(false);
    if (activeView !== 'home') setActiveView('home');
    scrollToId(id);
  };

  const goView = (view: View) => {
    setMenuOpen(false);
    setActiveView(view);
    window.scrollTo({ top: 0 });
  };

  // ---- Menu seluler: kunci gulir latar, Esc menutup, tutup saat layar melebar
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    const onResize = () => window.innerWidth >= 1024 && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [menuOpen]);

  // ---- Penanda bagian aktif (scroll-spy) ----------------------------------
  useEffect(() => {
    if (activeView !== 'home') {
      setActiveSection('');
      return;
    }
    const ids = NAV_ITEMS.filter((n) => n.id !== 'top').map((n) => n.id);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { rootMargin: '-35% 0px -55% 0px' }
    );
    const timer = window.setTimeout(() => {
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }, 300);
    const onScroll = () => {
      if (window.scrollY < 120) setActiveSection('');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [activeView]);

  const isActive = (id: string) =>
    activeView === 'home' && (id === 'top' ? activeSection === '' : activeSection === id);

  const firstName = currentStudent?.nama_lengkap?.split(' ')[0] || 'Siswa';
  const isAdmin = currentUser?.role === 'admin';

  const linkClass = (id: string, accent?: boolean) =>
    `relative py-2 text-sm font-semibold transition-colors ${
      isActive(id)
        ? 'text-white after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-yellow-300'
        : accent
        ? 'text-yellow-300 hover:text-white'
        : 'text-blue-100 hover:text-white'
    }`;

  return (
    <header className="sticky top-0 z-50 bg-blue-900 text-white border-b border-white/10 shadow-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Merek */}
        <button
          type="button"
          onClick={() => goSection('top')}
          className="flex min-w-0 items-center gap-3 text-left"
          aria-label="Ke beranda SPMB SMK Muhiba"
        >
          <img
            src={LOGO_URL}
            alt="Logo SMK Muhammadiyah Bawang"
            className="h-10 w-10 shrink-0 object-contain"
            referrerPolicy="no-referrer"
          />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-extrabold tracking-wide">
              SPMB <span className="text-yellow-300">SMK MUHIBA</span>
            </span>
            <span className="hidden truncate text-[11px] font-medium text-blue-200 sm:block">
              SMK Muhammadiyah Bawang
            </span>
          </span>
        </button>

        {/* Menu desktop */}
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Navigasi utama">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goSection(item.id)}
              className={linkClass(item.id, item.accent)}
              aria-current={isActive(item.id) ? 'true' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Aksi */}
        <div className="flex shrink-0 items-center gap-2">
          {currentUser ? (
            <>
              <button
                type="button"
                onClick={() => goView(isAdmin ? 'admin-dashboard' : 'student-dashboard')}
                className="rounded-lg bg-yellow-300 px-3.5 py-2 text-xs font-bold text-blue-950 transition hover:bg-yellow-200 active:scale-95"
              >
                <span className="sm:hidden">Dashboard</span>
                <span className="hidden sm:inline">
                  {isAdmin ? 'Panel Admin' : `Dashboard ${firstName}`}
                </span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="hidden rounded-lg px-3 py-2 text-xs font-semibold text-blue-100 transition hover:bg-white/10 hover:text-white lg:block"
              >
                Keluar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => goView('login')}
                className="hidden rounded-lg border border-white/30 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-white/10 lg:block"
              >
                Login Siswa
              </button>
              <button
                type="button"
                onClick={() => goView('portal')}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-extrabold uppercase tracking-wide text-white transition hover:bg-red-500 active:scale-95"
              >
                <span className="sm:hidden">Daftar</span>
                <span className="hidden sm:inline">Daftar Sekarang</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white transition hover:bg-white/10 active:scale-95 lg:hidden"
            aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={menuOpen}
            aria-controls="menu-seluler"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Menu seluler (layar penuh di bawah header) */}
      {menuOpen && (
        <div
          id="menu-seluler"
          className="fixed inset-x-0 bottom-0 top-16 overflow-y-auto bg-blue-950 lg:hidden"
        >
          <nav className="mx-auto flex max-w-md flex-col px-5 py-4" aria-label="Navigasi seluler">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goSection(item.id)}
                className={`flex min-h-[52px] items-center justify-between border-b border-white/10 text-left text-base font-semibold ${
                  isActive(item.id)
                    ? 'text-yellow-300'
                    : item.accent
                    ? 'text-yellow-200'
                    : 'text-white'
                }`}
              >
                <span>{item.label}</span>
                {isActive(item.id) && <span className="h-2 w-2 rounded-full bg-yellow-300" />}
              </button>
            ))}

            <div className="mt-6 flex flex-col gap-3">
              {currentUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => goView(isAdmin ? 'admin-dashboard' : 'student-dashboard')}
                    className="min-h-[48px] rounded-xl bg-yellow-300 text-sm font-bold text-blue-950 active:scale-[0.98]"
                  >
                    {isAdmin ? 'Buka Panel Admin' : 'Buka Dashboard Siswa'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    className="min-h-[48px] rounded-xl border border-white/25 text-sm font-semibold text-rose-200 active:scale-[0.98]"
                  >
                    Keluar
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => goView('portal')}
                    className="min-h-[48px] rounded-xl bg-red-600 text-sm font-extrabold uppercase tracking-wide text-white active:scale-[0.98]"
                  >
                    Daftar Sekarang
                  </button>
                  <button
                    type="button"
                    onClick={() => goView('login')}
                    className="min-h-[48px] rounded-xl border border-white/30 text-sm font-bold text-white active:scale-[0.98]"
                  >
                    Login Siswa
                  </button>
                </>
              )}
            </div>

            <a
              href="https://www.smkmuhiba.sch.id"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 text-center text-xs font-semibold text-blue-300"
            >
              Website Resmi smkmuhiba.sch.id
            </a>
          </nav>
        </div>
      )}
    </header>
  );
};
