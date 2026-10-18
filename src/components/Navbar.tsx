import React, { useState } from 'react';
import { User, Student } from '../types/database';
import { 
  Menu, 
  X, 
  ChevronDown, 
  UserCheck, 
  Shield, 
  ExternalLink, 
  LogOut, 
  BookOpen, 
  Home, 
  Layers, 
  ListChecks,
  Building2
} from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  currentStudent?: Student | null;
  activeView: 'home' | 'portal' | 'login' | 'student-dashboard' | 'admin-dashboard';
  setActiveView: (view: 'home' | 'portal' | 'login' | 'student-dashboard' | 'admin-dashboard') => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentStudent,
  activeView,
  setActiveView,
  onLogout,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [jurusanDropdownOpen, setJurusanDropdownOpen] = useState(false);

  const logoUrl =
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgzWdtCjCcX2chJuhLX_26N5MmkVK-1SkyO7kgXznQQJPQa6_TB_EJzD1WWpztg7yX9RBRE7rGn0t2Z3FdG06mwwT6pQix8t6vnlcOBm_EgGl9z0jeJemJkppP0KIIjkXGksQvaCLh2dz-gOF6a2H213VQBL6Am8Elhmd76OOnphogk-EoTTbkYbg0TQJhv/s512/34690.png';

  const navigateTo = (view: 'home' | 'portal' | 'login' | 'student-dashboard' | 'admin-dashboard', sectionId?: string) => {
    setActiveView(view);
    setMenuOpen(false);
    setJurusanDropdownOpen(false);
    
    if (typeof window !== 'undefined') {
      if (sectionId) {
        // Bug fixed: Removed fallback to 'profil-sekolah'
        setTimeout(() => {
          const el = document.getElementById(sectionId);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else if (view === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white shadow-lg border-b border-indigo-900/40 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 py-3 lg:py-0">
          
          {/* ZONE 1: BRAND LOGO */}
          <div 
            onClick={() => navigateTo('home')} 
            className="flex items-center gap-3 cursor-pointer group"
          >
            <img
              src={logoUrl}
              alt="Logo SMK Muhammadiyah Bawang"
              className="w-10 h-10 lg:w-11 lg:h-11 object-contain drop-shadow"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-sm lg:text-base tracking-wider text-white flex items-center gap-1.5">
                SPMB <span className="text-yellow-300">SMK MUHIBA</span>
              </span>
              <span className="text-[10px] lg:text-[11px] text-blue-200 tracking-tight font-medium">
                SMK Muhammadiyah Bawang
              </span>
            </div>
          </div>

          {/* ZONE 2: DESKTOP NAVIGATION (Hidden on mobile/tablet) */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold tracking-wide">
            <button
              onClick={() => navigateTo('home')}
              className={`transition-colors py-1 hover:text-yellow-300 ${
                activeView === 'home' ? 'text-yellow-300 border-b-2 border-yellow-300' : 'text-white/90'
              }`}
            >
              Home
            </button>

            <button
              onClick={() => navigateTo('home', 'profil-sekolah')}
              className="text-white/90 hover:text-yellow-300 transition-colors py-1"
            >
              Profil Sekolah
            </button>

            {/* Jurusan Dropdown */}
            <div className="relative">
              <button
                onClick={() => setJurusanDropdownOpen(!jurusanDropdownOpen)}
                className="flex items-center gap-1 text-white/90 hover:text-yellow-300 transition-colors py-1 focus:outline-none"
              >
                <span>Jurusan</span>
                <ChevronDown className="w-4 h-4 transition-transform duration-200" />
              </button>

              {jurusanDropdownOpen && (
                <div 
                  className="absolute left-0 mt-2 w-64 bg-white text-slate-800 rounded-lg shadow-xl py-2 z-50 border border-slate-100"
                  onMouseLeave={() => setJurusanDropdownOpen(false)}
                >
                  <button
                    onClick={() => navigateTo('home', 'jurusan-to')}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 text-xs font-semibold flex items-center justify-between"
                  >
                    <span>Teknik Otomotif</span>
                  </button>
                  <button
                    onClick={() => navigateTo('home', 'jurusan-tjkt')}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 text-xs font-semibold flex items-center justify-between"
                  >
                    <span>Teknik Komputer & Jaringan</span>
                  </button>
                  <button
                    onClick={() => navigateTo('home', 'jurusan-akl')}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 text-xs font-semibold flex items-center justify-between"
                  >
                    <span>Akuntansi & Keuangan</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => navigateTo('home', 'fasilitas-section')}
              className="text-white/90 hover:text-yellow-300 transition-colors py-1"
            >
              Fasilitas
            </button>

            <button
              onClick={() => navigateTo('home', 'alur-pendaftaran')}
              className="relative py-1 font-bold text-yellow-300 hover:text-white transition-colors"
            >
              Alur Pendaftaran
            </button>

            <button
              onClick={() => navigateTo('home', 'kontak-section')}
              className="text-white/90 hover:text-yellow-300 transition-colors py-1"
            >
              Kontak
            </button>
          </nav>

          {/* ZONE 3: ACTIONS & MOBILE MENU TOGGLE */}
          <div className="flex items-center gap-3 h-full">
            {currentUser ? (
              <div className="hidden sm:flex items-center gap-2">
                {currentUser.role === 'admin' ? (
                  <button
                    onClick={() => navigateTo('admin-dashboard')}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Panel Admin</span>
                  </button>
                ) : (
                  <button
                    onClick={() => navigateTo('student-dashboard')}
                    className="px-3.5 py-2 text-xs font-bold text-blue-900 bg-yellow-300 hover:bg-yellow-400 rounded-md shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-blue-950" />
                    <span>Dashboard ({currentStudent?.nama_lengkap?.split(' ')[0] || 'Siswa'})</span>
                  </button>
                )}
                <button
                  onClick={onLogout}
                  title="Keluar"
                  className="p-2 text-white/80 hover:text-white hover:bg-blue-700/50 rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={() => navigateTo('login')}
                  className="px-4 py-2 text-xs font-bold text-blue-100 hover:text-white hover:bg-blue-700/50 rounded-lg transition-colors border border-blue-400/40"
                >
                  Login
                </button>
                <button
                  onClick={() => navigateTo('portal')}
                  className="px-4 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-lg shadow-md transition-all active:scale-95"
                >
                  DAFTAR SEKARANG
                </button>
              </div>
            )}

            {/* MOBILE MENU TOGGLE (HAMBURGER) */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2 text-white bg-blue-800/80 hover:bg-blue-700 active:bg-blue-900 border border-blue-400/50 rounded-lg shadow-sm transition-all focus:outline-none"
              aria-label="Navigasi Menu"
            >
              {menuOpen ? (
                <X className="w-5 h-5 text-yellow-300" />
              ) : (
                <Menu className="w-5 h-5 text-yellow-300" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE/TABLET DRAWER */}
      {menuOpen && (
        <div className="lg:hidden bg-gradient-to-b from-indigo-900/98 via-blue-900/98 to-purple-950/98 backdrop-blur-xl border-t border-indigo-500/30 shadow-2xl px-4 py-6 animate-in slide-in-from-top-3 duration-200">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Navigasi Utama Mobile */}
            <div className="space-y-2 text-sm font-medium">
              <p className="text-[11px] font-extrabold text-yellow-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5" />
                <span>Menu Utama</span>
              </p>
              
              <button
                onClick={() => navigateTo('home')}
                className="w-full text-left py-2.5 px-3 rounded-md hover:bg-blue-800/80 text-white transition-colors"
              >
                Beranda (Home)
              </button>
              <button
                onClick={() => navigateTo('home', 'profil-sekolah')}
                className="w-full text-left py-2.5 px-3 rounded-md hover:bg-blue-800/80 text-white transition-colors"
              >
                Profil Sekolah
              </button>
              <button
                onClick={() => navigateTo('home', 'fasilitas-section')}
                className="w-full text-left py-2.5 px-3 rounded-md hover:bg-blue-800/80 text-white transition-colors"
              >
                Fasilitas & Gedung
              </button>
              <button
                onClick={() => navigateTo('home', 'alur-pendaftaran')}
                className="w-full text-left py-2.5 px-3 rounded-md hover:bg-blue-800/80 text-yellow-300 font-bold flex items-center gap-2 transition-colors"
              >
                <ListChecks className="w-4 h-4" /> Alur Pendaftaran
              </button>
              <button
                onClick={() => navigateTo('home', 'kontak-section')}
                className="w-full text-left py-2.5 px-3 rounded-md hover:bg-blue-800/80 text-white transition-colors"
              >
                Hubungi Kami (Contact)
              </button>
            </div>

            {/* Jurusan Mobile */}
            <div className="space-y-2">
              <p className="text-[11px] font-extrabold text-yellow-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Jurusan & Keahlian</span>
              </p>
              <button
                onClick={() => navigateTo('home', 'jurusan-to')}
                className="w-full text-left p-3 rounded-lg bg-blue-800/40 text-white text-sm transition-colors hover:bg-blue-800/90"
              >
                Teknik Otomotif (TO)
              </button>
              <button
                onClick={() => navigateTo('home', 'jurusan-tjkt')}
                className="w-full text-left p-3 rounded-lg bg-blue-800/40 text-white text-sm transition-colors hover:bg-blue-800/90"
              >
                Teknik Jaringan Komputer (TJKT)
              </button>
              <button
                onClick={() => navigateTo('home', 'jurusan-akl')}
                className="w-full text-left p-3 rounded-lg bg-blue-800/40 text-white text-sm transition-colors hover:bg-blue-800/90"
              >
                Akuntansi & Keuangan (AKL)
              </button>
            </div>

            {/* Aksi Mobile */}
            <div className="space-y-3 pt-4 border-t border-blue-700/50">
              {currentUser ? (
                <div className="space-y-2">
                  <button
                    onClick={() => navigateTo(currentUser.role === 'admin' ? 'admin-dashboard' : 'student-dashboard')}
                    className="w-full py-3 px-3 text-center text-sm font-bold text-blue-900 bg-yellow-300 rounded-lg shadow-md"
                  >
                    Buka Dashboard
                  </button>
                  <button
                    onClick={onLogout}
                    className="w-full py-3 text-center text-sm font-semibold text-rose-300 hover:text-rose-200"
                  >
                    Keluar Akun
                  </button>
                </div>
              ) : (
                <div className="space-y-3 flex flex-col sm:hidden">
                  <button
                    onClick={() => navigateTo('portal')}
                    className="w-full py-3 px-3 text-center text-sm font-black text-white bg-gradient-to-r from-red-600 to-rose-600 rounded-lg shadow-md uppercase"
                  >
                    DAFTAR SEKARANG
                  </button>
                  <button
                    onClick={() => navigateTo('login')}
                    className="w-full py-3 px-3 text-center text-sm font-bold text-blue-100 bg-blue-700/60 border border-blue-400/40 rounded-lg"
                  >
                    Login Siswa
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </header>
  );
};
