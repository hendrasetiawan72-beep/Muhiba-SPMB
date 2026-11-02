// ===========================================================================
// PERUBAHAN 1 — IMPORT lucide-react
// Hapus baris "Sparkles," dari daftar import. Contoh akhirnya:
//   ...
//   Code2,
//   Eye,
//   EyeOff
// } from 'lucide-react';
// ===========================================================================


// ===========================================================================
// PERUBAHAN 2 — Tambahkan data jurusan DI ATAS "export const LandingPage"
// (taruh setelah komponen FasilitasCarousel)
// ===========================================================================
const JURUSAN = [
  {
    id: 'to' as const,
    icon: Wrench,
    title: 'Teknik Otomotif (TO)',
    tag: 'Teknologi Mesin & TBSM',
    sub: 'Otomotif Modern · Perawatan Berkala · Ototronik',
    desc: 'Pusat inovasi mesin dan otomotif! Jurusan TO membekali siswa dengan keahlian membongkar, merakit, dan menganalisis teknologi kendaraan bermotor terkini. Jadilah teknisi handal yang siap menguasai industri otomotif masa depan.',
    card: 'from-rose-50/90 via-rose-100/70 to-rose-200/50 border-rose-200/90 hover:border-rose-400',
    watermark: 'text-rose-500/10 group-hover:rotate-12',
    iconBox: 'border-rose-200 text-rose-600 group-hover:bg-rose-600',
    tagCls: 'text-rose-800 border-rose-300/60',
    titleHover: 'group-hover:text-rose-700',
    subCls: 'text-rose-800/80',
    toggleCls: 'hover:bg-rose-600 text-rose-700 border-rose-300/70',
    descBorder: 'border-rose-300/40',
    footBorder: 'border-rose-300/50',
    quotaCls: 'text-rose-700',
    ctaCls: 'from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500',
  },
  {
    id: 'tjkt' as const,
    icon: Cpu,
    title: 'Teknik Jaringan Komputer & Telekomunikasi (TJKT)',
    tag: 'Mikrotik & Fiber Optic',
    sub: 'Cyber Security · Fiber Optic · Cloud Computing',
    desc: 'Gerbang menuju dunia digital tanpa batas. Di TJKT, kamu akan menguasai infrastruktur jaringan, keamanan siber, dan teknologi fiber optik. Persiapkan dirimu menjadi arsitek jaringan yang menghubungkan dunia.',
    card: 'from-blue-50/90 via-sky-100/70 to-blue-200/50 border-blue-200/90 hover:border-blue-400',
    watermark: 'text-blue-500/10 group-hover:-rotate-12',
    iconBox: 'border-blue-200 text-blue-600 group-hover:bg-blue-600',
    tagCls: 'text-blue-800 border-blue-300/60',
    titleHover: 'group-hover:text-blue-700',
    subCls: 'text-blue-800/80',
    toggleCls: 'hover:bg-blue-600 text-blue-700 border-blue-300/70',
    descBorder: 'border-blue-300/40',
    footBorder: 'border-blue-300/50',
    quotaCls: 'text-blue-700',
    ctaCls: 'from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500',
  },
  {
    id: 'akl' as const,
    icon: Calculator,
    title: 'Akuntansi & Keuangan Lembaga (AKL)',
    tag: 'Fintech & Perbankan',
    sub: 'Perbankan Syariah · Perpajakan Digital · Accurate Software',
    desc: 'Mencetak pahlawan finansial masa depan. Jurusan AKL melatih ketelitian dan keahlianmu dalam mengelola keuangan, perpajakan, dan akuntansi digital. Raih karir cemerlang di sektor perbankan maupun startup bisnis.',
    card: 'from-emerald-50/90 via-green-100/70 to-emerald-200/50 border-emerald-200/90 hover:border-emerald-400',
    watermark: 'text-emerald-500/10 group-hover:rotate-12',
    iconBox: 'border-emerald-200 text-emerald-600 group-hover:bg-emerald-600',
    tagCls: 'text-emerald-800 border-emerald-300/60',
    titleHover: 'group-hover:text-emerald-700',
    subCls: 'text-emerald-800/80',
    toggleCls: 'hover:bg-emerald-600 text-emerald-700 border-emerald-300/70',
    descBorder: 'border-emerald-300/40',
    footBorder: 'border-emerald-300/50',
    quotaCls: 'text-emerald-700',
    ctaCls: 'from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500',
  },
];


