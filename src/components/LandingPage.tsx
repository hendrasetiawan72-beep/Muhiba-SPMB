import React, { useState } from 'react';
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
  Pause, 
  Sparkles,
  ChevronRight,
  BookOpen,
  ArrowRight
} from 'lucide-react';

interface LandingPageProps {
  onRegisterClick: () => void;
  onLoginClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onRegisterClick,
  onLoginClick,
}) => {
  const [activeFacility, setActiveFacility] = useState<number>(0);
  const [showVideoModal, setShowVideoModal] = useState<boolean>(false);
  const [videoPlaying, setVideoPlaying] = useState<boolean>(true);

  const fallbackHeroImage =
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjG8XVKrvlj5jkknTYzKlB2DYIKwYl1h-gKegies3GGfKcyk-1dkSbyfvt4Ghj1yFFkXhzsQ40PCyNUVALlRtkvQmnQtzCJe2vo7XL3Im96N_eQqnsxxRJkirDNC5NorqApzII5S2-bswtbk3wH3eUwOc6JCuHVkpKC3QCxZa2T2JPHtIJ9tvOEaMz45ZRb/s320/44857.png';

  const facilities = [
    {
      title: 'Workshop Teknik Otomotif',
      subtitle: 'Standar Industri & Bengkel Resmi',
      description:
        'Workshop Teknik Otomotif SMK Muhammadiyah dirancang sebagai sarana praktik siswa dalam mempelajari perawatan, perbaikan, dan teknologi kendaraan bermotor. Dilengkapi dengan peralatan standar industri, workshop ini membekali siswa dengan keterampilan teknis, kedisiplinan kerja, serta etos profesional sesuai nilai-nilai SOP Perusahaan.',
      tags: ['TEKNIK OTOMOTIF', 'TBSM', 'UNGGUL'],
      completionRate: '100%',
      image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=900&q=80',
    },
    {
      title: 'Lab Akuntansi',
      subtitle: 'Simulasi Perbankan & Software Akuntansi Digital',
      description:
        'Laboratorium Akuntansi dilengkapi dengan komputer terintegrasi software Accurate, MYOB, perpajakan digital e-Faktur, dan simulasi kasir modern. Mempersiapkan siswa dengan kecakapan analisis keuangan, pencatatan transaksi terstandar, dan etika profesional perbankan syariah serta konvensional.',
      tags: ['AKUNTANSI', 'FINTECH', 'DIGITAL'],
      completionRate: '100%',
      image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=900&q=80',
    },
    {
      title: 'Lab Fiber Optic',
      subtitle: 'Infrastruktur Jaringan Cepat & Mikrotik Academy',
      description:
        'Fasilitas mutakhir untuk program keahlian TJKT dengan perangkat Splicer Fiber Optic, OTDR, Routerboard Mikrotik, Cisco, Server Virtualisasi, dan laboratorium komputasi berkecepatan tinggi untuk riset jaringan dan keamanan siber.',
      tags: ['FIBER OPTIC', 'MIKROTIK', 'CYBER SECURITY'],
      completionRate: '100%',
      image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=900&q=80',
    },
    {
      title: 'Kewirausahaan',
      subtitle: 'Business Center & Teaching Factory Muhiba',
      description:
        'Pusat inkubasi bisnis siswa yang mewadahi unit produksi, minimarket sekolah, jasa servis motor berkala, perakitan PC, dan penjualan produk kreatif karya siswa untuk memupuk jiwa mandiri dan wirausaha tangguh sejak dini.',
      tags: ['BUSINESS CENTER', 'TEFA', 'WIRAUSAHA'],
      completionRate: '100%',
      image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
    },
  ];

  const testimonials = [
    {
      quote:
        'Di jurusan TJKT SMK Muhammadiyah Bawang, saya belajar jaringan komputer dan program secara langsung. Praktiknya seru dan sesuai kebutuhan industri. Sekarang saya sudah punya bekal untuk bekerja di bidang IT dan jaringan.',
      name: 'BENY-ARFAN - TKJ#1',
      role: 'CEO and Co-Founder EGG-DEV',
      color: 'bg-rose-100 text-rose-600',
    },
    {
      quote:
        'Belajar di jurusan Teknik Otomotif SMK Muhammadiyah Bawang sangat menyenangkan karena langsung praktik di bengkel sekolah. Guru-gurunya berpengalaman dan fasilitasnya lengkap. Saya jadi percaya diri dan siap bekerja di dunia otomotif setelah lulus.',
      name: 'KHUSNUL ASAQOFI',
      role: 'ALUMNI TBSM & OMPONK',
      color: 'bg-amber-100 text-amber-600',
    },
    {
      quote:
        'Jurusan Akuntansi di SMK Muhammadiyah Bawang mengajarkan kami pembukuan dan akuntansi berbasis komputer. Selain ilmu, kami juga dibina untuk jujur dan teliti. Ilmu yang saya dapatkan sangat berguna untuk dunia kerja maupun usaha.',
      name: 'EKA MAULIDIN',
      role: 'ALUMNI AKUNTANSI - CEO KOPERASI',
      color: 'bg-indigo-100 text-indigo-600',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden selection:bg-blue-600 selection:text-white">
      
      {/* ========================================================================= */}
      {/* 1. HERO SECTION WITH VIDEO BACKGROUND & OVERLAY */}
      {/* ========================================================================= */}
      <section className="relative min-h-[640px] lg:min-h-[720px] flex items-center bg-slate-950 overflow-hidden">
        {/* Background Layer: TikTok Video & Fallback Image */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          {/* Fallback image */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
            style={{
              backgroundImage: `url(${fallbackHeroImage})`,
            }}
          />

          {/* TikTok Dynamic Video Overlay Embed (or iframe with clean scrim) */}
          <div className="absolute inset-0 w-full h-full opacity-60 mix-blend-luminosity scale-110 pointer-events-none overflow-hidden">
            <iframe
              src="https://www.tiktok.com/player/v1/7462604408816225541?autoplay=1&muted=1&controls=0&loop=1"
              title="TikTok Video Background SMK Muhiba"
              className="w-[120%] h-[120%] -ml-[10%] -mt-[10%] object-cover pointer-events-none border-0"
              allow="autoplay; encrypted-media"
            />
          </div>

          {/* Measured Scrim & Subtle Halftone Circles Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-900/85 to-blue-950/75 z-10" />
          
          {/* Halftone patterned decorative rings as seen in screenshot */}
          <div className="absolute right-0 bottom-0 w-[500px] h-[500px] pointer-events-none opacity-20 z-10">
            <svg viewBox="0 0 400 400" className="w-full h-full text-blue-400 fill-current">
              <circle cx="200" cy="200" r="180" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 8" />
              <circle cx="200" cy="200" r="140" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 7" />
              <circle cx="200" cy="200" r="100" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 6" />
              <circle cx="200" cy="200" r="60" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 5" />
            </svg>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Heading & Primary Action */}
            <div className="lg:col-span-7 space-y-6 text-white">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold tracking-wider uppercase">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                <span>Penerimaan Peserta Didik Baru (PPDB) 2026/2027</span>
              </div>

              <div className="space-y-2">
                <p className="text-lg sm:text-xl text-blue-200 font-medium tracking-wide">
                  Welcome To Our School
                </p>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                  SMK MUHAMMADIYAH <br />
                  <span className="text-[#3b82f6] drop-shadow-sm">Bawang!</span>
                </h1>
              </div>

              <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
                Sekolah Pusat Keunggulan dengan kurikulum link and match industri. Mencetak generasi tangguh, terampil, berakhlak mulia, dan siap bersaing di dunia kerja nasional maupun internasional.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  onClick={onRegisterClick}
                  className="px-7 py-3.5 text-sm sm:text-base font-extrabold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg shadow-lg hover:shadow-blue-500/30 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  DAFTAR SEKARANG !!!
                </button>

                <button
                  onClick={onLoginClick}
                  className="px-6 py-3.5 text-sm sm:text-base font-bold text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600 rounded-lg transition-all"
                >
                  Cek Status / Login Siswa
                </button>
              </div>

              {/* Verified school info banner */}
              <div className="pt-4 flex items-center gap-6 text-xs text-slate-300 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Akreditasi A Unggul</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-yellow-400" />
                  <span>Sekolah Pusat Keunggulan</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  <span>3 Jurusan Pilihan</span>
                </div>
              </div>
            </div>

            {/* Right Column: Building Visual Card with School Photo */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-slate-900/60 backdrop-blur-sm group">
                <img
                  src={fallbackHeroImage}
                  alt="Gedung SMK Muhammadiyah Bawang"
                  className="w-full h-72 object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="p-5 text-white">
                  <div className="flex items-center justify-between text-xs text-blue-300 font-semibold mb-1">
                    <span>KAMPUS TERPADU</span>
                    <span>BAWANG, BATANG</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">SMK Muhammadiyah Bawang</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Jl. Raya Bawang - Subah, Jlamprang, Bawang, Kabupaten Batang, Jawa Tengah 51274
                  </p>
                  
                  <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
                    <a
                      href="https://www.tiktok.com/@smartschool17/video/7462604408816225541"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-300 hover:text-yellow-200 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Tonton Video Profil Sekolah (TikTok)</span>
                    </a>
                    <span className="text-[11px] text-slate-400">@smartschool17</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. STATS QUICK STRIP */}
      {/* ========================================================================= */}
      <section className="bg-white border-y border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="p-3">
              <p className="text-3xl font-extrabold text-blue-700 tabular-nums">59</p>
              <p className="text-xs font-semibold text-slate-600 mt-1">Sekolah Asal SMP/MTs</p>
            </div>
            <div className="p-3 border-l border-slate-100">
              <p className="text-3xl font-extrabold text-amber-600 tabular-nums">3</p>
              <p className="text-xs font-semibold text-slate-600 mt-1">Konsentrasi Keahlian</p>
            </div>
            <div className="p-3 border-l border-slate-100">
              <p className="text-3xl font-extrabold text-emerald-600 tabular-nums">1.500</p>
              <p className="text-xs font-semibold text-slate-600 mt-1">Total Kuota Pendaftar</p>
            </div>
            <div className="p-3 border-l border-slate-100">
              <p className="text-3xl font-extrabold text-indigo-600 tabular-nums">100%</p>
              <p className="text-xs font-semibold text-slate-600 mt-1">Terserap Kerja & Kuliah</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. KONSENTRASI KEAHLIAN (JURUSAN) */}
      {/* ========================================================================= */}
      <section id="jurusan-section" className="py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-700 tracking-wider uppercase">JURUSAN</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-1">
              Konsentrasi <span className="text-blue-600">Keahlian</span>
            </h2>
            <div className="w-16 h-1 bg-blue-600 mx-auto mt-3 rounded-full" />
            <p className="text-sm text-slate-600 mt-4">
              Pilihan program keahlian unggulan berbasis kebutuhan revolusi industri modern dan digitalisasi global.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* 1. TEKNIK OTOMOTIF (TO) */}
            <div id="jurusan-to" className="bg-slate-50 border border-slate-200/80 rounded-2xl p-8 hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col group">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 mb-6 group-hover:scale-110 transition-transform">
                <Wrench className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">
                Teknik Otomotif (TO)
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed flex-grow">
                Pusat inovasi mesin dan otomotif! Jurusan TO membekali siswa dengan keahlian membongkar, merakit, dan menganalisis teknologi kendaraan bermotor terkini. Jadilah teknisi handal yang siap menguasai industri otomotif masa depan.
              </p>

              <div className="mt-6 pt-5 border-t border-slate-200/80 flex items-center justify-between text-xs font-semibold">
                <span className="text-amber-700 bg-amber-100/70 px-2.5 py-1 rounded">Teknologi Mesin & TBSM</span>
                <button
                  onClick={onRegisterClick}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>Daftar Jurusan</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 2. TEKNIK JARINGAN KOMPUTER & TELEKOMUNIKASI (TJKT) */}
            <div id="jurusan-tjkt" className="bg-slate-50 border border-slate-200/80 rounded-2xl p-8 hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col group">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform">
                <Cpu className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">
                Teknik Jaringan Komputer & Telekomunikasi (TJKT)
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed flex-grow">
                Gerbang menuju dunia digital tanpa batas. Di TJKT, kamu akan menguasai infrastruktur jaringan, keamanan siber, dan teknologi fiber optik. Persiapkan dirimu menjadi arsitek jaringan yang menghubungkan dunia.
              </p>

              <div className="mt-6 pt-5 border-t border-slate-200/80 flex items-center justify-between text-xs font-semibold">
                <span className="text-blue-700 bg-blue-100/70 px-2.5 py-1 rounded">Mikrotik & Fiber Optic</span>
                <button
                  onClick={onRegisterClick}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>Daftar Jurusan</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 3. AKUNTANSI DAN KEUANGAN LEMBAGA (AKL) */}
            <div id="jurusan-akl" className="bg-slate-50 border border-slate-200/80 rounded-2xl p-8 hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col group">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                <Calculator className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">
                Akuntansi dan Keuangan Lembaga (AKL)
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed flex-grow">
                Mencetak pahlawan finansial masa depan. Jurusan AKL melatih ketelitian dan keahlianmu dalam mengelola keuangan, perpajakan, dan akuntansi digital. Raih karir cemerlang di sektor perbankan maupun startup bisnis.
              </p>

              <div className="mt-6 pt-5 border-t border-slate-200/80 flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded">Fintech & Perbankan</span>
                <button
                  onClick={onRegisterClick}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>Daftar Jurusan</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. FASILITAS & WORKSHOP (WHAT YOU CAN LEARN) */}
      {/* ========================================================================= */}
      <section id="fasilitas-section" className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-700 tracking-wider uppercase">OUR COURSES & FACILITIES</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-1">
              What You Can <span className="text-blue-600">Learn</span>
            </h2>
            <div className="w-16 h-1 bg-blue-600 mx-auto mt-3 rounded-full" />
            <p className="text-sm text-slate-600 mt-4 leading-relaxed">
              SMK Muhammadiyah Bawang adalah salah satu lembaga pendidikan menengah yang terletak di Kecamatan Bawang, Kabupaten Batang, Jawa Tengah. Sekolah ini didirikan dengan tujuan untuk mencetak generasi muda yang terampil dan berakhlak mulia melalui pendidikan vokasi yang berkualitas.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left facility selector list */}
            <div className="lg:col-span-4 space-y-3">
              {facilities.map((fac, idx) => {
                const isSelected = activeFacility === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveFacility(idx)}
                    className={`w-full text-left p-4 rounded-xl font-bold text-sm transition-all duration-200 border flex items-center justify-between ${
                      isSelected
                        ? 'bg-white text-purple-700 border-purple-400 shadow-md ring-2 ring-purple-100'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>{fac.title}</span>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isSelected ? 'text-purple-600 translate-x-1' : 'text-slate-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Right facility card preview */}
            <div className="lg:col-span-8">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden grid grid-cols-1 md:grid-cols-12">
                
                {/* Image side */}
                <div className="md:col-span-5 relative min-h-[260px] md:min-h-[340px] bg-slate-900">
                  <img
                    src={facilities[activeFacility].image}
                    alt={facilities[activeFacility].title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4 bg-purple-600 text-white text-xs font-extrabold px-3 py-1 rounded shadow">
                    {facilities[activeFacility].completionRate} SIAP
                  </div>
                </div>

                {/* Content side */}
                <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {facilities[activeFacility].title}
                    </h3>
                    <p className="text-xs text-blue-600 font-semibold mt-1">
                      {facilities[activeFacility].subtitle}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-600 mt-4 leading-relaxed">
                      {facilities[activeFacility].description}
                    </p>
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {facilities[activeFacility].tags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={onRegisterClick}
                      className="text-xs font-bold text-purple-700 hover:text-purple-900 underline flex items-center gap-1"
                    >
                      <span>Daftar Sekarang</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. TESTIMONIALS (WHAT THEY THINK) */}
      {/* ========================================================================= */}
      <section id="profil-section" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-700 tracking-wider uppercase">TESTIMONIALS</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-1">
              What They <span className="text-blue-600">Think</span>
            </h2>
            <div className="w-16 h-1 bg-blue-600 mx-auto mt-3 rounded-full" />
            <p className="text-sm text-slate-600 mt-4">
              Kisah sukses alumni SMK Muhammadiyah Bawang yang telah berkiprah di dunia usaha, industri, dan startup digital.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testi, idx) => (
              <div
                key={idx}
                className="bg-slate-50 border border-slate-200/80 rounded-2xl p-7 flex flex-col justify-between hover:shadow-lg transition-all"
              >
                <div>
                  <p className="text-sm text-slate-700 italic leading-relaxed">
                    "{testi.quote}"
                  </p>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-200/80 flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">{testi.name}</h4>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase mt-0.5">{testi.role}</p>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-serif text-lg font-bold ${testi.color}`}>
                    ”
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. HUBUNGI KAMI & GOOGLE MAPS EMBED */}
      {/* ========================================================================= */}
      <section id="kontak-section" className="py-20 bg-slate-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Contact description */}
            <div className="lg:col-span-5 space-y-6">
              <span className="text-xs font-bold text-blue-400 tracking-wider uppercase">HUBUNGI KAMI</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
                Ayo Bergabung Bersama SMK Muhammadiyah Bawang
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Jika Anda membutuhkan informasi pendaftaran peserta didik baru (PPDB), jurusan, biaya pendidikan, atau fasilitas sekolah, silakan hubungi kami. Tim PPDB SMK Muhammadiyah Bawang siap melayani dan membantu Anda dengan ramah.
              </p>

              {/* Contact direct boxes */}
              <div className="space-y-3 pt-2">
                <a
                  href="https://wa.me/628561333392?text=Halo%20Panitia%20PPDB%20SMK%20Muhammadiyah%20Bawang,%20saya%20ingin%20bertanya%20informasi%20pendaftaran"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl bg-slate-800/90 border border-slate-700 hover:border-emerald-500 transition-all flex items-center gap-4 group"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-medium block">WHATSAPP PPDB</span>
                    <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                      0856-1333-392
                    </span>
                  </div>
                </a>

                <a
                  href="tel:085741977501"
                  className="p-4 rounded-xl bg-slate-800/90 border border-slate-700 hover:border-blue-500 transition-all flex items-center gap-4 group"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-medium block">MOBILE / TELEPON</span>
                    <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                      0857-4197-7501
                    </span>
                  </div>
                </a>
              </div>

              <div className="pt-2">
                <button
                  onClick={onRegisterClick}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 font-extrabold text-sm rounded-lg shadow-lg transition-all"
                >
                  Daftar Sekarang Online
                </button>
              </div>
            </div>

            {/* Right Google Maps Embed */}
            <div className="lg:col-span-7">
              <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
                <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-200 font-semibold">
                    <MapPin className="w-4 h-4 text-rose-400" />
                    <span>SMKS MUHAMMADIYAH BAWANG - Jlamprang, Bawang, Batang</span>
                  </div>
                  <a
                    href="https://maps.google.com/?q=SMK+Muhammadiyah+Bawang+Batang"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                  >
                    <span>Buka Peta</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="relative w-full h-[360px]">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15837.288219468936!2d109.91494559999999!3d-7.0886111!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e7073289069d519%3A0xe54efda6cb94ea9c!2sSMK%20Muhammadiyah%20Bawang!5e0!3m2!1sid!2sid!4v1700000000000!5m2!1sid!2sid"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen={false}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Google Maps Lokasi SMK Muhammadiyah Bawang"
                  />
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* FLOATING WHATSAPP BUTTON (BOTTOM-LEFT AS IN SCREENSHOTS) */}
      {/* ========================================================================= */}
      <div className="fixed bottom-6 left-6 z-40">
        <a
          href="https://wa.me/628561333392?text=Halo%20Panitia%20PPDB%20SMK%20Muhammadiyah%20Bawang,%20saya%20ingin%20bertanya%20seputar%20pendaftaran"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white px-4 py-2.5 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 group"
        >
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 fill-current" />
          </div>
          <div className="text-left pr-1">
            <p className="text-[10px] uppercase font-bold leading-tight tracking-tight">Hubungi Kami Disini</p>
            <p className="text-xs font-semibold leading-none">WhatsApp PPDB</p>
          </div>
        </a>
      </div>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-400 py-8 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 SPMB SMK MUHIBA | SMK Muhammadiyah Bawang. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="http://www.smkmuhiba.sch.id" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              www.smkmuhiba.sch.id
            </a>
            <button onClick={onLoginClick} className="hover:text-white transition-colors">
              Login Petugas & Siswa
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
};
