import React, { useState, useEffect } from 'react';
import { 
  Home, 
  FileText, 
  CreditCard, 
  Megaphone, 
  LogOut, 
  Menu, 
  X, 
  CheckCircle2, 
  XCircle, 
  Upload, 
  Printer, 
  User, 
  MapPin, 
  Users, 
  FolderCheck,
  Check,
  Save,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Student, User as UserType, JurusanType } from '../types/database';
import { dbService } from '../services/supabase';

interface StudentDashboardProps {
  currentUser: UserType;
  initialStudent: Student;
  onLogout: () => void;
  onNavigateHome: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentUser,
  initialStudent,
  onLogout,
  onNavigateHome,
}) => {
  const [student, setStudent] = useState<Student>(initialStudent);
  const [activeMenu, setActiveMenu] = useState<'beranda' | 'formulir' | 'pembayaran' | 'pengumuman'>('beranda');
  const [activeFormTab, setActiveFormTab] = useState<'diri' | 'alamat' | 'ortu' | 'berkas'>('diri');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showWarningBanner, setShowWarningBanner] = useState(true);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Form states for Data Diri
  const [jurusan, setJurusan] = useState<JurusanType>(student.jurusan_pilihan || 'TO');
  const [ukuranBaju, setUkuranBaju] = useState(student.data_diri?.ukuran_baju || 'L');
  const [kodeReferal, setKodeReferal] = useState(student.data_diri?.kode_referal || '');
  const [nisn, setNisn] = useState(student.data_diri?.nisn || '');
  const [noKk, setNoKk] = useState(student.data_diri?.no_kk || '');
  const [namaLengkap, setNamaLengkap] = useState(student.nama_lengkap || '');
  const [tempatLahir, setTempatLahir] = useState(student.data_diri?.tempat_lahir || 'Batang');
  const [tglLahir, setTglLahir] = useState(student.data_diri?.tanggal_lahir || '2008-09-25');
  const [jenisKelamin, setJenisKelamin] = useState<'Laki-laki' | 'Perempuan'>(student.data_diri?.jenis_kelamin || 'Laki-laki');
  const [agama, setAgama] = useState(student.data_diri?.agama || 'Islam');
  const [noHp, setNoHp] = useState(student.data_diri?.no_hp || student.no_wa || '');
  const [asalSekolah, setAsalSekolah] = useState(student.data_diri?.asal_sekolah || '');
  const [anakKe, setAnakKe] = useState(student.data_diri?.anak_ke?.toString() || '1');
  const [jumlahSaudara, setJumlahSaudara] = useState(student.data_diri?.jumlah_saudara?.toString() || '2');
  const [isAnakGuru, setIsAnakGuru] = useState(student.data_diri?.is_anak_guru || false);
  const [tinggiBadan, setTinggiBadan] = useState(student.data_diri?.tinggi_badan?.toString() || '');
  const [beratBadan, setBeratBadan] = useState(student.data_diri?.berat_badan?.toString() || '');
  const [statusDalamKeluarga, setStatusDalamKeluarga] = useState(student.data_diri?.status_dalam_keluarga || 'Anak Kandung');
  const [kip, setKip] = useState(student.data_diri?.kip || '');
  const [pkh, setPkh] = useState(student.data_diri?.pkh || '');
  const [kks, setKks] = useState(student.data_diri?.kks || '');
  const [kis, setKis] = useState(student.data_diri?.kis || '');

  // Form states for Data Alamat
  const [dukuh, setDukuh] = useState(student.data_alamat?.dukuh || '');
  const [rt, setRt] = useState(student.data_alamat?.rt || '');
  const [rw, setRw] = useState(student.data_alamat?.rw || '');
  const [provinsi, setProvinsi] = useState(student.data_alamat?.provinsi || 'Jawa Tengah');
  const [kabupaten, setKabupaten] = useState(student.data_alamat?.kabupaten || 'Kabupaten Batang');
  const [kecamatan, setKecamatan] = useState(student.data_alamat?.kecamatan || 'Bawang');
  const [desa, setDesa] = useState(student.data_alamat?.desa || 'Jlamprang');
  const [kodePos, setKodePos] = useState(student.data_alamat?.kode_pos || '51274');
  const [tinggalBersama, setTinggalBersama] = useState(student.data_alamat?.tinggal_bersama || 'Orang Tua');
  const [transportasi, setTransportasi] = useState(student.data_alamat?.transportasi || 'Sepeda Motor');

  // Form states for Data Orang Tua
  const [nikAyah, setNikAyah] = useState(student.data_orang_tua?.nik_ayah || '');
  const [namaAyah, setNamaAyah] = useState(student.data_orang_tua?.nama_ayah || '');
  const [tempatLahirAyah, setTempatLahirAyah] = useState(student.data_orang_tua?.tempat_lahir_ayah || '');
  const [tglLahirAyah, setTglLahirAyah] = useState(student.data_orang_tua?.tanggal_lahir_ayah || '');
  const [pendidikanAyah, setPendidikanAyah] = useState(student.data_orang_tua?.pendidikan_ayah || 'SMA / SMK');
  const [pekerjaanAyah, setPekerjaanAyah] = useState(student.data_orang_tua?.pekerjaan_ayah || 'Wiraswasta');
  const [noHpAyah, setNoHpAyah] = useState(student.data_orang_tua?.no_hp_ayah || '');

  const [nikIbu, setNikIbu] = useState(student.data_orang_tua?.nik_ibu || '');
  const [namaIbu, setNamaIbu] = useState(student.data_orang_tua?.nama_ibu || '');
  const [tempatLahirIbu, setTempatLahirIbu] = useState(student.data_orang_tua?.tempat_lahir_ibu || '');
  const [tglLahirIbu, setTglLahirIbu] = useState(student.data_orang_tua?.tanggal_lahir_ibu || '');
  const [pendidikanIbu, setPendidikanIbu] = useState(student.data_orang_tua?.pendidikan_ibu || 'SMA / SMK');
  const [pekerjaanIbu, setPekerjaanIbu] = useState(student.data_orang_tua?.pekerjaan_ibu || 'Ibu Rumah Tangga');
  const [noHpIbu, setNoHpIbu] = useState(student.data_orang_tua?.no_hp_ibu || '');

  const [nikWali, setNikWali] = useState(student.data_orang_tua?.nik_wali || '');
  const [namaWali, setNamaWali] = useState(student.data_orang_tua?.nama_wali || '');
  const [tempatLahirWali, setTempatLahirWali] = useState(student.data_orang_tua?.tempat_lahir_wali || '');
  const [tglLahirWali, setTglLahirWali] = useState(student.data_orang_tua?.tanggal_lahir_wali || '');
  const [pendidikanWali, setPendidikanWali] = useState(student.data_orang_tua?.pendidikan_wali || '');
  const [pekerjaanWali, setPekerjaanWali] = useState(student.data_orang_tua?.pekerjaan_wali || '');
  const [noHpWali, setNoHpWali] = useState(student.data_orang_tua?.no_hp_wali || '');

  // Berkas Upload States
  const [berkasKK, setBerkasKK] = useState<string>(student.data_berkas?.kartu_keluarga?.nama_file || '');
  const [berkasSKL, setBerkasSKL] = useState<string>(student.data_berkas?.ijazah_skl?.nama_file || '');
  const [berkasAkta, setBerkasAkta] = useState<string>(student.data_berkas?.akta_kelahiran?.nama_file || '');
  const [berkasKIP, setBerkasKIP] = useState<string>(student.data_berkas?.kartu_kip?.nama_file || '');
  const [berkasFoto, setBerkasFoto] = useState<string>(student.data_berkas?.pas_foto?.nama_file || '');

  // Helper calculation for checklist completeness
  const isDiriLengkap = Boolean(
    student.nama_lengkap && 
    (student.data_diri?.nisn || nisn) && 
    (student.data_diri?.asal_sekolah || asalSekolah)
  );

  const isAlamatLengkap = Boolean(
    student.data_alamat?.dukuh || dukuh
  );

  const isOrtuLengkap = Boolean(
    (student.data_orang_tua?.nama_ayah || namaAyah) && 
    (student.data_orang_tua?.nama_ibu || namaIbu)
  );

  const isBerkasLengkap = Boolean(
    student.data_berkas?.kartu_keluarga?.nama_file || berkasKK
  );

  const showNotification = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleSaveDataDiri = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await dbService.updateStudentDataDiri(
        student.nik,
        {
          nisn,
          nik: student.nik,
          no_kk: noKk,
          nama_lengkap: namaLengkap,
          tempat_lahir: tempatLahir,
          tanggal_lahir: tglLahir,
          jenis_kelamin: jenisKelamin,
          agama,
          no_hp: noHp,
          asal_sekolah: asalSekolah,
          anak_ke: parseInt(anakKe) || 1,
          jumlah_saudara: parseInt(jumlahSaudara) || 0,
          is_anak_guru: isAnakGuru,
          tinggi_badan: parseInt(tinggiBadan) || undefined,
          berat_badan: parseInt(beratBadan) || undefined,
          status_dalam_keluarga: statusDalamKeluarga,
          kip,
          pkh,
          kks,
          kis,
        },
        jurusan,
        ukuranBaju,
        kodeReferal
      );
      setStudent(updated);
      showNotification('Data Diri berhasil disimpan ke database!');
      setActiveFormTab('alamat');
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data diri');
    }
  };

  const handleSaveDataAlamat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await dbService.updateStudentDataAlamat(student.nik, {
        dukuh,
        rt,
        rw,
        provinsi,
        kabupaten,
        kecamatan,
        desa,
        kode_pos: kodePos,
        tinggal_bersama: tinggalBersama,
        transportasi,
      });
      setStudent(updated);
      showNotification('Data Alamat berhasil disimpan ke database!');
      setActiveFormTab('ortu');
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data alamat');
    }
  };

  const handleSaveDataOrangTua = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await dbService.updateStudentDataOrangTua(student.nik, {
        nik_ayah: nikAyah,
        nama_ayah: namaAyah,
        tempat_lahir_ayah: tempatLahirAyah,
        tanggal_lahir_ayah: tglLahirAyah,
        pendidikan_ayah: pendidikanAyah,
        pekerjaan_ayah: pekerjaanAyah,
        no_hp_ayah: noHpAyah,
        nik_ibu: nikIbu,
        nama_ibu: namaIbu,
        tempat_lahir_ibu: tempatLahirIbu,
        tanggal_lahir_ibu: tglLahirIbu,
        pendidikan_ibu: pendidikanIbu,
        pekerjaan_ibu: pekerjaanIbu,
        no_hp_ibu: noHpIbu,
        nik_wali: nikWali,
        nama_wali: namaWali,
        tempat_lahir_wali: tempatLahirWali,
        tanggal_lahir_wali: tglLahirWali,
        pendidikan_wali: pendidikanWali,
        pekerjaan_wali: pekerjaanWali,
        no_hp_wali: noHpWali,
      });
      setStudent(updated);
      showNotification('Data Orang Tua berhasil disimpan!');
      setActiveFormTab('berkas');
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data orang tua');
    }
  };

  const handleSaveDataBerkas = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const nowStr = new Date().toLocaleDateString('id-ID');
      const updated = await dbService.updateStudentDataBerkas(student.nik, {
        kartu_keluarga: berkasKK ? { nama_file: berkasKK, ukuran: '1.2 MB', uploaded_at: nowStr } : undefined,
        ijazah_skl: berkasSKL ? { nama_file: berkasSKL, ukuran: '900 KB', uploaded_at: nowStr } : undefined,
        akta_kelahiran: berkasAkta ? { nama_file: berkasAkta, ukuran: '850 KB', uploaded_at: nowStr } : undefined,
        kartu_kip: berkasKIP ? { nama_file: berkasKIP, ukuran: '750 KB', uploaded_at: nowStr } : undefined,
        pas_foto: berkasFoto ? { nama_file: berkasFoto, ukuran: '450 KB', uploaded_at: nowStr } : undefined,
      });
      setStudent(updated);
      showNotification('Berkas pendaftaran berhasil disimpan & diserahkan untuk verifikasi!');
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan berkas');
    }
  };

  const handlePrintFormulir = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      
      {/* Toast alert */}
      {saveToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-200">
          <Check className="w-4 h-4 bg-emerald-700 p-0.5 rounded-full" />
          <span>{saveToast}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row">
        
        {/* ========================================================================= */}
        {/* LEFT SIDEBAR (Exact Match to Screenshots 9, 10, 11, 12, 13) */}
        {/* ========================================================================= */}
        <aside className={`w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 ${
          mobileSidebarOpen ? 'block fixed inset-y-0 left-0 z-50 shadow-2xl' : 'hidden md:flex'
        }`}>
          <div>
            {/* Logo SPMB SMK MUHIBA */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black tracking-wider text-slate-800 uppercase">
                  SPMB SMK MUHIBA
                </h2>
                <p className="text-[10px] text-slate-400 font-medium tracking-tight">
                  Sistem Penerimaan Siswa Baru
                </p>
              </div>
              <button 
                onClick={() => setMobileSidebarOpen(false)}
                className="md:hidden text-slate-400 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu List */}
            <div className="py-4">
              <p className="px-5 text-[10px] font-extrabold text-slate-400 tracking-wider uppercase mb-2">
                MAIN MENU
              </p>
              <nav className="space-y-1 px-3">
                <button
                  onClick={() => {
                    setActiveMenu('beranda');
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    activeMenu === 'beranda'
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Home className="w-4 h-4 text-slate-400" />
                  <span>Beranda</span>
                </button>

                <button
                  onClick={() => {
                    setActiveMenu('formulir');
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    activeMenu === 'formulir'
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span>Formulir</span>
                </button>

                <button
                  onClick={() => {
                    setActiveMenu('pembayaran');
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    activeMenu === 'pembayaran'
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-slate-400" />
                  <span>Pembayaran</span>
                </button>

                <button
                  onClick={() => {
                    setActiveMenu('pengumuman');
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    activeMenu === 'pengumuman'
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Megaphone className="w-4 h-4 text-slate-400" />
                  <span>Pengumuman</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Bottom user / logout card */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2">
            <a
              href="https://www.smkmuhiba.sch.id"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-left text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center justify-between py-1.5 px-2 rounded hover:bg-blue-50 transition-colors"
            >
              <span>Web Sekolah</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={onNavigateHome}
              className="w-full text-left text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-100 transition-colors"
            >
              <span>← Beranda PPDB</span>
            </button>
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-between text-xs font-bold text-rose-600 hover:text-rose-700 p-2 rounded-lg hover:bg-rose-50 transition-colors"
            >
              <span>Keluar / Logout</span>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* MAIN CONTENT AREA */}
        {/* ========================================================================= */}
        <main className="flex-1 flex flex-col min-w-0">
          
          {/* Top Bar with User Badge */}
          <header className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden text-slate-500 hover:text-slate-800 p-1"
              >
                <Menu className="w-6 h-6" />
              </button>
              <span className="text-xs font-bold text-slate-400 tracking-wider hidden sm:inline">
                PANEL PENDAFTARAN SISWA BARU
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                {student.nama_lengkap?.charAt(0) || 'S'}
              </div>
              <div className="text-right">
                <span className="block text-xs font-bold text-slate-800">
                  {student.nama_lengkap}
                </span>
                <span className="block text-[10px] text-slate-400 font-mono">
                  No. {student.nomor_pendaftaran}
                </span>
              </div>
            </div>
          </header>

          <div className="p-4 sm:p-8 space-y-6">

            {/* ===================================================================== */}
            {/* VIEW 1: BERANDA (Screenshot 9) */}
            {/* ===================================================================== */}
            {activeMenu === 'beranda' && (
              <div className="space-y-6">
                
                {/* Header Welcome Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <span>Hai!, {student.nama_lengkap}</span>
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                      Silahkan Lengkapi Formulir Pendaftaran
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">Status Pendaftaran:</span>
                    <span className="px-3 py-1 bg-slate-800 text-white rounded-full text-xs font-bold tracking-wide">
                      {student.status_pendaftaran || 'Berkas Fisik'}
                    </span>
                  </div>
                </div>

                {/* 3 Status Cards (Screenshot 9) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  
                  {/* Card 1: Data Diri */}
                  <div 
                    onClick={() => {
                      setActiveMenu('formulir');
                      setActiveFormTab('diri');
                    }}
                    className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 flex items-center gap-4 cursor-pointer hover:border-blue-400 transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Data Diri</p>
                      <div className="mt-1">
                        {isDiriLengkap ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-500 px-2.5 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Lengkap
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-rose-500 px-2.5 py-0.5 rounded-full">
                            <X className="w-3 h-3" /> Belum Lengkap
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Data Alamat */}
                  <div 
                    onClick={() => {
                      setActiveMenu('formulir');
                      setActiveFormTab('alamat');
                    }}
                    className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 flex items-center gap-4 cursor-pointer hover:border-cyan-400 transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-cyan-500 text-white flex items-center justify-center shrink-0">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Data Alamat</p>
                      <div className="mt-1">
                        {isAlamatLengkap ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-500 px-2.5 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Lengkap
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-rose-500 px-2.5 py-0.5 rounded-full">
                            <X className="w-3 h-3" /> Belum Lengkap
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Data Orang Tua */}
                  <div 
                    onClick={() => {
                      setActiveMenu('formulir');
                      setActiveFormTab('ortu');
                    }}
                    className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 flex items-center gap-4 cursor-pointer hover:border-amber-400 transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Data Orang Tua</p>
                      <div className="mt-1">
                        {isOrtuLengkap ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-500 px-2.5 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Lengkap
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-rose-500 px-2.5 py-0.5 rounded-full">
                            <X className="w-3 h-3" /> Belum Lengkap
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Information Pendaftaran Card with Exact Colors from Screenshot 9 */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 sm:p-8 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Megaphone className="w-4 h-4" />
                    </div>
                    <div className="text-xs text-slate-400">
                      2026-02-02 10:40:54 • VIEW
                      <span className="block font-bold text-slate-800 text-sm">Informasi Pendaftaran</span>
                    </div>
                  </div>

                  {/* Red highlight banner */}
                  <div className="bg-red-600 text-white text-center py-3.5 px-4 rounded-md font-extrabold text-base sm:text-lg shadow">
                    Selamat Datang Calon Peserta Didik Baru di Sekolah Pencetak Wirausaha, Siap Kerja, Siap Kuliah
                  </div>

                  <div className="space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed font-semibold">
                    <p className="text-slate-900 font-bold mb-3">
                      Sebelum mendaftar silahkan dipersiapkan berkas sebagai berikut :
                    </p>
                    <p className="text-red-600">&gt; Foto copy Kartu Keluarga</p>
                    <p className="text-blue-600">&gt; Foto copy Akta Kelahiran</p>
                    <p className="text-rose-700 font-bold">&gt; Nomer NISN (bisa dilihat di rapot)</p>
                    <p className="text-emerald-600">&gt; Fotocopy ijasah SMP/MTs (bagi yang sudah ada) atau FC. Ijasah SD/MI (bagi yang belum keluar)</p>
                    <p className="text-green-600">&gt; Foto copy KTP orang tua</p>
                    <p className="text-purple-600">&gt; Kartu Bantuan seperti KIP, PKH (jika ada)</p>
                    <p className="text-pink-600">&gt; Prestasi/Piagam Penghargaan yang pernah diraih (jalur prestasi)</p>
                  </div>

                  {/* Yellow highlight note */}
                  <div className="bg-yellow-300 text-red-700 text-center py-2.5 px-4 rounded-md font-bold text-xs sm:text-sm">
                    Setelah itu silahkan lengkapi data formulir pendaftaran kamu
                  </div>

                  <div className="pt-2 flex justify-center">
                    <button
                      onClick={() => setActiveMenu('formulir')}
                      className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-md transition-colors"
                    >
                      Buka & Lengkapi Formulir Sekarang
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* ===================================================================== */}
            {/* VIEW 2: FORMULIR MULTI-STEP (Screenshots 10, 11, 12, 13) */}
            {/* ===================================================================== */}
            {activeMenu === 'formulir' && (
              <div className="space-y-6">

                {/* Orange Top Warning Banner (Screenshot 10) */}
                {showWarningBanner && (
                  <div className="bg-amber-500 text-white p-3.5 rounded-lg flex items-center justify-between text-xs font-semibold shadow-sm">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>Untuk mencetak formulir ada dimenu pembayaran setelah verifikasi.</span>
                    </div>
                    <button 
                      onClick={() => setShowWarningBanner(false)}
                      className="text-white/80 hover:text-white p-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Grid Container for Form & Progress Sidebar */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Form Details Card */}
                  <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 sm:p-8 space-y-6">
                    
                    {/* Top User Summary & Tab Selector */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                          <User className="w-8 h-8" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase block">Status Pendaftaran</span>
                          <span className="inline-block mt-0.5 px-3 py-0.5 bg-blue-500 text-white rounded text-[11px] font-bold">
                            {student.status_pendaftaran || 'Berkas Fisik'}
                          </span>
                        </div>
                      </div>

                      {/* 4 Form Tabs */}
                      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
                        <button
                          onClick={() => setActiveFormTab('diri')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 ${
                            activeFormTab === 'diri'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>Data Diri</span>
                        </button>

                        <button
                          onClick={() => setActiveFormTab('alamat')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 ${
                            activeFormTab === 'alamat'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Data Alamat</span>
                        </button>

                        <button
                          onClick={() => setActiveFormTab('ortu')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 ${
                            activeFormTab === 'ortu'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Orang Tua</span>
                        </button>

                        <button
                          onClick={() => setActiveFormTab('berkas')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 ${
                            activeFormTab === 'berkas'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <FolderCheck className="w-3.5 h-3.5" />
                          <span>Data Berkas</span>
                        </button>
                      </div>
                    </div>

                    {/* ------------------------------------------------------------- */}
                    {/* SUB-TAB 1: DATA DIRI (Screenshot 10) */}
                    {/* ------------------------------------------------------------- */}
                    {activeFormTab === 'diri' && (
                      <form onSubmit={handleSaveDataDiri} className="space-y-6">
                        
                        {/* Upper Meta Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">No Pendaftaran</label>
                            <input
                              type="text"
                              disabled
                              value={student.nomor_pendaftaran}
                              className="w-full px-3 py-2 text-xs bg-slate-200 border border-slate-300 rounded text-slate-700 font-mono font-bold cursor-not-allowed"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Tgl Pendaftaran</label>
                            <input
                              type="text"
                              disabled
                              value={student.tanggal_daftar}
                              className="w-full px-3 py-2 text-xs bg-slate-200 border border-slate-300 rounded text-slate-700 cursor-not-allowed"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Jurusan Dipilih</label>
                            <select
                              value={jurusan}
                              onChange={(e) => setJurusan(e.target.value as JurusanType)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded font-semibold text-blue-700"
                            >
                              <option value="TO">TEKNIK OTOMOTIF (TO)</option>
                              <option value="TJKT">TEKNIK JARINGAN KOMPUTER & TELEKOMUNIKASI (TJKT)</option>
                              <option value="AKL">AKUNTANSI DAN KEUANGAN LEMBAGA (AKL)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Ukuran Baju</label>
                            <select
                              value={ukuranBaju}
                              onChange={(e) => setUkuranBaju(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded font-semibold"
                            >
                              <option value="S">Ukuran S</option>
                              <option value="M">Ukuran M</option>
                              <option value="L">Ukuran L</option>
                              <option value="XL">Ukuran XL</option>
                              <option value="XXL">Ukuran XXL</option>
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">KODE REFERAL</label>
                            <input
                              type="text"
                              value={kodeReferal}
                              onChange={(e) => setKodeReferal(e.target.value)}
                              placeholder="DIISI NAMA / KELAS"
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Diisi Apabila ada Referensi dari Kakak Kelas</p>
                          </div>
                        </div>

                        {/* Section Header */}
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4 pb-2 border-b">
                            <User className="w-4 h-4 text-blue-600" />
                            <span>Data Diri Siswa</span>
                          </h3>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">NISN</label>
                              <input
                                type="text"
                                value={nisn}
                                onChange={(e) => setNisn(e.target.value)}
                                placeholder="8729209999"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">NIK</label>
                              <input
                                type="text"
                                disabled
                                value={student.nik}
                                className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-300 rounded font-mono"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">No KK</label>
                              <input
                                type="text"
                                value={noKk}
                                onChange={(e) => setNoKk(e.target.value)}
                                placeholder="Nomor Kartu Keluarga"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap</label>
                              <input
                                type="text"
                                value={namaLengkap}
                                onChange={(e) => setNamaLengkap(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded font-semibold"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Tempat Lahir</label>
                              <input
                                type="text"
                                value={tempatLahir}
                                onChange={(e) => setTempatLahir(e.target.value)}
                                placeholder="Kota / Kabupaten Lahir"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Tgl Lahir</label>
                              <input
                                type="date"
                                value={tglLahir}
                                onChange={(e) => setTglLahir(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Jenis Kelamin</label>
                              <select
                                value={jenisKelamin}
                                onChange={(e) => setJenisKelamin(e.target.value as 'Laki-laki' | 'Perempuan')}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              >
                                <option value="Laki-laki">Laki-laki</option>
                                <option value="Perempuan">Perempuan</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Agama</label>
                              <select
                                value={agama}
                                onChange={(e) => setAgama(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              >
                                <option value="Islam">Islam</option>
                                <option value="Kristen">Kristen</option>
                                <option value="Katolik">Katolik</option>
                                <option value="Hindu">Hindu</option>
                                <option value="Buddha">Buddha</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">No Handphone (WA)</label>
                              <input
                                type="text"
                                value={noHp}
                                onChange={(e) => setNoHp(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Asal Sekolah</label>
                              <input
                                type="text"
                                value={asalSekolah}
                                onChange={(e) => setAsalSekolah(e.target.value)}
                                placeholder="SMP NEGERI 1 PLANTUNGAN"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Anak Ke</label>
                              <input
                                type="number"
                                value={anakKe}
                                onChange={(e) => setAnakKe(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Jumlah Saudara</label>
                              <input
                                type="number"
                                value={jumlahSaudara}
                                onChange={(e) => setJumlahSaudara(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>

                            <div className="sm:col-span-2 flex items-center gap-2 py-1">
                              <input
                                type="checkbox"
                                id="anak_guru"
                                checked={isAnakGuru}
                                onChange={(e) => setIsAnakGuru(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                              />
                              <label htmlFor="anak_guru" className="text-xs text-slate-700 font-medium cursor-pointer">
                                Ceklis jika kamu Anak Guru disekolah ini
                              </label>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Tinggi Badan (Cm)</label>
                              <input
                                type="number"
                                value={tinggiBadan}
                                onChange={(e) => setTinggiBadan(e.target.value)}
                                placeholder="Cm"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Berat Badan (Kg)</label>
                              <input
                                type="number"
                                value={beratBadan}
                                onChange={(e) => setBeratBadan(e.target.value)}
                                placeholder="Kg"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Program Bantuan Pemerintah */}
                        <div className="pt-4 border-t">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                            Program Bantuan Pemerintah
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-slate-600 mb-1 font-medium">KIP</label>
                              <input
                                type="text"
                                value={kip}
                                onChange={(e) => setKip(e.target.value)}
                                placeholder="NOMOR KARTU KIP"
                                className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1 font-medium">PKH</label>
                              <input
                                type="text"
                                value={pkh}
                                onChange={(e) => setPkh(e.target.value)}
                                placeholder="NOMOR KARTU PKH"
                                className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1 font-medium">KKS</label>
                              <input
                                type="text"
                                value={kks}
                                onChange={(e) => setKks(e.target.value)}
                                placeholder="NOMOR KARTU KKS"
                                className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1 font-medium">KIS</label>
                              <input
                                type="text"
                                value={kis}
                                onChange={(e) => setKis(e.target.value)}
                                placeholder="NOMOR KARTU KIS"
                                className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                              />
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 italic mt-3">
                            *Harap isi data dengan sebenar-benarnya
                          </p>
                        </div>

                        <div className="pt-3">
                          <button
                            type="submit"
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-sm transition-colors flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            <span>Simpan Data Diri</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {/* ------------------------------------------------------------- */}
                    {/* SUB-TAB 2: DATA ALAMAT (Screenshot 11) */}
                    {/* ------------------------------------------------------------- */}
                    {activeFormTab === 'alamat' && (
                      <form onSubmit={handleSaveDataAlamat} className="space-y-5">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b">
                          <MapPin className="w-4 h-4 text-cyan-600" />
                          <span>Data Alamat Siswa</span>
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Dukuh / Jalan</label>
                            <input
                              type="text"
                              value={dukuh}
                              onChange={(e) => setDukuh(e.target.value)}
                              placeholder="Nama Dukuh / Jalan"
                              className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">RT</label>
                              <input
                                type="text"
                                value={rt}
                                onChange={(e) => setRt(e.target.value)}
                                placeholder="01"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">RW</label>
                              <input
                                type="text"
                                value={rw}
                                onChange={(e) => setRw(e.target.value)}
                                placeholder="02"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Provinsi</label>
                              <input
                                type="text"
                                value={provinsi}
                                onChange={(e) => setProvinsi(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Kabupaten / Kota</label>
                              <input
                                type="text"
                                value={kabupaten}
                                onChange={(e) => setKabupaten(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Kecamatan</label>
                              <input
                                type="text"
                                value={kecamatan}
                                onChange={(e) => setKecamatan(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Desa / Kelurahan</label>
                              <input
                                type="text"
                                value={desa}
                                onChange={(e) => setDesa(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Kode Pos</label>
                            <input
                              type="text"
                              value={kodePos}
                              onChange={(e) => setKodePos(e.target.value)}
                              placeholder="51274"
                              className="w-full sm:w-1/2 px-3 py-2 text-xs border border-slate-300 rounded"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Tinggal Bersama</label>
                              <select
                                value={tinggalBersama}
                                onChange={(e) => setTinggalBersama(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              >
                                <option value="Orang Tua">Orang Tua</option>
                                <option value="Wali">Wali</option>
                                <option value="Kost / Asrama">Kost / Asrama</option>
                                <option value="Pondok Pesantren">Pondok Pesantren</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Transportasi</label>
                              <select
                                value={transportasi}
                                onChange={(e) => setTransportasi(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              >
                                <option value="Sepeda Motor">Sepeda Motor</option>
                                <option value="Sepeda">Sepeda</option>
                                <option value="Angkutan Umum">Angkutan Umum</option>
                                <option value="Jalan Kaki">Jalan Kaki</option>
                                <option value="Antar Jemput">Antar Jemput</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 italic">
                          *Harap isi data alamat dengan sebenar-benarnya
                        </p>

                        <div className="pt-2">
                          <button
                            type="submit"
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-sm transition-colors flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            <span>Simpan Data Alamat</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {/* ------------------------------------------------------------- */}
                    {/* SUB-TAB 3: DATA ORANG TUA (Screenshot 12) */}
                    {/* ------------------------------------------------------------- */}
                    {activeFormTab === 'ortu' && (
                      <form onSubmit={handleSaveDataOrangTua} className="space-y-6">
                        
                        {/* Section Data Ayah */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                            <span>Data Lengkap Ayah</span>
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-slate-600 mb-1">NIK Ayah</label>
                              <input
                                type="text"
                                value={nikAyah}
                                onChange={(e) => setNikAyah(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1">Nama Ayah</label>
                              <input
                                type="text"
                                value={namaAyah}
                                onChange={(e) => setNamaAyah(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1">Tempat Lahir</label>
                              <input
                                type="text"
                                value={tempatLahirAyah}
                                onChange={(e) => setTempatLahirAyah(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1">Tanggal Lahir</label>
                              <input
                                type="date"
                                value={tglLahirAyah}
                                onChange={(e) => setTglLahirAyah(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1">Pendidikan</label>
                              <select
                                value={pendidikanAyah}
                                onChange={(e) => setPendidikanAyah(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded"
                              >
                                <option value="SD / MI">SD / MI</option>
                                <option value="SMP / MTs">SMP / MTs</option>
                                <option value="SMA / SMK">SMA / SMK</option>
                                <option value="D3 / Sarjana">D3 / Sarjana</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1">Pekerjaan</label>
                              <input
                                type="text"
                                value={pekerjaanAyah}
                                onChange={(e) => setPekerjaanAyah(e.target.value)}
                                placeholder="Petani / Wiraswasta / Karyawan"
                                className="w-full px-3 py-2 border border-slate-300 rounded"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-slate-600 mb-1">No HP Ayah</label>
                              <input
                                type="text"
                                value={noHpAyah}
                                onChange={(e) => setNoHpAyah(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Section Data Ibu */}
                        <div className="space-y-3 pt-3 border-t">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b">
                            <User className="w-3.5 h-3.5 text-rose-600" />
                            <span>Data Lengkap Ibu</span>
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-slate-600 mb-1">NIK Ibu</label>
                              <input
                                type="text"
                                value={nikIbu}
                                onChange={(e) => setNikIbu(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1">Nama Ibu</label>
                              <input
                                type="text"
                                value={namaIbu}
                                onChange={(e) => setNamaIbu(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1">Tempat Lahir</label>
                              <input
                                type="text"
                                value={tempatLahirIbu}
                                onChange={(e) => setTempatLahirIbu(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1">Tanggal Lahir</label>
                              <input
                                type="date"
                                value={tglLahirIbu}
                                onChange={(e) => setTglLahirIbu(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1">Pendidikan</label>
                              <select
                                value={pendidikanIbu}
                                onChange={(e) => setPendidikanIbu(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded"
                              >
                                <option value="SD / MI">SD / MI</option>
                                <option value="SMP / MTs">SMP / MTs</option>
                                <option value="SMA / SMK">SMA / SMK</option>
                                <option value="D3 / Sarjana">D3 / Sarjana</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1">Pekerjaan</label>
                              <input
                                type="text"
                                value={pekerjaanIbu}
                                onChange={(e) => setPekerjaanIbu(e.target.value)}
                                placeholder="Ibu Rumah Tangga / Pedagang"
                                className="w-full px-3 py-2 border border-slate-300 rounded"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-slate-600 mb-1">No HP Ibu</label>
                              <input
                                type="text"
                                value={noHpIbu}
                                onChange={(e) => setNoHpIbu(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Section Data Wali (Opsional) */}
                        <div className="space-y-3 pt-3 border-t">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b">
                            <User className="w-3.5 h-3.5 text-purple-600" />
                            <span>Data Lengkap Wali (Opsional)</span>
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-slate-600 mb-1">Nama Wali</label>
                              <input
                                type="text"
                                value={namaWali}
                                onChange={(e) => setNamaWali(e.target.value)}
                                placeholder="Nama Wali (jika tidak ikut orang tua)"
                                className="w-full px-3 py-2 border border-slate-300 rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1">Pekerjaan Wali</label>
                              <input
                                type="text"
                                value={pekerjaanWali}
                                onChange={(e) => setPekerjaanWali(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded"
                              />
                            </div>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 italic">
                          *Harap isi data orang tua dengan sebenar-benarnya
                        </p>

                        <div className="pt-2">
                          <button
                            type="submit"
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-sm transition-colors flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            <span>Simpan Data Orang Tua</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {/* ------------------------------------------------------------- */}
                    {/* SUB-TAB 4: DATA BERKAS (Screenshot 13) */}
                    {/* ------------------------------------------------------------- */}
                    {activeFormTab === 'berkas' && (
                      <form onSubmit={handleSaveDataBerkas} className="space-y-5">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b">
                          <FolderCheck className="w-4 h-4 text-blue-600" />
                          <span>Upload Data Berkas</span>
                        </h3>

                        <div className="space-y-4 text-xs">
                          {/* 1. Kartu Keluarga */}
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="block font-bold text-slate-800 mb-1">Kartu Keluarga</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) setBerkasKK(e.target.files[0].name);
                                }}
                                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                              />
                            </div>
                            {berkasKK && <p className="text-[11px] text-emerald-600 font-semibold mt-1">✓ File: {berkasKK}</p>}
                            <p className="text-[10px] text-slate-400 mt-0.5">Upload yang diperbolehkan ukuran maksimun 2Mb (PDF/JPG/PNG)</p>
                          </div>

                          {/* 2. Ijazah / SKL */}
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="block font-bold text-slate-800 mb-1">Ijazah / SKL</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) setBerkasSKL(e.target.files[0].name);
                                }}
                                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                              />
                            </div>
                            {berkasSKL && <p className="text-[11px] text-emerald-600 font-semibold mt-1">✓ File: {berkasSKL}</p>}
                            <p className="text-[10px] text-slate-400 mt-0.5">Upload yang diperbolehkan ukuran maksimun 2Mb</p>
                          </div>

                          {/* 3. Akta Kelahiran */}
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="block font-bold text-slate-800 mb-1">Akta Lahir</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) setBerkasAkta(e.target.files[0].name);
                                }}
                                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                              />
                            </div>
                            {berkasAkta && <p className="text-[11px] text-emerald-600 font-semibold mt-1">✓ File: {berkasAkta}</p>}
                            <p className="text-[10px] text-slate-400 mt-0.5">Upload yang diperbolehkan ukuran maksimun 2Mb</p>
                          </div>

                          {/* 4. Kartu KIP (jika punya) */}
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="block font-bold text-slate-800 mb-1">Kartu KIP (jika punya)</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) setBerkasKIP(e.target.files[0].name);
                                }}
                                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                              />
                            </div>
                            {berkasKIP && <p className="text-[11px] text-emerald-600 font-semibold mt-1">✓ File: {berkasKIP}</p>}
                            <p className="text-[10px] text-slate-400 mt-0.5">Upload yang diperbolehkan ukuran maksimun 2Mb</p>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 italic">
                          *Harap isi data berkas dengan sebenarnya
                        </p>

                        <div className="pt-2">
                          <button
                            type="submit"
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-sm transition-colors flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            <span>Simpan Data Berkas</span>
                          </button>
                        </div>
                      </form>
                    )}

                  </div>

                  {/* Right Column: Progres Pengisian Formulir Sidebar (Exact match to Screenshots 10-13) */}
                  <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 space-y-6">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Progres Pengisian Formulir
                    </h3>

                    <div className="space-y-4">
                      {/* Step 1: Data Diri */}
                      <div 
                        onClick={() => setActiveFormTab('diri')}
                        className={`p-3.5 rounded-xl border flex items-center gap-3.5 cursor-pointer transition-all ${
                          activeFormTab === 'diri' ? 'border-blue-500 bg-blue-50/40 shadow-sm' : 'border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center shrink-0 text-sm">
                          1
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-900">Data Diri</p>
                          <div className="mt-0.5">
                            {isDiriLengkap ? (
                              <span className="text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" /> Lengkap
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-white bg-rose-500 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <X className="w-2.5 h-2.5" /> Belum Lengkap
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Data Alamat */}
                      <div 
                        onClick={() => setActiveFormTab('alamat')}
                        className={`p-3.5 rounded-xl border flex items-center gap-3.5 cursor-pointer transition-all ${
                          activeFormTab === 'alamat' ? 'border-blue-500 bg-blue-50/40 shadow-sm' : 'border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center shrink-0 text-sm">
                          2
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-900">Data Alamat</p>
                          <div className="mt-0.5">
                            {isAlamatLengkap ? (
                              <span className="text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" /> Lengkap
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-white bg-rose-500 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <X className="w-2.5 h-2.5" /> Belum Lengkap
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Step 3: Data Orang Tua */}
                      <div 
                        onClick={() => setActiveFormTab('ortu')}
                        className={`p-3.5 rounded-xl border flex items-center gap-3.5 cursor-pointer transition-all ${
                          activeFormTab === 'ortu' ? 'border-blue-500 bg-blue-50/40 shadow-sm' : 'border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center shrink-0 text-sm">
                          3
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-900">Data Orang</p>
                          <div className="mt-0.5">
                            {isOrtuLengkap ? (
                              <span className="text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" /> Lengkap
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-white bg-rose-500 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <X className="w-2.5 h-2.5" /> Belum Lengkap
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-2">
                      <p className="font-bold text-slate-800">Petunjuk Panitia:</p>
                      <p className="text-[11px] leading-relaxed">
                        Setelah semua data terisi lengkap, status pendaftaran akan diproses oleh verifikator SMK Muhammadiyah Bawang.
                      </p>
                    </div>

                  </div>

                </div>

              </div>
            )}

            {/* ===================================================================== */}
            {/* VIEW 3: PEMBAYARAN */}
            {/* ===================================================================== */}
            {activeMenu === 'pembayaran' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Rincian Pembayaran & Cetak Formulir</h2>
                    <p className="text-xs text-slate-500">Informasi administrasi pendaftaran siswa baru SMK Muhammadiyah Bawang</p>
                  </div>
                  <button
                    onClick={handlePrintFormulir}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Formulir Lengkap</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <p className="text-xs text-emerald-800 font-semibold">Biaya Pendaftaran / Formulir</p>
                    <p className="text-2xl font-black text-emerald-700 mt-1">GRATIS (Rp 0,-)</p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">Program Bebas Biaya Gelombang 1 Sekolah SMART</p>
                  </div>

                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <p className="text-xs text-blue-800 font-semibold">Biaya Seragam & Atribut Sekolah</p>
                    <p className="text-2xl font-black text-blue-700 mt-1">Rp 350.000,-</p>
                    <p className="text-[11px] text-blue-600 mt-0.5">3 Stel Seragam Praktik, Pramuka, Hizbul Wathan & Jas</p>
                  </div>
                </div>

                {/* Printable Official Receipt preview */}
                <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Status Pembayaran Siswa
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-200/70 text-slate-700 font-bold">
                        <tr>
                          <th className="px-4 py-2 text-left">Keterangan</th>
                          <th className="px-4 py-2 text-left">Metode</th>
                          <th className="px-4 py-2 text-right">Nominal</th>
                          <th className="px-4 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        <tr>
                          <td className="px-4 py-3 font-medium">Biaya Seragam & Administrasi PPDB</td>
                          <td className="px-4 py-3">Loket SMK Muhiba / Bank Jateng</td>
                          <td className="px-4 py-3 text-right font-mono font-bold">Rp 350.000</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                              Lunas / Bebas Formulir
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ===================================================================== */}
            {/* VIEW 4: PENGUMUMAN */}
            {/* ===================================================================== */}
            {activeMenu === 'pengumuman' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 sm:p-8 space-y-6">
                <div className="pb-4 border-b">
                  <h2 className="text-base font-bold text-slate-900">Pengumuman Hasil Seleksi</h2>
                  <p className="text-xs text-slate-500">Status kelulusan penerimaan peserta didik baru tahun ajaran 2026/2027</p>
                </div>

                <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-center space-y-3 max-w-xl mx-auto">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">
                    SELAMAT! ANDA DINYATAKAN DITERIMA
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Peserta Didik atas nama <strong>{student.nama_lengkap}</strong> dengan nomor pendaftaran <strong>{student.nomor_pendaftaran}</strong> resmi diterima di kompetensi keahlian:
                  </p>
                  <div className="inline-block px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold shadow-sm">
                    {student.jurusan_pilihan === 'TO' && 'TEKNIK OTOMOTIF (TO)'}
                    {student.jurusan_pilihan === 'TJKT' && 'TEKNIK JARINGAN KOMPUTER & TELEKOMUNIKASI (TJKT)'}
                    {student.jurusan_pilihan === 'AKL' && 'AKUNTANSI DAN KEUANGAN LEMBAGA (AKL)'}
                  </div>
                  <p className="text-[11px] text-slate-500 pt-2">
                    Silakan ikuti instruksi panitia untuk pengambilan seragam dan masa orientasi (MPLS).
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Footer inside Dashboard matching screenshot */}
          <footer className="mt-auto px-4 sm:px-8 py-4 border-t border-slate-200 bg-white text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Copyright © 2026 SPMB SMK MUHIBA | GARUDANET by @hndx07</span>
            <a
              href="https://www.smkmuhiba.sch.id"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Website Resmi: www.smkmuhiba.sch.id
            </a>
          </footer>

        </main>
      </div>

    </div>
  );
};