// ===========================================================================
// PERUBAHAN 3 — GANTI SELURUH BAGIAN
//   "{/* 4. KONSENTRASI KEAHLIAN (JURUSAN) ... */}"
// sampai penutup </section> sebelum "{/* 5. FASILITAS & WORKSHOP */}"
// dengan kode di bawah ini.
// ===========================================================================

      {/* 4. KONSENTRASI KEAHLIAN (JURUSAN) */}
      <section id="jurusan-section" className="py-20 lg:py-24 bg-gradient-to-b from-slate-50 via-slate-100/70 to-blue-50/40 relative overflow-hidden scroll-mt-24 section-snap">
        <motion.div
          style={{ y: jurusanGlowY }}
          className="absolute -right-32 top-1/3 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none will-change-transform"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55 }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
              Program Unggulan
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-1">
              Konsentrasi <span className="text-blue-600">Keahlian</span>
            </h2>
            <div className="w-16 h-1 bg-blue-600 mx-auto mt-3 rounded-full" />
            <p className="text-sm text-slate-600 mt-4 leading-relaxed">
              Klik <span className="font-semibold text-slate-800">"Lihat Detail Deskripsi"</span> untuk mengeksplorasi kurikulum dan profil lengkap tiap konsentrasi keahlian.
            </p>
          </motion.div>

          {/* items-stretch = semua kartu satu baris otomatis setinggi sama */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch"
          >
            {JURUSAN.map((j) => {
              const Icon = j.icon;
              const isOpen = expandedJurusan[j.id];
              return (
                <motion.div
                  key={j.id}
                  id={`jurusan-${j.id}`}
                  variants={cardStaggerVariants}
                  whileHover={{ y: -8, scale: 1.01, transition: { duration: 0.25 } }}
                  className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${j.card} border p-7 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col h-full group scroll-mt-24`}
                >
                  <Icon className={`absolute -bottom-8 -right-8 w-44 h-44 group-hover:scale-110 transition-transform duration-700 ease-out pointer-events-none ${j.watermark}`} />

                  <div className="flex items-center justify-between gap-3 mb-5 relative z-10">
                    <div className={`w-14 h-14 shrink-0 rounded-2xl bg-white/90 shadow-md border flex items-center justify-center group-hover:scale-110 group-hover:text-white transition-all duration-300 ${j.iconBox}`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <span className={`text-[11px] font-extrabold bg-white/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border shadow-2xs text-right ${j.tagCls}`}>
                      {j.tag}
                    </span>
                  </div>

                  {/* min-h menjaga judul 1 baris & 2-3 baris tetap sejajar */}
                  <h3 className={`text-xl font-extrabold text-slate-900 transition-colors relative z-10 md:min-h-[5.25rem] ${j.titleHover}`}>
                    {j.title}
                  </h3>
                  <p className={`text-xs font-semibold mt-1 mb-4 relative z-10 md:min-h-[2rem] ${j.subCls}`}>
                    {j.sub}
                  </p>

                  <div className="relative z-10">
                    <button
                      type="button"
                      onClick={() => toggleJurusanDesc(j.id)}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 hover:text-white text-xs font-bold transition-all shadow-xs hover:shadow-md cursor-pointer border ${j.toggleCls}`}
                    >
                      {isOpen ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Sembunyikan Deskripsi</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Lihat Detail Deskripsi</span>
                        </>
                      )}
                      <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </motion.span>
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key={`desc-${j.id}`}
                        initial={{ height: 0, opacity: 0, y: -10 }}
                        animate={{ height: 'auto', opacity: 1, y: 0 }}
                        exit={{ height: 0, opacity: 0, y: -10 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden relative z-10"
                      >
                        <div className={`mt-4 pt-3 border-t text-sm text-slate-700 leading-relaxed bg-white/70 backdrop-blur-sm p-4 rounded-2xl border border-white/80 shadow-inner ${j.descBorder}`}>
                          {j.desc}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* mt-auto = footer selalu menempel di dasar kartu */}
                  <div className={`mt-auto pt-4 border-t flex items-center justify-between relative z-10 ${j.footBorder}`}>
                    <span className={`text-[11px] font-bold ${j.quotaCls}`}>Kuota Terbatas</span>
                    <button
                      onClick={onRegisterClick}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer ${j.ctaCls}`}
                    >
                      <span>Daftar Jurusan</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          <div className="mt-12 text-center">
            <button
              onClick={() => scrollToSection('fasilitas-section')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/90 text-xs font-bold transition-all cursor-pointer group shadow-xs hover:shadow-md"
              title="Lanjut ke Bagian Fasilitas & Workshop"
            >
              <span>Lanjut ke Fasilitas & Workshop Modern</span>
              <ChevronDown className="w-3.5 h-3.5 text-blue-600 group-hover:translate-y-0.5 transition-transform animate-bounce" />
            </button>
          </div>
        </div>
      </section>
