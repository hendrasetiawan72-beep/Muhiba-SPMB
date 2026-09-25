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
  Building2, 
  Phone, 
  Layers, 
  CheckCircle,
  Eye,
  EyeOff
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
  // Navigation drawer/dropdown state (triggered by 3-line hamburger menu)
  const [menuOpen, setMenuOpen] = useState(false);
  const [jurusanDropdownOpen, setJurusanDropdownOpen] = useState(false);
  // By default, navigation links are hidden behind the 3-line hamburger indicator on tablet and windows
  const [showFullHorizontalBar, setShowFullHorizontalBar] = useState(false);

  const logoUrl =
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgzWdtCjCcX2chJuhLX_26N5MmkVK-1SkyO7kgXznQQJPQa6_TB_EJzD1WWpztg7yX9RBRE7rGn0t2Z3FdG06mwwT6pQix8t6vnlcOBm_EgGl9z0jeJemJkppP0KIIjkXGksQvaCLh2dz-gOF6a2H213VQBL6Am8Elhmd76OOnphogk-EoTTbkYbg0TQJhv/s512/34690.png';

  const navigateTo = (view: 'home' | 'portal' | 'login' | 'student-dashboard' | 'admin-dashboard', sectionId?: string) => {
    setActiveView(view);
    setMenuOpen(false);
    setJurusanDropdownOpen(false);
    if (sectionId && typeof window !== 'undefined') {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#1e40af]/95 backdrop-blur-md text-white shadow-md border-b border-blue-900/30 transition-all duration-300">
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

          {/* ZONE 2: OPTIONAL FULL HORIZONTAL NAVIGATION (Visible only if user toggles expanded view) */}
          {showFullHorizontalBar && (
            <nav className="hidden xl:flex items-center gap-6 lg:gap-8 text-sm font-semibold tracking-wide animate-in fade-in duration-200">
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

              <a
                href="https://www.smkmuhiba.sch.id"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-300 hover:text-white transition-colors py-1 flex items-center gap-1 font-bold text-xs bg-blue-700/60 hover:bg-blue-700 px-2.5 py-1 rounded border border-blue-400/40"
                title="Kunjungi Website Resmi Sekolah"
              >
                <span>Web Sekolah</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              {/* Sembunyikan ke mode tiga garis */}
              <button
                onClick={() => setShowFullHorizontalBar(false)}
                title="Sembunyikan ke Navigasi Tiga Garis"
                className="text-xs text-blue-200 hover:text-white flex items-center gap-1 bg-blue-800/40 hover:bg-blue-700/60 px-2 py-1 rounded border border-blue-400/30"
              >
                <EyeOff className="w-3.5 h-3.5 text-yellow-300" />
                <span className="text-[11px]">Sembunyikan</span>
              </button>
            </nav>
          )}

          {/* ZONE 3: ACTIONS & NAVIGASI TIGA GARIS (HAMBURGER PENANDA NAVIGASI) */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="hidden sm:flex items-center gap-2">
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
              <div className="hidden sm:flex items-center gap-2.5">
                <button
                  onClick={() => navigateTo('login')}
                  className="px-3 py-1.5 text-xs font-bold text-blue-100 hover:text-white hover:bg-blue-700/50 rounded-md transition-colors flex items-center gap-1.5 border border-blue-400/40"
                >
                  <span>Login Siswa</span>
                </button>

                <button
                  onClick={() => navigateTo('portal')}
                  className="px-3.5 py-1.5 text-xs font-extrabold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-md shadow-md hover:shadow-lg transition-all transform active:scale-95"
                >
                  DAFTAR SEKARANG
                </button>
              </div>
            )}

            {/* NAVIGASI TIGA GARIS (HAMBURGER PENANDA NAVIGASI UNTUK SEMUA TAMPILAN: TABLET, WINDOWS & MOBILE) */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-3 py-2 text-white bg-blue-800/80 hover:bg-blue-700 border border-blue-400/50 rounded-lg shadow-sm transition-all focus:outline-none cursor-pointer group hover:border-yellow-300/80"
              aria-label="Navigasi Menu Tiga Garis"
              title={menuOpen ? 'Tutup Menu' : 'Buka Navigasi (Tiga Garis)'}
            >
              {menuOpen ? (
                <X className="w-5 h-5 text-yellow-300 transition-transform duration-200" />
              ) : (
                <Menu className="w-5 h-5 text-yellow-300 transition-transform duration-200 group-hover:scale-110" />
              )}
              <span className="text-xs font-extrabold tracking-wider text-yellow-200 group-hover:text-yellow-300">
                {menuOpen ? 'TUTUP' : 'MENU'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DRAWER / DROPDOWN NAVIGASI TIGA GARIS (TABLET, WINDOWS & MOBILE) */}
      {/* ========================================================================= */}
      {menuOpen && (
        <div className="bg-blue-900/98 backdrop-blur-xl border-t border-blue-800 shadow-2xl px-4 sm:px-6 lg:px-8 py-6 animate-in slide-in-from-top-3 duration-200">
          <div className="max-w-7xl mx-auto">
            
            {/* Header info in drawer */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-blue-800/80 text-xs">
              <div className="flex items-center gap-2 text-blue-200 font-semibold">
                <Menu className="w-4 h-4 text-yellow-300" />
                <span>Navigasi SPMB SMK Muhammadiyah Bawang</span>
              </div>

              {!showFullHorizontalBar && (
                <button
                  onClick={() => {
                    setShowFullHorizontalBar(true);
                    setMenuOpen(false);
                  }}
                  className="hidden xl:flex items-center gap-1.5 text-[11px] text-blue-200 hover:text-yellow-300 bg-blue-800/50 hover:bg-blue-800 px-2.5 py-1 rounded border border-blue-500/30 transition-colors"
                  title="Tampilkan deretan menu melintang di bar atas"
                >
                  <Eye className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Tampilkan Bar Menu Penuh</span>
                </button>
              )}
            </div>

            {/* Structured Navigation Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              
              {/* Kolom 1: Halaman & Bagian Utama */}
              <div className="space-y-3">
                <p className="text-[11px] font-extrabold text-yellow-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5" />
                  <span>Menu Utama</span>
                </p>
                <div className="space-y-1 text-sm font-medium">
                  <button
                    onClick={() => navigateTo('home')}
                    className="w-full text-left py-2 px-3 rounded-md hover:bg-blue-800/80 text-white flex items-center justify-between transition-colors"
                  >
                    <span>Beranda (Home)</span>
                    <span className="text-[10px] text-blue-300">Utama</span>
                  </button>
                  <button
                    onClick={() => navigateTo('home', 'profil-section')}
                    className="w-full text-left py-2 px-3 rounded-md hover:bg-blue-800/80 text-white flex items-center justify-between transition-colors"
                  >
                    <span>Profil Sekolah & Visi Misi</span>
                  </button>
                  <button
                    onClick={() => navigateTo('home', 'fasilitas-section')}
                    className="w-full text-left py-2 px-3 rounded-md hover:bg-blue-800/80 text-white flex items-center justify-between transition-colors"
                  >
                    <span>Fasilitas & Gedung</span>
                  </button>
                  <button
                    onClick={() => navigateTo('home', 'kontak-section')}
                    className="w-full text-left py-2 px-3 rounded-md hover:bg-blue-800/80 text-white flex items-center justify-between transition-colors"
                  >
                    <span>Hubungi Panitia (Contact Us)</span>
                  </button>
                  <a
                    href="https://www.smkmuhiba.sch.id"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-left py-2 px-3 rounded-md hover:bg-blue-800/80 text-yellow-300 font-bold flex items-center justify-between text-xs transition-colors"
                  >
                    <span>Website Resmi smkmuhiba.sch.id</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Kolom 2: Program & Konsentrasi Keahlian */}
              <div className="space-y-3">
                <p className="text-[11px] font-extrabold text-yellow-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Konsentrasi Keahlian</span>
                </p>
                <div className="space-y-2 text-xs">
                  <button
                    onClick={() => navigateTo('home', 'jurusan-to')}
                    className="w-full text-left p-3 rounded-lg bg-blue-800/40 hover:bg-blue-800/90 border border-blue-700/50 text-white flex flex-col gap-1 transition-all group"
                  >
                    <div className="flex items-center justify-between font-bold text-sm">
                      <span className="group-hover:text-yellow-300 transition-colors">Teknik Otomotif (TO)</span>
                      <span className="text-[10px] bg-blue-600/80 text-white px-2 py-0.5 rounded font-mono">TO</span>
                    </div>
                    <p className="text-[11px] text-blue-200">Teknik Kendaraan Ringan & Sepeda Motor Terakreditasi A</p>
                  </button>

                  <button
                    onClick={() => navigateTo('home', 'jurusan-tjkt')}
                    className="w-full text-left p-3 rounded-lg bg-blue-800/40 hover:bg-blue-800/90 border border-blue-700/50 text-white flex flex-col gap-1 transition-all group"
                  >
                    <div className="flex items-center justify-between font-bold text-sm">
                      <span className="group-hover:text-yellow-300 transition-colors">Teknik Jaringan Komputer (TJKT)</span>
                      <span className="text-[10px] bg-emerald-600/80 text-white px-2 py-0.5 rounded font-mono">TJKT</span>
                    </div>
                    <p className="text-[11px] text-blue-200">Infrastruktur Jaringan, Fiber Optic, & Cloud Computing</p>
                  </button>

                  <button
                    onClick={() => navigateTo('home', 'jurusan-akl')}
                    className="w-full text-left p-3 rounded-lg bg-blue-800/40 hover:bg-blue-800/90 border border-blue-700/50 text-white flex flex-col gap-1 transition-all group"
                  >
                    <div className="flex items-center justify-between font-bold text-sm">
                      <span className="group-hover:text-yellow-300 transition-colors">Akuntansi & Keuangan (AKL)</span>
                      <span className="text-[10px] bg-amber-600/80 text-white px-2 py-0.5 rounded font-mono">AKL</span>
                    </div>
                    <p className="text-[11px] text-blue-200">Komputer Akuntansi, Perbankan Syariah & Keuangan</p>
                  </button>
                </div>
              </div>

              {/* Kolom 3: Layanan Calon Siswa / Akun */}
              <div className="space-y-3">
                <p className="text-[11px] font-extrabold text-yellow-300 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Portal Pendaftaran Siswa</span>
                </p>

                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-800/60 to-blue-950/60 border border-blue-700/60 space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">Penerimaan Siswa Baru TA 2026/2027</p>
                    <p className="text-[11px] text-blue-200">
                      Gelombang 1 Bebas Biaya Formulir Pendaftaran (Gratis Rp 0,-). Kuota 1.500 Siswa.
                    </p>
                  </div>

                  {currentUser ? (
                    <div className="space-y-2 pt-2 border-t border-blue-700/50">
                      {currentUser.role === 'admin' ? (
                        <button
                          onClick={() => navigateTo('admin-dashboard')}
                          className="w-full py-2.5 px-3 text-center text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow transition-colors flex items-center justify-center gap-2"
                        >
                          <Shield className="w-4 h-4 text-yellow-400" />
                          <span>Buka Panel Admin PPDB</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => navigateTo('student-dashboard')}
                          className="w-full py-2.5 px-3 text-center text-xs font-bold text-blue-900 bg-yellow-300 hover:bg-yellow-400 rounded-lg shadow transition-colors flex items-center justify-center gap-2"
                        >
                          <UserCheck className="w-4 h-4 text-blue-950" />
                          <span>Buka Dashboard Siswa</span>
                        </button>
                      )}

                      <button
                        onClick={onLogout}
                        className="w-full py-2 text-center text-xs font-semibold text-rose-300 hover:text-rose-200 transition-colors"
                      >
                        Keluar / Logout Akun
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-2 border-t border-blue-700/50">
                      <button
                        onClick={() => navigateTo('portal')}
                        className="w-full py-2.5 px-3 text-center text-xs font-black text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-lg shadow-md transition-all uppercase tracking-wider"
                      >
                        DAFTAR SEKARANG DISINI
                      </button>

                      <button
                        onClick={() => navigateTo('login')}
                        className="w-full py-2 px-3 text-center text-xs font-bold text-blue-100 hover:text-white bg-blue-700/60 hover:bg-blue-700 rounded-lg border border-blue-400/40 transition-colors"
                      >
                        Masuk / Login Calon Peserta Didik
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </header>
  );
};
