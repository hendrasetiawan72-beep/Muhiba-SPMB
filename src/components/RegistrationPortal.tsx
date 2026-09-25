import React, { useState } from 'react';
import { 
  Building2, 
  BookMarked, 
  Users, 
  CheckCircle, 
  FileText, 
  Phone, 
  Printer, 
  ArrowRight, 
  Lock, 
  User, 
  CreditCard, 
  AlertCircle,
  X,
  Check
} from 'lucide-react';
import { dbService } from '../services/supabase';
import { Student, User as UserType, JurusanType } from '../types/database';

interface RegistrationPortalProps {
  onSuccessRegister: (user: UserType, student: Student) => void;
  onNavigateLogin: () => void;
  onNavigateHome: () => void;
}

export const RegistrationPortal: React.FC<RegistrationPortalProps> = ({
  onSuccessRegister,
  onNavigateLogin,
  onNavigateHome,
}) => {
  // Tabs: 'info' | 'syarat' | 'kontak'
  const [activeTab, setActiveTab] = useState<'info' | 'syarat' | 'kontak'>('info');
  const [showRegisterForm, setShowRegisterForm] = useState<boolean>(false);
  const [buktiPendaftaran, setBuktiPendaftaran] = useState<{
    student: Student;
    rawPassword: string;
  } | null>(null);

  // Form states
  const [nik, setNik] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [jurusanPilihan, setJurusanPilihan] = useState<JurusanType>('TO');
  const [noWa, setNoWa] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const alurImageUrl =
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEga2-1HAuZXRM2x_IXfGzJtMmJ6YoCWwCgTvmdPWNN786gbn4m4p7P_nh_3H20kAbYoF4LX_Y9gqzkewq7NrCjp__JnwlA24Wwhqp_xvTL-5z_WOQS2Ta8tuIsh97yime-a_EmX5P1F9c92SoA2D8Anmejlu8FTLrP1jV2L1NtggjWz8Z4mWojqdUY5b4zr/s1668/44856.png';

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanNik = nik.trim();
    if (!/^\d{16}$/.test(cleanNik)) {
      setErrorMessage('NIK harus terdiri dari 16 digit angka sesuai KTP / Kartu Keluarga.');
      return;
    }

    if (!namaLengkap.trim()) {
      setErrorMessage('Nama lengkap wajib diisi.');
      return;
    }

    if (!noWa.trim()) {
      setErrorMessage('Nomor WhatsApp wajib diisi untuk konfirmasi info pendaftaran.');
      return;
    }

    if (password.length < 5) {
      setErrorMessage('Password minimal 5 karakter agar akun Anda aman.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi password tidak cocok dengan password yang dibuat.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await dbService.register({
        nik: cleanNik,
        nama_lengkap: namaLengkap,
        jurusan_pilihan: jurusanPilihan,
        no_wa: noWa,
        password: password,
      });

      // Show proof modal matching screenshot 7
      setBuktiPendaftaran({
        student: res.student,
        rawPassword: password,
      });
      setShowRegisterForm(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mendaftar. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ========================================================================= */}
        {/* TOP WELCOME BAR (Matches Screenshot 4, 5, 6) */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-wide">
            SELAMAT DATANG CALON PESERTA DIDIK
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowRegisterForm(true);
                setBuktiPendaftaran(null);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm transition-colors uppercase tracking-wider"
            >
              DAFTAR SEKARANG
            </button>
            <button
              onClick={onNavigateLogin}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors uppercase tracking-wider"
            >
              MASUK KE WEB
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3 STATS COUNTERS (Matches Screenshot 4, 5, 6) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Card 1: Data Sekolah */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Data Sekolah</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums">59</p>
              <p className="text-[11px] text-slate-400">Sekolah Asal</p>
            </div>
          </div>

          {/* Card 2: Data Jurusan */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <BookMarked className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Data Jurusan</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums">3</p>
              <p className="text-[11px] text-slate-400">Program Keahlian</p>
            </div>
          </div>

          {/* Card 3: Kuota Pendaftaran */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Kuota Pendaftaran</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums">1.500</p>
              <p className="text-[11px] text-slate-400">Siswa Total Kuota</p>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* ALUR PPDB BANNER IMAGE (Screenshot 4, 5, 6) */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 sm:p-6 overflow-hidden">
          <div className="relative rounded-lg overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center">
            <img
              src={alurImageUrl}
              alt="Alur PPDB Online SMK Muhammadiyah Bawang - Sekolah SMART"
              className="w-full h-auto object-contain max-h-[520px]"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TABBED INFORMATION BOX - Optimized for Tablet & Desktop Windows */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-8">
          
          {/* Top Segmented Tabs Navigation */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-1.5 bg-slate-100/90 rounded-xl mb-6">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'info'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Informasi Pendaftaran</span>
            </button>

            <button
              onClick={() => setActiveTab('syarat')}
              className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'syarat'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Syarat Pendaftaran</span>
            </button>

            <button
              onClick={() => setActiveTab('kontak')}
              className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'kontak'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Phone className="w-4 h-4 shrink-0" />
              <span>Kontak Pendaftaran</span>
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="bg-slate-50/70 p-5 sm:p-7 rounded-xl border border-slate-200/70">
            
            {/* TAB 1: INFORMASI PENDAFTARAN - Clean 3-Step Card Layout for Tablet & PC */}
            {activeTab === 'info' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Alur & Langkah Pendaftaran Online</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Ikuti 3 tahapan mudah untuk mendaftar sebagai calon peserta didik baru SMK Muhiba.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Step 1 */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-colors">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 font-extrabold text-xs flex items-center justify-center mb-3">
                        01
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mb-1">Daftar Online</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Calon siswa mengisi data dasar (NIK, Nama, WhatsApp, Pilihan Jurusan) dan membuat password akun.
                      </p>
                    </div>
                    <div className="pt-4 mt-3 border-t border-slate-100">
                      <button
                        onClick={() => setShowRegisterForm(true)}
                        className="w-full py-2 px-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Daftar Sekarang</span>
                      </button>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 font-extrabold text-xs flex items-center justify-center mb-3">
                        02
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mb-1">Login Masuk</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Gunakan nomor pendaftaran / NIK dan password yang didapat untuk masuk ke dashboard siswa.
                      </p>
                    </div>
                    <div className="pt-4 mt-3 border-t border-slate-100">
                      <button
                        onClick={onNavigateLogin}
                        className="w-full py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Login Masuk</span>
                      </button>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-colors">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 font-extrabold text-xs flex items-center justify-center mb-3">
                        03
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mb-1">Lengkapi Berkas</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Lengkapi formulir biodata diri, alamat, data orang tua, serta serahkan / upload berkas pendaftaran.
                      </p>
                    </div>
                    <div className="pt-4 mt-3 border-t border-slate-100">
                      <div className="w-full py-2 px-3 text-xs font-semibold text-blue-700 bg-blue-50 rounded-md flex items-center justify-center gap-1 text-center">
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                        <span>Verifikasi Panitia</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SYARAT PENDAFTARAN - Clean 2-Column Responsive Grid */}
            {activeTab === 'syarat' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Dokumen & Syarat Pendaftaran Siswa Baru</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Siapkan berkas-berkas berikut sebelum verifikasi dan penyerahan formulir:</p>
                  </div>
                  <span className="self-start sm:self-auto text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                    8 Berkas Wajib & Pendukung
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {[
                    { title: 'Surat Keterangan Lulus (SKL) Asli', desc: 'Asli dari SMP / MTs yang telah dilegalisir' },
                    { title: 'Fotocopy Ijazah SMP / MTs / Paket B', desc: 'FC Ijazah SD/MI jika ijazah SMP belum terbit' },
                    { title: 'Fotocopy Akta Kelahiran', desc: '1 lembar fotocopy yang jelas terbaca' },
                    { title: 'Fotocopy Kartu Keluarga (KK)', desc: '1 lembar fotocopy KK terbaru' },
                    { title: 'Fotocopy KTP Orang Tua', desc: 'KTP Ayah & KTP Ibu masing-masing 1 lembar' },
                    { title: 'Pas Foto 3x4 Sejumlah 5 Lembar', desc: 'Foto formal berseragam sekolah asal' },
                    { title: 'Fotocopy KIP / PKH / KKS / SKTM', desc: 'Khusus bagi pemegang kartu bantuan pemerintah' },
                    { title: 'Fotocopy Piagam Penghargaan', desc: 'Bagi pendaftar jalur prestasi akademik / non-akademik' },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs flex items-start gap-3 hover:border-blue-300 transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{item.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: KONTAK PENDAFTARAN - Responsive Cards with Direct WhatsApp Buttons */}
            {activeTab === 'kontak' && (
              <div className="space-y-4">
                <div className="pb-2 border-b border-slate-200/80">
                  <h3 className="text-base font-bold text-slate-900">Kontak Panitia SPMB SMK MUHIBA</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Ada pertanyaan seputar jurusan, biaya, atau alur pendaftaran? Hubungi panitia resmi kami.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Contact 1 */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-extrabold text-sm">
                        ES
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">Panitia PPDB 1</span>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">EDI SETIANTO</h4>
                        <p className="text-xs text-slate-500">Pelayanan & Konsultasi Jurusan</p>
                      </div>
                    </div>
                    <a
                      href="https://wa.me/628561333392?text=Halo%20Pak%20Edi,%20saya%20ingin%20bertanya%20informasi%20pendaftaran%20SMK%20Muhiba"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Chat WhatsApp (08561333392)</span>
                    </a>
                  </div>

                  {/* Contact 2 */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-extrabold text-sm">
                        SH
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase">Panitia PPDB 2</span>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">SUGI HARNOTO</h4>
                        <p className="text-xs text-slate-500">Informasi Alur & Berkas Fisik</p>
                      </div>
                    </div>
                    <a
                      href="https://wa.me/6285741977501?text=Halo%20Pak%20Sugi,%20saya%20ingin%20bertanya%20informasi%20pendaftaran%20SMK%20Muhiba"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Chat WhatsApp (085741977501)</span>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer with official address and website link */}
        <div className="pt-4 border-t border-slate-200/80 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            <p className="font-semibold text-slate-700">SMK Muhammadiyah Bawang</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Jl. Raya Bawang - Sukorejo KM 01, Jlamprang, Bawang, Kabupaten Batang, Jawa Tengah 51274
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <a
              href="https://www.smkmuhiba.sch.id"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded text-xs transition-colors border border-blue-200"
            >
              Kunjungi Web Sekolah (smkmuhiba.sch.id)
            </a>
            <span className="text-[11px] text-slate-400">
              Copyright © 2026 by @hndx07
            </span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* INITIAL REGISTRATION MODAL FORM */}
      {/* ========================================================================= */}
      {showRegisterForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 relative my-8 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowRegisterForm(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Form Pendaftaran Awal</span>
              <h2 className="text-xl font-extrabold text-slate-900 mt-1">
                Registrasi Calon Siswa Baru
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Buat akun dengan NIK dan Password untuk mengakses formulir lengkap.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Induk Kependudukan (NIK) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    maxLength={16}
                    value={nik}
                    onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 3325028202890001 (16 digit)"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">NIK akan digunakan sebagai username login.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Siswa <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={namaLengkap}
                    onChange={(e) => setNamaLengkap(e.target.value)}
                    placeholder="Nama lengkap sesuai ijazah / akta"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilihan Konsentrasi Keahlian (Jurusan) <span className="text-red-500">*</span>
                </label>
                <select
                  value={jurusanPilihan}
                  onChange={(e) => setJurusanPilihan(e.target.value as JurusanType)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold"
                >
                  <option value="TO">Teknik Otomotif (TO)</option>
                  <option value="TJKT">Teknik Jaringan Komputer & Telekomunikasi (TJKT)</option>
                  <option value="AKL">Akuntansi dan Keuangan Lembaga (AKL)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor WhatsApp Siswa / Orang Tua <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={noWa}
                    onChange={(e) => setNoWa(e.target.value)}
                    placeholder="Contoh: 085582580"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Buat Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 5 karakter"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Konfirmasi Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Memproses Pendaftaran...' : 'Simpan & Dapatkan Bukti Pendaftaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BUKTI PENDAFTARAN MODAL / CARD (Exact Match to Screenshot 7) */}
      {/* ========================================================================= */}
      {buktiPendaftaran && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 relative my-8 animate-in fade-in duration-200">
            
            {/* Header info */}
            <div className="flex items-start justify-between border-b pb-4 mb-5">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-wider uppercase">
                  BUKTI PENDAFTARAN PESERTA DIDIK BARU
                </h3>
                <p className="text-[11px] font-semibold text-blue-700">
                  SPMB SMK MUHAMMADIYAH BAWANG
                </p>
              </div>
              <button
                onClick={() => setBuktiPendaftaran(null)}
                className="text-slate-400 hover:text-slate-600 no-print"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Registration Summary Table (Screenshot 7) */}
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full divide-y divide-slate-200">
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2.5 font-semibold text-slate-600 w-1/3">Nama Peserta</td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">{buktiPendaftaran.student.nama_lengkap}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-slate-600">No. Pendaftaran</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-700">{buktiPendaftaran.student.nomor_pendaftaran}</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2.5 font-semibold text-slate-600">NIK (Username)</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{buktiPendaftaran.student.nik}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-slate-600">Password</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{buktiPendaftaran.rawPassword}</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2.5 font-semibold text-slate-600">Jurusan Pilihan</td>
                    <td className="px-4 py-2.5 font-semibold text-emerald-700">{buktiPendaftaran.student.jurusan_pilihan}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-slate-600">Tanggal Daftar</td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{buktiPendaftaran.student.tanggal_daftar}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-[11px] text-slate-600 leading-relaxed bg-blue-50/60 p-3 rounded-lg border border-blue-100">
              <p className="font-semibold text-blue-900 mb-1">
                Dengan ini menyatakan bahwa peserta didik di atas telah <span className="font-extrabold uppercase">BERHASIL MELAKUKAN PENDAFTARAN</span> secara online.
              </p>
              <p>
                Silakan login menggunakan <strong>Nomor Pendaftaran / NIK</strong> dan <strong>Password</strong> untuk melengkapi data formulir dan mengikuti tahapan selanjutnya.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400">
              <span>Dicetak pada: {buktiPendaftaran.student.tanggal_daftar}</span>
              <span className="font-semibold text-slate-600">Panitia SPMB SMK Muhammadiyah Bawang</span>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3 no-print">
              <button
                onClick={handlePrint}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>CETAK BUKTI PENDAFTARAN</span>
              </button>

              <button
                onClick={() => {
                  const loggedUser: UserType = {
                    id: buktiPendaftaran.student.user_id,
                    nik: buktiPendaftaran.student.nik,
                    role: 'student',
                    password_hash: buktiPendaftaran.rawPassword,
                    created_at: new Date().toISOString(),
                  };
                  onSuccessRegister(loggedUser, buktiPendaftaran.student);
                }}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>Masuk Ke Dashboard Siswa</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
