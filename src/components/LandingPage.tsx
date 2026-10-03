import React, { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
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
  ChevronRight,
  ChevronDown,
  BookOpen,
  ArrowRight,
  ArrowUp,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  X
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
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);

  // States & refs for clean looping video in workshop otomotif
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const modalVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(true);
  const [isFullscreenModalOpen, setIsFullscreenModalOpen] = useState<boolean>(false);

  // States & refs for Profile Video (YouTube)
  const [isYtMuted, setIsYtMuted] = useState<boolean>(true);
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Parallax scroll hooks
  const { scrollY, scrollYProgress } = useScroll();
  const heroBgY = useTransform(scrollY, [0, 800], [0, 160]);
  const heroRingsY = useTransform(scrollY, [0, 800], [0, -80]);
  const heroRingsRotate = useTransform(scrollY, [0, 800], [0, 40]);
  const heroTextY = useTransform(scrollY, [0, 800], [0, 40]);
  const heroCardY = useTransform(scrollY, [0, 800], [0, 65]);
  const profilGlowY = useTransform(scrollY, [200, 1400], [-50, 60]);
  const videoCardY = useTransform(scrollY, [300, 1200], [30, -20]);
  const statsY = useTransform(scrollY, [500, 1200], [20, -10]);
  const jurusanGlowY = useTransform(scrollY, [800, 2200], [-40, 50]);

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Smooth scroll listener for back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Efek gulir cepat ke profil sekolah saat pengguna scroll dari bagian paling atas laman
  const hasTriggeredQuickScroll = useRef(false);
  const isAutoScrolling = useRef(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScrollSnap = () => {
      const currentScrollY = window.scrollY;

      // Reset kemampuan trigger jika pengguna kembali ke paling atas halaman (< 20px)
      if (currentScrollY <= 20) {
        hasTriggeredQuickScroll.current = false;
        isAutoScrolling.current = false;
      }

      // Deteksi gerakan scroll ke bawah dari puncak laman (20px - 320px)
      if (
        !hasTriggeredQuickScroll.current &&
        !isAutoScrolling.current &&
        lastScrollY <= 30 &&
        currentScrollY > 30 &&
        currentScrollY < 320
      ) {
        hasTriggeredQuickScroll.current = true;
        isAutoScrolling.current = true;

        const target = document.getElementById('profil-sekolah');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(() => {
            isAutoScrolling.current = false;
          }, 900);
        }
      }

      lastScrollY = currentScrollY;
    };

    const handleWheel = (e: WheelEvent) => {
      if (
        window.scrollY <= 25 &&
        e.deltaY > 15 &&
        !hasTriggeredQuickScroll.current &&
        !isAutoScrolling.current
      ) {
        hasTriggeredQuickScroll.current = true;
        isAutoScrolling.current = true;

        const target = document.getElementById('profil-sekolah');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(() => {
            isAutoScrolling.current = false;
          }, 900);
        }
      }
    };

    window.addEventListener('scroll', handleScrollSnap, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollSnap);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const toggleYtAudio = () => {
    if (ytIframeRef.current && ytIframeRef.current.contentWindow) {
      const command = isYtMuted ? 'unMute' : 'mute';
      ytIframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: command, args: [] }),
        '*'
      );
      setIsYtMuted(!isYtMuted);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreenModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleVideoPlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsVideoPlaying(true);
      } else {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      }
    }
  };

  const toggleVideoMute = () => {
    const nextMuted = !isVideoMuted;
    setIsVideoMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
    if (modalVideoRef.current) {
      modalVideoRef.current.muted = nextMuted;
    }
  };

  const handleOpenFullscreen = () => {
    setIsFullscreenModalOpen(true);
  };

  const fallbackHeroImage =
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjG8XVKrvlj5jkknTYzKlB2DYIKwYl1h-gKegies3GGfKcyk-1dkSbyfvt4Ghj1yFFkXhzsQ40PCyNUVALlRtkvQmnQtzCJe2vo7XL3Im96N_eQqnsxxRJkirDNC5NorqApzII5S2-bswtbk3wH3eUwOc6JCuHVkpKC3QCxZa2T2JPHtIJ9tvOEaMz45ZRb/s320/44857.png';

  const facilities = [
    {
      title: 'Workshop Teknik Otomotif',
      subtitle: 'Standar Industri & Bengkel Resmi (TSM & TKR)',
      description:
        'Workshop Teknik Otomotif SMK Muhammadiyah dirancang sebagai sarana praktik siswa dalam mempelajari perawatan, perbaikan, dan teknologi kendaraan bermotor. Dilengkapi dengan peralatan standar industri, workshop ini membekali siswa dengan keterampilan teknis, kedisiplinan kerja, serta etos profesional sesuai nilai-nilai SOP Perusahaan.',
      tags: ['TEKNIK OTOMOTIF', 'TSM & TKR', 'UNGGUL'],
      completionRate: '100%',
      image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=900&q=80',
      isVideo: true,
      videoId: '7681168904672136468',
      videoUrl: 'https://vt.tiktok.com/ZSbLkvPQh/',
    },
    {
      title: 'Lab Akuntansi',
      subtitle: 'Simulasi Perbankan & Software Akuntansi Digital',
      description:
        'Laboratorium Akuntansi dilengkapi dengan komputer terintegrasi software Accurate, MYOB, perpajakan digital e-Faktur, dan simulasi kasir modern. Mempersiapkan siswa dengan kecakapan analisis keuangan, pencatatan transaksi terstandar, dan etika profesional perbankan syariah serta konvensional.',
      tags: ['AKUNTANSI', 'FINTECH', 'DIGITAL'],
      completionRate: '100%',
      image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=900&q=80',
      isVideo: false,
    },
    {
      title: 'Lab Fiber Optic',
      subtitle: 'Infrastruktur Jaringan Cepat & Mikrotik Academy',
      description:
        'Fasilitas mutakhir untuk program keahlian TJKT dengan perangkat Splicer Fiber Optic, OTDR, Routerboard Mikrotik, Cisco, Server Virtualisasi, dan laboratorium komputasi berkecepatan tinggi untuk riset jaringan dan keamanan siber.',
      tags: ['FIBER OPTIC', 'MIKROTIK', 'CYBER SECURITY'],
      completionRate: '100%',
      image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=900&q=80',
      isVideo: false,
    },
    {
      title: 'Kewirausahaan',
      subtitle: 'Business Center & Teaching Factory Muhiba',
      description:
        'Pusat inkubasi bisnis siswa yang mewadahi unit produksi, minimarket sekolah, jasa servis motor berkala, perakitan PC, dan penjualan produk kreatif karya siswa untuk memupuk jiwa mandiri dan wirausaha tangguh sejak dini.',
      tags: ['BUSINESS CENTER', 'TEFA', 'WIRAUSAHA'],
      completionRate: '100%',
      image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
      isVideo: false,
    },
  ];

  // Carousel Auto-Play and Touch/Swipe States
  const [isAutoPlayActive, setIsAutoPlayActive] = useState<boolean>(true);
  const [isCarouselHovered, setIsCarouselHovered] = useState<boolean>(false);
  const [autoPlayProgress, setAutoPlayProgress] = useState<number>(0);
  const [swipeDirection, setSwipeDirection] = useState<number>(1);

  // Auto-play timer for Carousel (5000ms duration, pauses on hover / touch)
  useEffect(() => {
    if (!isAutoPlayActive || isCarouselHovered || isFullscreenModalOpen) return;

    const intervalDuration = 5000;
    const stepDuration = 50;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += stepDuration;
      setAutoPlayProgress(Math.min((elapsed / intervalDuration) * 100, 100));

      if (elapsed >= intervalDuration) {
        elapsed = 0;
        setAutoPlayProgress(0);
        setSwipeDirection(1);
        setActiveFacility((prev) => (prev + 1) % facilities.length);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [isAutoPlayActive, isCarouselHovered, isFullscreenModalOpen, activeFacility, facilities.length]);

  const nextFacility = () => {
    setSwipeDirection(1);
    setAutoPlayProgress(0);
    setActiveFacility((prev) => (prev + 1) % facilities.length);
  };

  const prevFacility = () => {
    setSwipeDirection(-1);
    setAutoPlayProgress(0);
    setActiveFacility((prev) => (prev - 1 + facilities.length) % facilities.length);
  };

  const goToFacility = (idx: number) => {
    setSwipeDirection(idx > activeFacility ? 1 : -1);
    setAutoPlayProgress(0);
    setActiveFacility(idx);
  };

  // Touch Swipe Gesture Fallback
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsCarouselHovered(true);
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    setIsCarouselHovered(false);
    if (touchStartX.current === null || touchEndX.current === null) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 40) {
      nextFacility();
    } else if (distance < -40) {
      prevFacility();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

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

  // Stagger animation variants
  const smoothEase = [0.16, 1, 0.3, 1] as const;

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.08,
      },
    },
  };

  const fadeInUpItem = {
    hidden: { opacity: 0, y: 22 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.55,
        ease: smoothEase,
      },
    },
  };

  const cardStaggerVariants = {
    hidden: { opacity: 0, y: 28, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.55,
        ease: smoothEase,
      },
    },
  };

  const carouselSlideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: 'spring' as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.3 },
      },
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -100 : 100,
      opacity: 0,
      scale: 0.98,
      transition: {
        x: { type: 'spring' as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.25 },
      },
    }),
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden selection:bg-blue-600 selection:text-white relative">
      
      {/* ========================================================================= */}
      {/* SMOOTH SCROLL TOP PROGRESS BAR */}
      {/* ========================================================================= */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-blue-500 to-indigo-500 z-50 origin-left pointer-events-none shadow-sm"
        style={{ scaleX: scrollYProgress }}
      />


      {/* ========================================================================= */}
      {/* 1. HERO SECTION WITH VIDEO BACKGROUND & PARALLAX OVERLAY */}
      {/* ========================================================================= */}
      <section id="hero-section" className="relative min-h-[640px] lg:min-h-[740px] flex items-center bg-slate-950 overflow-hidden section-snap scroll-mt-20">
        
        {/* Parallax Background Layer: TikTok Video & Fallback Image */}
        <motion.div 
          style={{ y: heroBgY }} 
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none will-change-transform"
        >
          {/* Fallback image */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 scale-105"
            style={{
              backgroundImage: `url(${fallbackHeroImage})`,
            }}
          />

          {/* TikTok Dynamic Video Overlay Embed */}
          <div className="absolute inset-0 w-full h-full opacity-90 scale-110 pointer-events-none overflow-hidden">
            <iframe
              src="https://www.tiktok.com/player/v1/7462604408816225541?autoplay=1&muted=1&controls=0&loop=1"
              title="TikTok Video Background SMK Muhiba"
              className="w-[120%] h-[120%] -ml-[10%] -mt-[10%] object-cover pointer-events-none border-0"
              allow="autoplay; encrypted-media"
            />
          </div>

          {/* Scrim Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/65 via-slate-950/35 to-blue-950/20 z-10" />
        </motion.div>

        {/* Parallax Decorative Rings */}
        <motion.div 
          style={{ y: heroRingsY, rotate: heroRingsRotate }}
          className="absolute right-0 bottom-0 w-[500px] h-[500px] pointer-events-none opacity-20 z-10 will-change-transform"
        >
          <svg viewBox="0 0 400 400" className="w-full h-full text-blue-400 fill-current">
            <circle cx="200" cy="200" r="180" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 8" />
            <circle cx="200" cy="200" r="140" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 7" />
            <circle cx="200" cy="200" r="100" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 6" />
            <circle cx="200" cy="200" r="60" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 5" />
          </svg>
        </motion.div>

        {/* Hero Content with Staggered Elements & Parallax Floating Card */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Staggered Heading & Action Content */}
            <motion.div 
              style={{ y: heroTextY }}
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="lg:col-span-7 space-y-6 text-white drop-shadow-md will-change-transform"
            >
              <motion.div variants={fadeInUpItem} className="space-y-2">
                <p className="text-lg sm:text-xl text-blue-200 font-medium tracking-wide">
                  Welcome To Our School
                </p>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                  SMK MUHAMMADIYAH <br />
                  <span className="text-[#3b82f6] drop-shadow-sm">Bawang!</span>
                </h1>
              </motion.div>

              <motion.p variants={fadeInUpItem} className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
                Sekolah Pusat Keunggulan dengan kurikulum link and match industri. Mencetak generasi tangguh, terampil, berakhlak mulia, dan siap bersaing di dunia kerja nasional maupun internasional.
              </motion.p>

              <motion.div variants={fadeInUpItem} className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  onClick={onRegisterClick}
                  className="px-7 py-3.5 text-sm sm:text-base font-extrabold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg shadow-lg hover:shadow-blue-500/30 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  DAFTAR SEKARANG !!!
                </button>

                <button
                  onClick={onLoginClick}
                  className="px-6 py-3.5 text-sm sm:text-base font-bold text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600 rounded-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  Cek Status / Login Siswa
                </button>
              </motion.div>

              {/* Verified school trust markers */}
              <motion.div variants={fadeInUpItem} className="pt-4 flex items-center gap-6 text-xs text-slate-300 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5 hover:text-white transition-colors">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Akreditasi A Unggul</span>
                </div>
                <div className="flex items-center gap-1.5 hover:text-white transition-colors">
                  <Award className="w-4 h-4 text-yellow-400" />
                  <span>Sekolah Pusat Keunggulan</span>
                </div>
                <div className="flex items-center gap-1.5 hover:text-white transition-colors">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  <span>3 Jurusan Pilihan</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Right Column: Building Visual Card with Parallax Float */}
            <motion.div 
              style={{ y: heroCardY }}
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25, ease: smoothEase }}
              className="lg:col-span-5 relative will-change-transform"
            >
              <div className="relative mx-auto max-w-md rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-slate-900/60 backdrop-blur-sm group hover:border-blue-400/40 transition-all duration-300">
                <img
                  src={fallbackHeroImage}
                  alt="Gedung SMK Muhammadiyah Bawang"
                  className="w-full h-72 object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                  referrerPolicy="no-referrer"
                />
                <div className="p-5 text-white">
                  <div className="flex items-center justify-between text-xs text-blue-300 font-semibold mb-1">
                    <span>KAMPUS TERPADU</span>
                    <span>BAWANG, BATANG</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">SMK Muhammadiyah Bawang</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Jl. Raya Bawang - Sukorejo KM 01, Jlamprang, Bawang, Kabupaten Batang, Jawa Tengah 51274
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
            </motion.div>

          </div>
        </div>

        {/* Quick Scroll Indicator Button to Profil Sekolah */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => scrollToSection('profil-sekolah')}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 hover:bg-slate-900 text-blue-200 hover:text-white border border-blue-400/30 backdrop-blur-md text-xs font-semibold shadow-xl transition-all transform hover:scale-105 active:scale-95 group cursor-pointer"
            title="Gulir Cepat ke Profil Sekolah"
          >
            <span>Profil Sekolah</span>
            <ChevronDown className="w-4 h-4 text-blue-400 group-hover:translate-y-0.5 transition-transform animate-bounce" />
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. PROFIL SEKOLAH & VIDEO PROFIL RESMI (AUTOPLAY LOOP YOUTUBE) */}
      {/* Background gradasi memudar: Warna Atas #FFFFFF ke Warna Bawah #D3E3FD */}
      {/* ========================================================================= */}
      <section 
        id="profil-sekolah" 
        className="py-16 sm:py-24 bg-gradient-to-b from-[#FFFFFF] via-[#E8F1FD] to-[#D3E3FD] text-slate-900 relative overflow-hidden border-b border-blue-200/60 scroll-mt-24 section-snap"
      >
        {/* Parallax decorative background glow */}
        <motion.div 
          style={{ y: profilGlowY }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-blue-300/35 rounded-full blur-3xl pointer-events-none will-change-transform" 
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <motion.div 
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: smoothEase }}
            className="text-center max-w-3xl mx-auto mb-12"
          >
            <span className="inline-flex items-center px-3.5 py-1 bg-blue-100 text-blue-800 border border-blue-200/80 rounded-full text-xs font-bold uppercase tracking-wider mb-3 shadow-2xs">
              <span>Profil Sekolah Pusat Keunggulan</span>
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
              Mengenal Lebih Dekat <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-700">SMK MUHIBA</span>
            </h2>
            <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mt-4 rounded-full" />
            <p className="text-sm sm:text-base text-slate-700 mt-6 leading-relaxed font-medium">
              “SMK Muhammadiyah Bawang (MUHIBA) adalah Sekolah Pusat Keunggulan yang mencetak generasi tangguh, terampil, dan berakhlak mulia. Dengan kurikulum link and match industri, kami mempersiapkan siswa siap kerja dan siap kuliah melalui program unggulan Teknik Otomotif, Teknik Jaringan Komputer & Telekomunikasi, serta Akuntansi dan Keuangan Lembaga.”
            </p>
          </motion.div>

          {/* YouTube Video Player with Parallax Shift */}
          <motion.div 
            style={{ y: videoCardY }}
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.65, ease: smoothEase }}
            className="max-w-4xl mx-auto will-change-transform"
          >
            <div className="p-2 sm:p-3 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 shadow-2xl ring-1 ring-blue-900/10">
              <div className="relative rounded-xl sm:rounded-2xl overflow-hidden bg-black shadow-inner aspect-video">
                
                {/* Embedded YouTube Video */}
                <iframe
                  ref={ytIframeRef}
                  src="https://www.youtube-nocookie.com/embed/MjqT0ORLm1w?autoplay=1&mute=1&loop=1&playlist=MjqT0ORLm1w&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&enablejsapi=1"
                  title="Profil SMK Muhammadiyah Bawang"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  className="w-full h-full object-cover scale-[1.03] pointer-events-none select-none"
                />

                {/* Minimalist Top Badge */}
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 pointer-events-none flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-white text-[11px] font-bold shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span>OFFICIAL VIDEO PROFIL MUHIBA</span>
                </div>

                {/* Custom Minimalist Sound Toggle Button */}
                <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20">
                  <button
                    type="button"
                    onClick={toggleYtAudio}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-white rounded-full backdrop-blur-md border border-white/20 text-xs font-semibold shadow-xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
                    title={isYtMuted ? 'Nyalakan Audio Video' : 'Bisukan Audio Video'}
                  >
                    {isYtMuted ? (
                      <>
                        <VolumeX className="w-4 h-4 text-rose-400" />
                        <span>Nyalakan Suara</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                        <span>Suara Aktif</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 px-2">
              <span className="font-bold flex items-center gap-1.5 text-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Sekolah Pusat Keunggulan (SMK PK) Kemendikbudristek</span>
              </span>
              <a
                href="https://youtu.be/MjqT0ORLm1w?si=LMWN7mZdpKYSBu6R"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 hover:text-blue-900 transition-colors flex items-center gap-1 font-bold underline"
              >
                <span>Buka di YouTube</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>

          {/* Quick scroll to next section (Jurusan) */}
          <div className="mt-8 text-center">
            <button
              onClick={() => scrollToSection('jurusan-section')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/90 hover:bg-white text-blue-900 border border-blue-200/90 text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer group"
              title="Lanjut ke Bagian Konsentrasi Keahlian"
            >
              <span>Lanjut ke Konsentrasi Keahlian (Jurusan)</span>
              <ChevronDown className="w-3.5 h-3.5 text-blue-600 group-hover:translate-y-0.5 transition-transform animate-bounce" />
            </button>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. STATS QUICK STRIP WITH STAGGERED REVEAL */}
      {/* ========================================================================= */}
      <section id="stats-section" className="bg-white border-y border-slate-200 py-8 relative z-20 section-snap scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            style={{ y: statsY }}
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center will-change-transform"
          >
            <motion.div variants={fadeInUpItem} className="p-3 hover:-translate-y-1 transition-transform">
              <p className="text-3xl sm:text-4xl font-extrabold text-blue-700 tabular-nums">59</p>
              <p className="text-xs font-semibold text-slate-600 mt-1">Sekolah Asal SMP/MTs</p>
            </motion.div>
            <motion.div variants={fadeInUpItem} className="p-3 border-l border-slate-100 hover:-translate-y-1 transition-transform">
              <p className="text-3xl sm:text-4xl font-extrabold text-amber-600 tabular-nums">3</p>
              <p className="text-xs font-semibold text-slate-600 mt-1">Konsentrasi Keahlian</p>
            </motion.div>
            <motion.div variants={fadeInUpItem} className="p-3 border-l border-slate-100 hover:-translate-y-1 transition-transform">
              <p className="text-3xl sm:text-4xl font-extrabold text-emerald-600 tabular-nums">1.500</p>
              <p className="text-xs font-semibold text-slate-600 mt-1">Total Kuota Pendaftar</p>
            </motion.div>
            <motion.div variants={fadeInUpItem} className="p-3 border-l border-slate-100 hover:-translate-y-1 transition-transform">
              <p className="text-3xl sm:text-4xl font-extrabold text-indigo-600 tabular-nums">100%</p>
              <p className="text-xs font-semibold text-slate-600 mt-1">Terserap Kerja & Kuliah</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. KONSENTRASI KEAHLIAN (JURUSAN) WITH STAGGERED CARDS */}
      {/* ========================================================================= */}
      <section id="jurusan-section" className="py-20 lg:py-24 bg-white relative overflow-hidden scroll-mt-24 section-snap">
        {/* Parallax Background Accent Glow */}
        <motion.div 
          style={{ y: jurusanGlowY }}
          className="absolute -right-32 top-1/3 w-96 h-96 bg-blue-100/60 rounded-full blur-3xl pointer-events-none will-change-transform"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55 }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <span className="text-xs font-bold text-blue-700 tracking-wider uppercase">JURUSAN</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-1">
              Konsentrasi <span className="text-blue-600">Keahlian</span>
            </h2>
            <div className="w-16 h-1 bg-blue-600 mx-auto mt-3 rounded-full" />
            <p className="text-sm text-slate-600 mt-4">
              Pilihan program keahlian unggulan berbasis kebutuhan revolusi industri modern dan digitalisasi global.
            </p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            
            {/* 1. TEKNIK OTOMOTIF (TO) */}
            <motion.div 
              id="jurusan-to" 
              variants={cardStaggerVariants}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
              className="bg-slate-50 border border-slate-200/80 rounded-2xl p-8 hover:shadow-2xl hover:border-amber-300 transition-all duration-300 flex flex-col group scroll-mt-24"
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 mb-6 group-hover:scale-110 group-hover:bg-amber-100 transition-all">
                <Wrench className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-amber-600 transition-colors">
                Teknik Otomotif (TO)
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed flex-grow">
                Pusat inovasi mesin dan otomotif! Jurusan TO membekali siswa dengan keahlian membongkar, merakit, dan menganalisis teknologi kendaraan bermotor terkini. Jadilah teknisi handal yang siap menguasai industri otomotif masa depan.
              </p>

              <div className="mt-6 pt-5 border-t border-slate-200/80 flex items-center justify-between text-xs font-semibold">
                <span className="text-amber-700 bg-amber-100/70 px-2.5 py-1 rounded">Teknologi Mesin & TBSM</span>
                <button
                  onClick={onRegisterClick}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1 group/btn cursor-pointer"
                >
                  <span>Daftar Jurusan</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>

            {/* 2. TEKNIK JARINGAN KOMPUTER & TELEKOMUNIKASI (TJKT) */}
            <motion.div 
              id="jurusan-tjkt" 
              variants={cardStaggerVariants}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
              className="bg-slate-50 border border-slate-200/80 rounded-2xl p-8 hover:shadow-2xl hover:border-blue-300 transition-all duration-300 flex flex-col group scroll-mt-24"
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 group-hover:bg-blue-100 transition-all">
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
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1 group/btn cursor-pointer"
                >
                  <span>Daftar Jurusan</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>

            {/* 3. AKUNTANSI DAN KEUANGAN LEMBAGA (AKL) */}
            <motion.div 
              id="jurusan-akl" 
              variants={cardStaggerVariants}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
              className="bg-slate-50 border border-slate-200/80 rounded-2xl p-8 hover:shadow-2xl hover:border-emerald-300 transition-all duration-300 flex flex-col group scroll-mt-24"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 group-hover:bg-emerald-100 transition-all">
                <Calculator className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-emerald-600 transition-colors">
                Akuntansi dan Keuangan Lembaga (AKL)
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed flex-grow">
                Mencetak pahlawan finansial masa depan. Jurusan AKL melatih ketelitian dan keahlianmu dalam mengelola keuangan, perpajakan, dan akuntansi digital. Raih karir cemerlang di sektor perbankan maupun startup bisnis.
              </p>

              <div className="mt-6 pt-5 border-t border-slate-200/80 flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded">Fintech & Perbankan</span>
                <button
                  onClick={onRegisterClick}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1 group/btn cursor-pointer"
                >
                  <span>Daftar Jurusan</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>

          </motion.div>

          {/* Quick scroll to next section (Fasilitas) */}
          <div className="mt-12 text-center">
            <button
              onClick={() => scrollToSection('fasilitas-section')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/90 text-xs font-bold transition-all cursor-pointer group"
              title="Lanjut ke Bagian Fasilitas & Workshop"
            >
              <span>Lanjut ke Fasilitas & Workshop Modern</span>
              <ChevronDown className="w-3.5 h-3.5 text-blue-600 group-hover:translate-y-0.5 transition-transform animate-bounce" />
            </button>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. FASILITAS & WORKSHOP (RESPONSIVE AUTO-PLAY CAROUSEL WITH TOUCH/SWIPE) */}
      {/* ========================================================================= */}
      <section id="fasilitas-section" className="py-20 bg-slate-50 border-t border-slate-200 relative scroll-mt-24 section-snap">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55 }}
            className="text-center max-w-3xl mx-auto mb-10"
          >
            <span className="text-xs font-bold text-blue-700 tracking-wider uppercase">OUR COURSES & FACILITIES</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-1">
              Fasilitas & <span className="text-blue-600">Workshop Modern</span>
            </h2>
            <div className="w-16 h-1 bg-blue-600 mx-auto mt-3 rounded-full" />
            <p className="text-sm text-slate-600 mt-4 leading-relaxed">
              Jelajahi sarana praktik berstandar industri dengan kurikulum Link & Match. Dilengkapi laboratorium komputasi terkini, simulator akuntansi, bengkel otomotif resmi, serta sentra bisnis siswa.
            </p>
          </motion.div>

          {/* Responsive Carousel Stage with Touch/Swipe Gestures */}
          <div
            className="relative"
            onMouseEnter={() => setIsCarouselHovered(true)}
            onMouseLeave={() => setIsCarouselHovered(false)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Carousel Slide Card with Framer Motion Drag and AnimatePresence */}
            <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xl bg-white">
              <AnimatePresence mode="wait" custom={swipeDirection}>
                <motion.div
                  key={activeFacility}
                  custom={swipeDirection}
                  variants={carouselSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -40 || info.velocity.x < -150) {
                      nextFacility();
                    } else if (info.offset.x > 40 || info.velocity.x > 150) {
                      prevFacility();
                    }
                  }}
                  className="grid grid-cols-1 lg:grid-cols-12 cursor-grab active:cursor-grabbing select-none"
                >
                  {/* Media Side - Ukuran Frame Seragam & Video Tercrop Sempurna */}
                  <div className="lg:col-span-6 relative min-h-[300px] sm:min-h-[380px] lg:min-h-[460px] bg-slate-950 overflow-hidden">
                    {facilities[activeFacility].isVideo ? (
                      <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-950 group">
                        <video
                          ref={videoRef}
                          src="/videos/workshop_otomotif.mp4"
                          autoPlay
                          loop
                          muted={isVideoMuted}
                          playsInline
                          className="absolute inset-0 w-full h-full object-cover object-center cursor-pointer select-none"
                          onClick={toggleVideoPlay}
                          title="Klik untuk Jeda / Putar"
                        />

                        {/* Top Badges */}
                        <div className="absolute top-4 left-4 bg-red-600/90 backdrop-blur-md text-white text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 z-20 pointer-events-none">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          <span>WORKSHOP OTOMOTIF • LIVE LOOP</span>
                        </div>

                        {/* Video Controls Bar */}
                        <div className="absolute inset-x-0 bottom-0 p-3.5 bg-gradient-to-t from-slate-950/95 via-slate-950/55 to-transparent flex items-center justify-between z-20 transition-opacity">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={toggleVideoPlay}
                              className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-md transition-colors cursor-pointer"
                              title={isVideoPlaying ? 'Jeda Video' : 'Putar Video'}
                            >
                              {isVideoPlaying ? (
                                <Pause className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={toggleVideoMute}
                              className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-md transition-colors cursor-pointer"
                              title={isVideoMuted ? 'Nyalakan Audio' : 'Bisukan Audio'}
                            >
                              {isVideoMuted ? (
                                <VolumeX className="w-3.5 h-3.5" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <span className="text-[11px] font-medium text-slate-200 hidden sm:inline">
                              {isVideoMuted ? 'Audio Bisu' : 'Audio Aktif'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleOpenFullscreen}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-full shadow-md flex items-center gap-1.5 transition-all transform hover:scale-105 cursor-pointer"
                              title="Tampilkan Layar Penuh (Full Screen)"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                              <span>Full Screen</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-900">
                        <img
                          src={facilities[activeFacility].image}
                          alt={facilities[activeFacility].title}
                          className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-4 left-4 bg-blue-600/90 backdrop-blur-md text-white text-xs font-extrabold px-3 py-1.5 rounded-full shadow-lg">
                          {facilities[activeFacility].completionRate} SIAP PRAKTIK
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Information Content Side */}
                  <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-white">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                          {facilities[activeFacility].subtitle}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-400">
                          0{activeFacility + 1} / 0{facilities.length}
                        </span>
                      </div>

                      <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
                        {facilities[activeFacility].title}
                      </h3>

                      <p className="text-sm text-slate-600 leading-relaxed font-normal">
                        {facilities[activeFacility].description}
                      </p>

                      <div className="pt-2">
                        <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                          Karakteristik & Keunggulan:
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {facilities[activeFacility].tags.map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                      <button
                        onClick={onRegisterClick}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 cursor-pointer"
                      >
                        <span>Daftar Jurusan Ini</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Tersertifikasi LSP & Industri</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigasi Hanya Melalui Titik-Titik */}
            <div className="mt-8 flex items-center justify-center gap-3">
              {facilities.map((_, idx) => {
                const isActive = activeFacility === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => goToFacility(idx)}
                    className={`h-3 rounded-full transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'w-10 bg-blue-600 shadow-md shadow-blue-500/30'
                        : 'w-3 bg-slate-300 hover:bg-slate-400'
                    }`}
                    aria-label={`Pilih fasilitas ${idx + 1}: ${facilities[idx].title}`}
                    title={facilities[idx].title}
                  />
                );
              })}
            </div>

          </div>


        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. TESTIMONIALS (WHAT THEY THINK) WITH STAGGERED REVEAL */}
      {/* ========================================================================= */}
      <section id="testimonials-section" className="py-20 bg-white scroll-mt-24 section-snap">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55 }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <span className="text-xs font-bold text-blue-700 tracking-wider uppercase">TESTIMONIALS</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-1">
              What They <span className="text-blue-600">Think</span>
            </h2>
            <div className="w-16 h-1 bg-blue-600 mx-auto mt-3 rounded-full" />
            <p className="text-sm text-slate-600 mt-4">
              Kisah sukses alumni SMK Muhammadiyah Bawang yang telah berkiprah di dunia usaha, industri, dan startup digital.
            </p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {testimonials.map((testi, idx) => (
              <motion.div
                key={idx}
                variants={cardStaggerVariants}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="bg-slate-50 border border-slate-200/80 rounded-2xl p-7 flex flex-col justify-between hover:shadow-xl transition-all"
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
              </motion.div>
            ))}
          </motion.div>

          {/* Quick scroll to next section (Kontak) */}
          <div className="mt-12 text-center">
            <button
              onClick={() => scrollToSection('kontak-section')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/90 text-xs font-bold transition-all cursor-pointer group"
              title="Lanjut ke Bagian Kontak & Lokasi Peta"
            >
              <span>Lanjut ke Kontak & Lokasi Peta</span>
              <ChevronDown className="w-3.5 h-3.5 text-blue-600 group-hover:translate-y-0.5 transition-transform animate-bounce" />
            </button>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. HUBUNGI KAMI & GOOGLE MAPS EMBED (BAGIAN BAWAH ATAS FOOTER DENGAN GRADASI) */}
      {/* Background gradasi memudar: Warna Atas #FFFFFF ke Warna Bawah #D3E3FD */}
      {/* ========================================================================= */}
      <section 
        id="kontak-section" 
        className="py-20 bg-gradient-to-b from-[#FFFFFF] via-[#E8F1FD] to-[#D3E3FD] text-slate-900 relative overflow-hidden border-t border-slate-200 scroll-mt-24 section-snap"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Contact description with Staggered items */}
            <motion.div 
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="lg:col-span-5 space-y-6"
            >
              <motion.span variants={fadeInUpItem} className="text-xs font-bold text-blue-700 tracking-wider uppercase block">
                HUBUNGI KAMI
              </motion.span>
              <motion.h2 variants={fadeInUpItem} className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
                Ayo Bergabung Bersama SMK Muhammadiyah Bawang
              </motion.h2>
              <motion.p variants={fadeInUpItem} className="text-sm text-slate-600 leading-relaxed">
                Jika Anda membutuhkan informasi pendaftaran peserta didik baru (PPDB), jurusan, biaya pendidikan, atau fasilitas sekolah, silakan hubungi kami. Tim PPDB SMK Muhammadiyah Bawang siap melayani dan membantu Anda dengan ramah.
              </motion.p>

              {/* Contact direct boxes */}
              <motion.div variants={fadeInUpItem} className="space-y-3 pt-2">
                <a
                  href="https://wa.me/628561333392?text=Assalamu%27alaikum%20Warahmatullahi%20Wabarakatuh.%20Yth.%20Panitia%20PPDB%20SMK%20Muhammadiyah%20Bawang%2C%20perkenalkan%20saya%20ingin%20menanyakan%20informasi%20terkait%20pendaftaran%20peserta%20didik%20baru%20(PPDB).%20Terima%20kasih."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl bg-white/95 border border-slate-200/90 hover:border-emerald-500 shadow-xs hover:shadow-md transition-all flex items-center gap-4 group cursor-pointer hover:-translate-y-0.5"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block">WHATSAPP PPDB</span>
                    <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                      0856-1333-392
                    </span>
                  </div>
                </a>

                <a
                  href="tel:085741977501"
                  className="p-4 rounded-xl bg-white/95 border border-slate-200/90 hover:border-blue-500 shadow-xs hover:shadow-md transition-all flex items-center gap-4 group cursor-pointer hover:-translate-y-0.5"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block">MOBILE / TELEPON</span>
                    <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      0857-4197-7501
                    </span>
                  </div>
                </a>
              </motion.div>

              <motion.div variants={fadeInUpItem} className="pt-2">
                <button
                  onClick={onRegisterClick}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-sm rounded-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  Daftar Sekarang Online
                </button>
              </motion.div>
            </motion.div>

            {/* Right Google Maps Embed with Smooth Scale Reveal */}
            <motion.div 
              initial={{ opacity: 0, x: 25 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.65, ease: smoothEase }}
              className="lg:col-span-7"
            >
              <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xl hover:shadow-2xl transition-all">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <span>SMKS MUHAMMADIYAH BAWANG - Jl. Raya Bawang - Sukorejo KM 01, Jlamprang, Bawang, Batang 51274</span>
                  </div>
                  <a
                    href="https://maps.google.com/?q=SMK+Muhammadiyah+Bawang+Batang"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-bold"
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
            </motion.div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* FLOATING WHATSAPP BUTTON (BOTTOM-LEFT) */}
      {/* ========================================================================= */}
      <div className="fixed bottom-6 left-6 z-40">
        <a
          href="https://wa.me/628561333392?text=Assalamu%27alaikum%20Warahmatullahi%20Wabarakatuh.%20Yth.%20Panitia%20PPDB%20SMK%20Muhammadiyah%20Bawang%2C%20perkenalkan%20saya%20ingin%20berkonsultasi%20mengenai%20pendaftaran%20dan%20program%20keahlian%20di%20SMK%20Muhammadiyah%20Bawang.%20Terima%20kasih."
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

      {/* ========================================================================= */}
      {/* FLOATING SMOOTH SCROLL TO TOP BUTTON (BOTTOM-RIGHT) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 16 }}
            transition={{ duration: 0.2 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-40 p-3.5 bg-gradient-to-tr from-blue-700 to-indigo-600 hover:from-blue-600 hover:to-indigo-500 text-white rounded-full shadow-2xl border border-white/20 transition-all flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
            title="Kembali ke Atas (Smooth Scroll)"
            aria-label="Kembali ke Atas"
          >
            <ArrowUp className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-400 py-8 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 SPMB SMK MUHIBA | SMK Muhammadiyah Bawang by @hndx07. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="https://www.smkmuhiba.sch.id" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1 font-semibold text-blue-400">
              <span>www.smkmuhiba.sch.id</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button onClick={onLoginClick} className="hover:text-white transition-colors cursor-pointer">
              Login Petugas & Siswa
            </button>
          </div>
        </div>
      </footer>

      {/* FULLSCREEN VIDEO MODAL */}
      {isFullscreenModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between text-white z-20 pb-3 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Workshop Teknik Otomotif - SMK Muhammadiyah Bawang
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Pemutaran Bersih Layar Penuh • Loop Berulang Otomatis (Tanpa Watermark/Ikon)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleVideoMute}
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors border border-white/20 cursor-pointer"
              >
                {isVideoMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>{isVideoMuted ? 'Nyalakan Audio' : 'Bisukan Audio'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreenModalOpen(false)}
                className="p-2 bg-white/10 hover:bg-red-600 text-white rounded-lg transition-colors border border-white/20 cursor-pointer"
                title="Tutup Layar Penuh (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Full Screen Video Container */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden my-3">
            <video
              ref={modalVideoRef}
              src="/videos/workshop_otomotif.mp4"
              autoPlay
              loop
              muted={isVideoMuted}
              playsInline
              controls
              className="max-w-full max-h-[80vh] w-auto h-auto rounded-xl shadow-2xl object-contain border border-white/10"
            />
          </div>

          {/* Footer bar */}
          <div className="text-xs text-slate-400 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Fasilitas Resmi Teknik Otomotif (TBSM) SMK Muhammadiyah Bawang</span>
            <button
              onClick={() => setIsFullscreenModalOpen(false)}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 text-blue-300 hover:text-white rounded text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Keluar Mode Layar Penuh (Esc)</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
