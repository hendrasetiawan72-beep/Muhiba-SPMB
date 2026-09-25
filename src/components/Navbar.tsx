import React, { useState } from 'react';
import { User, Student } from '../types/database';
import { Menu, X, ChevronDown, UserCheck, Shield, ExternalLink, LogOut } from 'lucide-react';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [jurusanDropdownOpen, setJurusanDropdownOpen] = useState(false);

  const logoUrl =
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgzWdtCjCcX2chJuhLX_26N5MmkVK-1SkyO7kgXznQQJPQa6_TB_EJzD1WWpztg7yX9RBRE7rGn0t2Z3FdG06mwwT6pQix8t6vnlcOBm_EgGl9z0jeJemJkppP0KIIjkXGksQvaCLh2dz-gOF6a2H213VQBL6Am8Elhmd76OOnphogk-EoTTbkYbg0TQJhv/s512/34690.png';

  const navigateTo = (view: 'home' | 'portal' | 'login' | 'student-dashboard' | 'admin-dashboard', sectionId?: string) => {
    setActiveView(view);
    setMobileMenuOpen(false);
    setJurusanDropdownOpen(false);
    if (sectionId && typeof window !== 'undefined') {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#1e40af] text-white shadow-md border-b border-blue-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          
          {/* ZONE 1: BRAND LOGO */}
          <div 
            onClick={() => navigateTo('home')} 
            className="flex items-center gap-3 cursor-pointer group"
          >
            <img
              src={logoUrl}
              alt="Logo SMK Muhammadiyah Bawang"
              className="w-11 h-11 object-contain drop-shadow"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-wider text-white flex items-center gap-1.5">
                SPMB <span className="text-yellow-300">SMK MUHIBA</span>
              </span>
              <span className="text-[11px] text-blue-200 tracking-tight font-medium">
                SMK Muhammadiyah Bawang
              </span>
            </div>
          </div>

          {/* ZONE 2: NAVIGATION LINKS */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-semibold tracking-wide">
            <button
              onClick={() => navigateTo('home')}
              className={`transition-colors py-1 hover:text-yellow-300 ${
                activeView === 'home' ? 'text-yellow-300 border-b-2 border-yellow-300' : 'text-white/90'
              }`}
            >
              Home
            </button>

            <button
              onClick={() => navigateTo('home', 'jurusan-section')}
              className="text-white/90 hover:text-yellow-300 transition-colors py-1"
            >
              Konsentrasi Keahlian
            </button>

            <button
              onClick={() => navigateTo('home', 'profil-section')}
              className="text-white/90 hover:text-yellow-300 transition-colors py-1"
            >
              PROFIL
            </button>

            {/* Jurusan Dropdown */}
            <div className="relative">
              <button
                onClick={() => setJurusanDropdownOpen(!jurusanDropdownOpen)}
                className="flex items-center gap-1 text-white/90 hover:text-yellow-300 transition-colors py-1 focus:outline-none"
              >
                <span>JURUSAN</span>
                <ChevronDown className="w-4 h-4 transition-transform duration-200" />
              </button>

              {jurusanDropdownOpen && (
                <div 
                  className="absolute left-0 mt-2 w-72 bg-white text-slate-800 rounded-lg shadow-xl py-2 z-50 border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-150"
                  onMouseLeave={() => setJurusanDropdownOpen(false)}
                >
                  <button
                    onClick={() => navigateTo('home', 'jurusan-to')}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-xs font-semibold flex items-center justify-between group"
                  >
                    <span>Teknik Otomotif (TO)</span>
                    <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Otomotif</span>
                  </button>
                  <button
                    onClick={() => navigateTo('home', 'jurusan-tjkt')}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-xs font-semibold flex items-center justify-between group"
                  >
                    <span>Teknik Komputer & Jaringan (TJKT)</span>
                    <span className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">IT & Jaringan</span>
                  </button>
                  <button
                    onClick={() => navigateTo('home', 'jurusan-akl')}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-xs font-semibold flex items-center justify-between group"
                  >
                    <span>Akuntansi Keuangan Lembaga (AKL)</span>
                    <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Keuangan</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => navigateTo('home', 'fasilitas-section')}
              className="text-white/90 hover:text-yellow-300 transition-colors py-1"
            >
              FASILITAS
            </button>

            <button
              onClick={() => navigateTo('home', 'kontak-section')}
              className="text-white/90 hover:text-yellow-300 transition-colors py-1"
            >
              Contact Us
            </button>
          </nav>

          {/* ZONE 3: PRIMARY ACTIONS */}
          <div className="hidden sm:flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2">
                {currentUser.role === 'admin' ? (
                  <button
                    onClick={() => navigateTo('admin-dashboard')}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Panel Admin PPDB</span>
                  </button>
                ) : (
                  <button
                    onClick={() => navigateTo('student-dashboard')}
                    className="px-3.5 py-2 text-xs font-bold text-blue-900 bg-yellow-300 hover:bg-yellow-400 rounded-md shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-blue-950" />
                    <span>Dashboard Siswa ({currentStudent?.nama_lengkap?.split(' ')[0] || 'Siswa'})</span>
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
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => navigateTo('login')}
                  className="px-3.5 py-2 text-xs font-bold text-blue-100 hover:text-white hover:bg-blue-700/50 rounded-md transition-colors flex items-center gap-1.5 border border-blue-400/40"
                >
                  <span>Login Calon Peserta Didik</span>
                </button>

                <button
                  onClick={() => navigateTo('portal')}
                  className="px-4 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-md shadow-md hover:shadow-lg transition-all transform active:scale-95"
                >
                  DAFTAR SEKARANG !!!
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger menu */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-white rounded-md hover:bg-blue-700 focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-blue-900/95 border-b border-blue-800 px-4 pt-3 pb-6 space-y-3">
          <div className="flex flex-col space-y-2 text-sm font-medium">
            <button
              onClick={() => navigateTo('home')}
              className="text-left py-2 px-2 rounded hover:bg-blue-800 text-white"
            >
              Home
            </button>
            <button
              onClick={() => navigateTo('home', 'jurusan-section')}
              className="text-left py-2 px-2 rounded hover:bg-blue-800 text-white"
            >
              Konsentrasi Keahlian
            </button>
            <button
              onClick={() => navigateTo('home', 'profil-section')}
              className="text-left py-2 px-2 rounded hover:bg-blue-800 text-white"
            >
              PROFIL
            </button>
            <button
              onClick={() => navigateTo('home', 'fasilitas-section')}
              className="text-left py-2 px-2 rounded hover:bg-blue-800 text-white"
            >
              FASILITAS
            </button>
            <button
              onClick={() => navigateTo('home', 'kontak-section')}
              className="text-left py-2 px-2 rounded hover:bg-blue-800 text-white"
            >
              Contact Us
            </button>
            <a
              href="http://www.smkmuhiba.sch.id"
              target="_blank"
              rel="noopener noreferrer"
              className="text-left py-2 px-2 rounded hover:bg-blue-800 text-blue-200 flex items-center justify-between text-xs"
            >
              <span>Website Resmi Sekolah</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="pt-3 border-t border-blue-800 flex flex-col gap-2">
            {currentUser ? (
              <>
                {currentUser.role === 'admin' ? (
                  <button
                    onClick={() => navigateTo('admin-dashboard')}
                    className="w-full py-2.5 text-center text-xs font-bold text-white bg-slate-900 rounded-md"
                  >
                    Panel Admin PPDB
                  </button>
                ) : (
                  <button
                    onClick={() => navigateTo('student-dashboard')}
                    className="w-full py-2.5 text-center text-xs font-bold text-blue-900 bg-yellow-300 rounded-md"
                  >
                    Buka Dashboard Siswa
                  </button>
                )}
                <button
                  onClick={onLogout}
                  className="w-full py-2 text-center text-xs font-semibold text-rose-300 hover:text-rose-200"
                >
                  Keluar / Logout
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigateTo('login')}
                  className="w-full py-2.5 text-center text-xs font-bold text-white bg-blue-700 rounded-md"
                >
                  Login Calon Peserta Didik
                </button>
                <button
                  onClick={() => navigateTo('portal')}
                  className="w-full py-2.5 text-center text-xs font-extrabold text-white bg-red-600 rounded-md"
                >
                  DAFTAR SEKARANG !!!
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
