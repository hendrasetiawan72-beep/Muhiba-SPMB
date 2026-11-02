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
  ExternalLink,
  Lock,
  Download,
  Copy,
  ArrowRight,
  FileCheck2,
  KeyRound,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Student, User as UserType, JurusanType } from '../types/database';
import { dbService } from '../services/supabase';
import { credentialStore } from '../services/credentialStore';
import { Hero, Stagger, StatCard, StatusTile, PanelTitle, SegTabs, ProgressRing, BottomNav, Sheet, ViewTransition, LOGO_URL } from './ui/kit';
import { useHistorySync } from './ui/navigation';
const ChangePasswordModal = React.lazy(() =>
  import('./ChangePasswordModal').then((m) => ({ default: m.ChangePasswordModal }))
);

const DOCS: { title: string; badge: string; tone: 'wajib' | 'amber'; desc: string }[] = [
  {
    "title": "Foto copy Kartu Keluarga",
    "badge": "Wajib",
    "tone": "wajib",
    "desc": "Salinan Kartu Keluarga (KK) terbaru calon siswa"
  },
  {
    "title": "Foto copy Akta Kelahiran",
    "badge": "Wajib",
    "tone": "wajib",
    "desc": "Akta kelahiran resmi dari Disdukcapil"
  },
  {
    "title": "Nomor NISN",
    "badge": "Wajib",
    "tone": "wajib",
    "desc": "Dapat dilihat pada rapor sekolah asal atau surat keterangan"
  },
  {
    "title": "Fotocopy Ijazah SMP/MTs atau SD/MI",
    "badge": "Wajib",
    "tone": "wajib",
    "desc": "Bagi yang ijazah SMP belum terbit, dapat menggunakan FC Ijazah SD"
  },
  {
    "title": "Foto copy KTP Orang Tua / Wali",
    "badge": "Wajib",
    "tone": "wajib",
    "desc": "Kartu identitas ayah/ibu atau wali murid yang sah"
  },
  {
    "title": "Kartu Bantuan (KIP, PKH, KKS)",
    "badge": "Jika Ada",
    "tone": "amber",
    "desc": "Program jaminan sosial dari pemerintah (opsional jika memiliki)"
  },
  {
    "title": "Prestasi / Piagam Penghargaan",
    "badge": "Jalur Prestasi",
    "tone": "amber",
    "desc": "Sertifikat piagam kejuaraan akademik maupun non-akademik tingkat kecamatan/kabupaten/provinsi"
  }
];

interface StudentDashboardProps {
  currentUser: UserType;
  initialStudent: Student;
  onLogout: () => void;
  onNavigateHome: () => void;
  onRequestChangePassword?: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentUser,
  initialStudent,
  onLogout,
  onNavigateHome,
  onRequestChangePassword,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [student, setStudent] = useState<Student>(initialStudent);
  const [activeMenu, setActiveMenu] = useState<'beranda' | 'formulir' | 'pembayaran' | 'pengumuman'>('beranda');
  const [activeFormTab, setActiveFormTab] = useState<'diri' | 'alamat' | 'ortu' | 'berkas'>('diri');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showWarningBanner, setShowWarningBanner] = useState(true);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [showLocalChangePassword, setShowLocalChangePassword] = useState(false);
  // UI saja: panel "Persiapan berkas" di Beranda (terbuka di layar lebar, tertutup di ponsel)
  const [showDocs, setShowDocs] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth >= 768);

  // Geser/tombol kembali: menu & tab formulir ikut tersimpan di riwayat browser
  useHistorySync(
    'sd',
    { menu: activeMenu, tab: activeFormTab },
    (v: { menu: 'beranda' | 'formulir' | 'pembayaran' | 'pengumuman'; tab: 'diri' | 'alamat' | 'ortu' | 'berkas' }) => {
      setActiveMenu(v.menu);
      setActiveFormTab(v.tab);
    }
  );

  useEffect(() => {
    let isMounted = true;
    const fetchFreshStudent = async () => {
      try {
        const fresh =
          (await dbService.getStudentByUserId(currentUser.id)) ||
          (await dbService.getStudentByNik(student.nik));
        if (fresh && isMounted) {
          setStudent(fresh);
        }
      } catch (err) {
        console.warn('Student sync notice:', err);
      }
    };
    fetchFreshStudent();
    return () => {
      isMounted = false;
    };
  }, [currentUser.id, student.nik]);

  const [jurusan, setJurusan] = useState<JurusanType>(student.jurusan_pilihan || 'TO');
  const [ukuranBaju, setUkuranBaju] = useState(student.data_diri?.ukuran_baju || 'L');
  const [kodeReferal, setKodeReferal] = useState(student.data_diri?.kode_referal || '');
  const [nisn, setNisn] = useState(student.data_diri?.nisn || '');
  const [noKk, setNoKk] = useState(student.data_diri?.no_kk || '');
  const [namaLengkap, setNamaLengkap] = useState(student.nama_lengkap || '');
  const [tempatLahir, setTempatLahir] = useState(student.data_diri?.tempat_lahir || '');
  const [tglLahir, setTglLahir] = useState(student.data_diri?.tanggal_lahir || '');
  const [jenisKelamin, setJenisKelamin] = useState<string>(student.data_diri?.jenis_kelamin || '');
  const [agama, setAgama] = useState(student.data_diri?.agama || '');
  const [noHp, setNoHp] = useState(student.data_diri?.no_hp || student.no_wa || '');
  const [asalSekolah, setAsalSekolah] = useState(student.data_diri?.asal_sekolah || '');
  const [anakKe, setAnakKe] = useState(student.data_diri?.anak_ke !== undefined ? String(student.data_diri.anak_ke) : '');
  const [jumlahSaudara, setJumlahSaudara] = useState(student.data_diri?.jumlah_saudara !== undefined ? String(student.data_diri.jumlah_saudara) : '');
  const [isAnakGuru, setIsAnakGuru] = useState(student.data_diri?.is_anak_guru || false);
  const [tinggiBadan, setTinggiBadan] = useState(student.data_diri?.tinggi_badan?.toString() || '');
  const [beratBadan, setBeratBadan] = useState(student.data_diri?.berat_badan?.toString() || '');
  const [statusDalamKeluarga, setStatusDalamKeluarga] = useState(student.data_diri?.status_dalam_keluarga || 'Anak Kandung');
  const [kip, setKip] = useState(student.data_diri?.kip || '');
  const [pkh, setPkh] = useState(student.data_diri?.pkh || '');
  const [kks, setKks] = useState(student.data_diri?.kks || '');
  const [kis, setKis] = useState(student.data_diri?.kis || '');

  // Kolom Alamat Dikosongkan Default Tanpa Isi Bawaan
  const [dukuh, setDukuh] = useState(student.data_alamat?.dukuh || '');
  const [rt, setRt] = useState(student.data_alamat?.rt || '');
  const [rw, setRw] = useState(student.data_alamat?.rw || '');
  const [provinsi, setProvinsi] = useState(student.data_alamat?.provinsi || '');
  const [kabupaten, setKabupaten] = useState(student.data_alamat?.kabupaten || '');
  const [kecamatan, setKecamatan] = useState(student.data_alamat?.kecamatan || '');
  const [desa, setDesa] = useState(student.data_alamat?.desa || '');
  const [kodePos, setKodePos] = useState(student.data_alamat?.kode_pos || '');
  const [tinggalBersama, setTinggalBersama] = useState(student.data_alamat?.tinggal_bersama || 'Orang Tua');
  const [transportasi, setTransportasi] = useState(student.data_alamat?.transportasi || 'Sepeda Motor');

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

  const [berkasKK, setBerkasKK] = useState<string>(student.data_berkas?.kartu_keluarga?.nama_file || '');
  const [berkasSKL, setBerkasSKL] = useState<string>(student.data_berkas?.ijazah_skl?.nama_file || '');
  const [berkasAkta, setBerkasAkta] = useState<string>(student.data_berkas?.akta_kelahiran?.nama_file || '');
  const [berkasKIP, setBerkasKIP] = useState<string>(student.data_berkas?.kartu_kip?.nama_file || '');
  const [berkasFoto, setBerkasFoto] = useState<string>(student.data_berkas?.pas_foto?.nama_file || '');
  const [isUploadingBerkas, setIsUploadingBerkas] = useState(false);

  const [newCredentials, setNewCredentials] = useState<{
    nik: string;
    password: string;
    nama: string;
    nomor_pendaftaran: string;
    tanggal_daftar?: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null);

  useEffect(() => {
    try {
      const stored = credentialStore.get();
      if (stored && stored.nik && stored.password) {
        setNewCredentials(stored);
      }
    } catch (e) {
      console.warn('Error reading credentialStore:', e);
    }
  }, []);

  const handleCloseCredentialsWarning = () => {
    credentialStore.clear();
    setNewCredentials(null);
  };

  const handleCopyText = (text: string, type: 'username' | 'password') => {
    navigator.clipboard.writeText(text);
    setCopiedField(type);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownloadCredentialsPDF = async () => {
    if (!newCredentials) return;
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('SPMB SMK MUHAMMADIYAH BAWANG', 105, 18, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Bukti Akun & Kredensial Login Calon Peserta Didik Baru 2026/2027', 105, 27, { align: 'center' });
      doc.text('Website Resmi: www.smkmuhiba.sch.id', 105, 34, { align: 'center' });

      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, 50, 180, 85, 4, 4, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('DATA AKUN LOGIN SISWA', 25, 62);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Nama Lengkap', 25, 73);
      doc.text(':', 68, 73);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(newCredentials.nama || student.nama_lengkap, 73, 73);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('No. Pendaftaran', 25, 83);
      doc.text(':', 68, 83);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text(newCredentials.nomor_pendaftaran || student.nomor_pendaftaran, 73, 83);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Username (NIK)', 25, 95);
      doc.text(':', 68, 95);
      doc.setFont('courier', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(185, 28, 28);
      doc.text(newCredentials.nik, 73, 95);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text('Password', 25, 107);
      doc.text(':', 68, 107);
      doc.setFont('courier', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(newCredentials.password, 73, 107);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text('Tanggal Daftar', 25, 119);
      doc.text(':', 68, 119);
      doc.setTextColor(15, 23, 42);
      doc.text(newCredentials.tanggal_daftar || student.tanggal_daftar, 73, 119);

      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(15, 145, 180, 42, 3, 3, 'FD');
      doc.setTextColor(146, 64, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('PENTING / PERHATIAN:', 22, 155);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(120, 53, 15);
      doc.text('1. Username untuk login siswa adalah 16 digit NIK yang Anda daftarkan.', 22, 163);
      doc.text('2. Simpan dokumen PDF ini atau catat Username & Password Anda di tempat yang aman.', 22, 171);
      doc.text('3. Gunakan akun ini untuk melengkapi formulir bertahap & melihat pengumuman kelulusan.', 22, 179);
      
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Dicetak otomatis oleh Sistem SPMB SMK Muhammadiyah Bawang | by @hndx07', 105, 280, { align: 'center' });
      doc.save(`AKUN_SPMB_MUHIBA_${newCredentials.nik}.pdf`);
    } catch (pdfErr) {
      console.error('Error generating PDF:', pdfErr);
      alert('Gagal mengunduh PDF. Silakan catat Username & Password Anda.');
    }
  };

  const isDiriLengkap = Boolean(
    (student.nama_lengkap || namaLengkap) && 
    (student.data_diri?.tempat_lahir || tempatLahir) &&
    (student.data_diri?.tanggal_lahir || tglLahir) &&
    (student.data_diri?.jenis_kelamin || jenisKelamin) &&
    (student.data_diri?.agama || agama) &&
    (student.data_diri?.asal_sekolah || asalSekolah) &&
    (student.data_diri?.no_hp || student.no_wa || noHp)
  );

  const isAlamatLengkap = Boolean(
    (student.data_alamat?.dukuh || dukuh) &&
    (student.data_alamat?.desa || desa) &&
    (student.data_alamat?.kecamatan || kecamatan) &&
    (student.data_alamat?.kabupaten || kabupaten) &&
    (student.data_alamat?.provinsi || provinsi)
  );

  const hasAyah = Boolean(
    (student.data_orang_tua?.nama_ayah || namaAyah) && 
    (student.data_orang_tua?.nik_ayah || nikAyah)
  );
  const hasIbu = Boolean(
    (student.data_orang_tua?.nama_ibu || namaIbu) && 
    (student.data_orang_tua?.nik_ibu || nikIbu)
  );
  const isOrtuLengkap = Boolean(hasAyah || hasIbu);

  const hasKK = Boolean(student.data_berkas?.kartu_keluarga?.path || berkasKK);
  const hasSKL = Boolean(student.data_berkas?.ijazah_skl?.path || berkasSKL);
  const hasAkta = Boolean(student.data_berkas?.akta_kelahiran?.path || berkasAkta);
  const hasFoto = Boolean(student.data_berkas?.pas_foto?.path || berkasFoto);
  const isBerkasLengkap = Boolean(hasKK && hasSKL && hasAkta && hasFoto);

  const isSemuaFormLengkap = Boolean(
    isDiriLengkap && isAlamatLengkap && isOrtuLengkap && isBerkasLengkap
  );

  useEffect(() => {
    if (!student?.id) return;
    const currentStatus = student.status_pendaftaran;
    if (
      isSemuaFormLengkap &&
      (!currentStatus || currentStatus === 'Belum Lengkap' || currentStatus === 'Berkas Fisik')
    ) {
      dbService.submitStudentRegistration(student.id)
        .then((updated) => {
          setStudent(updated);
          showNotification('Semua data dan berkas lengkap. Status pendaftaran otomatis menjadi Menunggu Verifikasi.');
        })
        .catch((err) => {
          console.warn('[Auto-Status] Transition notice:', err);
        });
    }
  }, [isSemuaFormLengkap, student?.id, student?.status_pendaftaran]);

  const isTabAccessible = (targetTab: 'diri' | 'alamat' | 'ortu' | 'berkas'): boolean => {
    if (targetTab === 'diri') return true;
    if (targetTab === 'alamat') return isDiriLengkap;
    if (targetTab === 'ortu') return isDiriLengkap && isAlamatLengkap;
    if (targetTab === 'berkas') return isDiriLengkap && isAlamatLengkap && isOrtuLengkap;
    return false;
  };

  const handleSelectTab = (targetTab: 'diri' | 'alamat' | 'ortu' | 'berkas') => {
    if (targetTab === 'diri') {
      setActiveFormTab('diri');
      return;
    }
    if (targetTab === 'alamat') {
      if (!isDiriLengkap) {
        showNotification('Lengkapi Data Diri terlebih dahulu.');
        return;
      }
      setActiveFormTab('alamat');
      return;
    }
    if (targetTab === 'ortu') {
      if (!isDiriLengkap) {
        showNotification('Lengkapi Data Diri terlebih dahulu.');
        return;
      }
      if (!isAlamatLengkap) {
        showNotification('Lengkapi Data Alamat terlebih dahulu.');
        return;
      }
      setActiveFormTab('ortu');
      return;
    }
    if (targetTab === 'berkas') {
      if (!isDiriLengkap) {
        showNotification('Lengkapi Data Diri terlebih dahulu.');
        return;
      }
      if (!isAlamatLengkap) {
        showNotification('Lengkapi Data Alamat terlebih dahulu.');
        return;
      }
      if (!isOrtuLengkap) {
        showNotification('Lengkapi Data Orang Tua terlebih dahulu.');
        return;
      }
      setActiveFormTab('berkas');
      return;
    }
  };

  const showNotification = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleSaveDataDiri = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!tglLahir || !tglLahir.trim()) {
        alert('Tanggal lahir wajib diisi.');
        return;
      }
      if (!tempatLahir || !tempatLahir.trim()) {
        alert('Tempat lahir wajib diisi.');
        return;
      }
      if (!jenisKelamin || !jenisKelamin.trim()) {
        alert('Jenis kelamin wajib dipilih.');
        return;
      }
      if (!agama || !agama.trim()) {
        alert('Agama wajib dipilih.');
        return;
      }
      if (!asalSekolah || !asalSekolah.trim()) {
        alert('Asal sekolah wajib diisi.');
        return;
      }
      
      const cleanNisn = nisn.trim().replace(/\D/g, '');
      if (cleanNisn.length !== 10) {
        alert('Peringatan: NISN harus terdiri dari tepat 10 digit angka!');
        return;
      }
      const cleanKk = noKk.trim().replace(/\D/g, '');
      if (cleanKk.length !== 16) {
        alert('Peringatan: No Kartu Keluarga (KK) harus terdiri dari tepat 16 digit angka!');
        return;
      }
      const cleanHp = noHp.trim().replace(/\D/g, '');
      if (cleanHp && (cleanHp.length < 10 || cleanHp.length > 15)) {
        alert('Nomor HP / WhatsApp harus berupa 10 - 15 digit angka.');
        return;
      }

      const updated = await dbService.updateStudentDataDiri(
        student.id,
        {
          nisn,
          nik: student.nik,
          no_kk: noKk,
          nama_lengkap: namaLengkap,
          tempat_lahir: tempatLahir,
          tanggal_lahir: tglLahir,
          jenis_kelamin: jenisKelamin as 'Laki-laki' | 'Perempuan',
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
      const updated = await dbService.updateStudentDataAlamat(student.id, {
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
      // Validasi ketat NIK Ayah (16 digit) jika diisi
      const cleanNikAyah = nikAyah.trim().replace(/\D/g, '');
      if (nikAyah.trim() && cleanNikAyah.length !== 16) {
        alert('Peringatan: NIK Ayah harus terdiri dari tepat 16 digit angka!');
        return;
      }

      // Validasi ketat NIK Ibu (16 digit) jika diisi
      const cleanNikIbu = nikIbu.trim().replace(/\D/g, '');
      if (nikIbu.trim() && cleanNikIbu.length !== 16) {
        alert('Peringatan: NIK Ibu harus terdiri dari tepat 16 digit angka!');
        return;
      }

      const cleanNikWali = nikWali.trim().replace(/\D/g, '');
      if (nikWali.trim() && cleanNikWali.length !== 16) {
        alert('Peringatan: NIK Wali harus terdiri dari tepat 16 digit angka!');
        return;
      }

      const cleanHpAyah = noHpAyah.trim().replace(/\D/g, '');
      if (noHpAyah.trim() && (cleanHpAyah.length < 10 || cleanHpAyah.length > 15)) {
        alert('Nomor HP Ayah harus berupa 10 - 15 digit angka.');
        return;
      }
      const cleanHpIbu = noHpIbu.trim().replace(/\D/g, '');
      if (noHpIbu.trim() && (cleanHpIbu.length < 10 || cleanHpIbu.length > 15)) {
        alert('Nomor HP Ibu harus berupa 10 - 15 digit angka.');
        return;
      }

      const updated = await dbService.updateStudentDataOrangTua(student.id, {
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

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    jenis: 'kartu_keluarga' | 'ijazah_skl' | 'akta_kelahiran' | 'kartu_kip' | 'pas_foto'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedMimeTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
      alert('Tipe file tidak didukung. Format yang diperbolehkan: PDF, JPG, JPEG, PNG, WEBP.');
      e.target.value = '';
      return;
    }

    const isImageFile = file.type.startsWith('image/');
    if (file.size > (isImageFile ? 10 : 2) * 1024 * 1024) {
      alert(isImageFile ? 'Ukuran foto maksimal adalah 10MB.' : 'Ukuran file PDF maksimal adalah 2MB.');
      e.target.value = '';
      return;
    }

    try {
      setIsUploadingBerkas(true);
      showNotification(`Mengunggah ${file.name}...`);
      const oldPath = (student.data_berkas as any)?.[jenis]?.path as string | undefined;
      const res = await dbService.uploadBerkasFile(student.user_id, jenis, file, oldPath);
      
      const nowStr = new Date().toLocaleDateString('id-ID');
      const item = {
        nama_file: res.nama_file,
        path: res.path,
        ukuran: res.ukuran,
        uploaded_at: nowStr,
      };

      if (jenis === 'kartu_keluarga') setBerkasKK(res.nama_file);
      if (jenis === 'ijazah_skl') setBerkasSKL(res.nama_file);
      if (jenis === 'akta_kelahiran') setBerkasAkta(res.nama_file);
      if (jenis === 'kartu_kip') setBerkasKIP(res.nama_file);
      if (jenis === 'pas_foto') setBerkasFoto(res.nama_file);

      const mergedBerkas = {
        ...(student.data_berkas || {}),
        [jenis]: item,
      };

      const updated = await dbService.updateStudentDataBerkas(student.id, mergedBerkas);
      setStudent(updated);
      showNotification(`Berkas ${file.name} berhasil diunggah!`);
    } catch (err: any) {
      console.error('Error upload file:', err);
      alert(err.message || 'Gagal mengunggah berkas.');
    } finally {
      setIsUploadingBerkas(false);
    }
  };

  const handleSaveDataBerkas = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const nowStr = new Date().toLocaleDateString('id-ID');
      const cur = student.data_berkas || {};

      const nextBerkas: any = { ...cur };
      if (berkasKK && !nextBerkas.kartu_keluarga) {
        nextBerkas.kartu_keluarga = {
          nama_file: berkasKK,
          ukuran: cur.kartu_keluarga?.ukuran || 'File Terunggah',
          uploaded_at: cur.kartu_keluarga?.uploaded_at || nowStr,
          path: cur.kartu_keluarga?.path,
        };
      }
      if (berkasSKL && !nextBerkas.ijazah_skl) {
        nextBerkas.ijazah_skl = {
          nama_file: berkasSKL,
          ukuran: cur.ijazah_skl?.ukuran || 'File Terunggah',
          uploaded_at: cur.ijazah_skl?.uploaded_at || nowStr,
          path: cur.ijazah_skl?.path,
        };
      }
      if (berkasAkta && !nextBerkas.akta_kelahiran) {
        nextBerkas.akta_kelahiran = {
          nama_file: berkasAkta,
          ukuran: cur.akta_kelahiran?.ukuran || 'File Terunggah',
          uploaded_at: cur.akta_kelahiran?.uploaded_at || nowStr,
          path: cur.akta_kelahiran?.path,
        };
      }
      if (berkasKIP && !nextBerkas.kartu_kip) {
        nextBerkas.kartu_kip = {
          nama_file: berkasKIP,
          ukuran: cur.kartu_kip?.ukuran || 'File Terunggah',
          uploaded_at: cur.kartu_kip?.uploaded_at || nowStr,
          path: cur.kartu_kip?.path,
        };
      }
      if (berkasFoto && !nextBerkas.pas_foto) {
        nextBerkas.pas_foto = {
          nama_file: berkasFoto,
          ukuran: cur.pas_foto?.ukuran || 'File Terunggah',
          uploaded_at: cur.pas_foto?.uploaded_at || nowStr,
          path: cur.pas_foto?.path,
        };
      }

      const updated = await dbService.updateStudentDataBerkas(student.id, nextBerkas);
      setStudent(updated);
      showNotification('Berkas pendaftaran berhasil disimpan!');
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan berkas');
    }
  };

  const handlePrintFormulir = () => {
    window.print();
  };

  const daftarSekolahBatang = [
    "SMP Negeri 1 Batang", "SMP Negeri 2 Batang", "SMP Negeri 3 Batang", "SMP Negeri 4 Batang", "SMP Negeri 6 Batang", "SMP Negeri 7 Batang", "SMP Negeri 8 Batang", "SMP Negeri 9 Batang",
    "SMP Negeri 1 Bawang", "SMP Negeri 2 Bawang", "SMP Negeri 3 Bawang", "SMP Negeri 4 Bawang",
    "SMP Negeri 1 Tulis", "SMP Negeri 2 Tulis",
    "SMP Negeri 1 Bandar", "SMP Negeri 2 Bandar", "SMP Negeri 3 Bandar", "SMP Negeri 4 Bandar",
    "SMP Negeri 1 Blado", "SMP Negeri 2 Blado", "SMP Negeri 3 Blado",
    "SMP Negeri 1 Reban", "SMP Negeri 2 Reban", "SMP Negeri 3 Reban",
    "SMP Negeri 1 Pecalungan",
    "SMP Negeri 1 Subah", "SMP Negeri 2 Subah", "SMP Negeri 3 Subah",
    "SMP Negeri 1 Limpung", "SMP Negeri 2 Limpung", "SMP Negeri 3 Limpung",
    "SMP Negeri 1 Gringsing", "SMP Negeri 2 Gringsing", "SMP Negeri 3 Gringsing", "SMP Negeri 4 Gringsing",
    "SMP Negeri 1 Tersono", "SMP Negeri 2 Tersono",
    "SMP Negeri 1 Wonotunggal", "SMP Negeri 2 Wonotunggal",
    "SMP Negeri 1 Kandeman", "SMP Negeri 2 Kandeman",
    "SMP Negeri 1 Warungasem", "SMP Negeri 2 Warungasem", "SMP Negeri 3 Warungasem",
    "SMP Negeri 1 Banyuputih",

    "MTs Negeri Batang",

    "MTs Sunan Kalijaga", "MTs Hasyim Asy'ari",
    "MTs NU Batang", "MTs NU 01 Banyuputih", "MTs NU 01 Limpung", "MTs NU 01 Subah", "MTs NU 01 Tersono", "MTs NU 01 Bandar", "MTs NU 01 Blado", "MTs NU 01 Gringsing", "MTs NU Nurul Huda", "MTs NU Al Munawwir",
    "MTs Muhammadiyah Batang", "MTs Muhammadiyah Bawang", "MTs Muhammadiyah Limpung", "MTs Muhammadiyah Tersono", "MTs Muhammadiyah Bandar", "MTs Muhammadiyah Subah",
    "MTs Darul Ulum", "MTs Al Islam", "MTs Al Huda", "MTs Nurul Huda", "MTs Darussalam", "MTs Wahid Hasyim", "MTs Salafiyah", "MTs Al Hikmah", "MTs Tholabuddin", "MTs Takhassus Al-Qur'an", "MTs Maulana Maghribi", "MTs Syarifuddin", "MTs Al-Syafi'iyah",
    
    "SMP Muhammadiyah Batang", "SMP Muhammadiyah Bawang", "SMP Muhammadiyah Limpung", "SMP NU Batang"
  ];

  const doneCount = [isDiriLengkap, isAlamatLengkap, isOrtuLengkap, isBerkasLengkap].filter(Boolean).length;
  const progressPercent = doneCount * 25;
  const initial = (student.nama_lengkap?.charAt(0) || 'S').toUpperCase();

  const openChangePassword = () => {
    if (onRequestChangePassword) {
      onRequestChangePassword();
    } else {
      setShowLocalChangePassword(true);
    }
  };

  type MenuKey = 'beranda' | 'formulir' | 'pembayaran' | 'pengumuman';
  const navItems: { key: MenuKey; label: string; shortLabel: string; icon: LucideIcon }[] = [
    { key: 'beranda', label: 'Beranda', shortLabel: 'Beranda', icon: Home },
    { key: 'formulir', label: 'Formulir Pendaftaran', shortLabel: 'Formulir', icon: FileText },
    ...(isSemuaFormLengkap
      ? [{ key: 'pembayaran' as MenuKey, label: 'Biaya & Pembayaran', shortLabel: 'Biaya', icon: CreditCard }]
      : []),
    { key: 'pengumuman', label: 'Pengumuman Hasil', shortLabel: 'Hasil', icon: Megaphone },
  ];

  return (
    <div className="ui-scope ui-page flex flex-col">

      {saveToast && (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-[80] flex w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_24px_40px_-16px_rgba(15,23,42,.6)] animate-in fade-in slide-in-from-top-4 duration-200"
          style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <Check className="h-5 w-5 shrink-0 rounded-full bg-emerald-700 p-0.5" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Header gradien */}
      <header className="ui-header">
        <div className="flex h-[4.25rem] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="ui-hbtn hidden !px-0 w-10 md:inline-flex"
              title={isSidebarOpen ? 'Sembunyikan Bilah Samping' : 'Buka Bilah Samping'}
              aria-label="Toggle Sidebar"
              aria-expanded={isSidebarOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
            <img src={LOGO_URL} alt="Logo SMK Muhammadiyah Bawang" className="h-10 w-10 shrink-0 object-contain drop-shadow-md" referrerPolicy="no-referrer" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-base font-extrabold tracking-tight sm:text-lg">SPMB Muhiba</p>
              <p className="truncate text-xs text-indigo-100">Panel Siswa • SMK Muhammadiyah Bawang</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/20 px-3 py-1.5 text-xs font-semibold text-emerald-50 sm:inline-flex">
              <span className="ui-dot" />
              Terhubung
            </span>
            <div className="hidden text-right leading-tight lg:block">
              <p className="max-w-[10rem] truncate text-sm font-semibold">{student.nama_lengkap}</p>
              <p className="font-mono text-[0.7rem] text-indigo-100">No. {student.nomor_pendaftaran}</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="ui-avatar md:hidden"
              aria-label="Buka menu akun"
            >
              {initial}
            </button>
            <span className="ui-avatar hidden md:inline-flex" aria-hidden>{initial}</span>
            <span className="hidden h-7 w-px bg-white/25 md:block" aria-hidden />
            <button
              type="button"
              onClick={onLogout}
              className="ui-hbtn hidden !px-0 w-10 md:inline-flex"
              title="Keluar dari akun siswa"
              aria-label="Logout"
            >
              <LogOut className="h-[1.1rem] w-[1.1rem]" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">

        {/* Bilah samping (tablet & desktop). Di ponsel diganti navigasi bawah. */}
        <aside
          className={`hidden shrink-0 flex-col justify-between border-r border-slate-200/70 bg-white/70 backdrop-blur-xl transition-[margin] duration-300 ease-in-out md:sticky md:top-[4.25rem] md:flex md:h-[calc(100dvh_-_4.25rem)] md:w-64 ${
            isSidebarOpen ? 'md:ml-0' : 'md:-ml-64'
          }`}
        >
          <nav className="space-y-1.5 p-3" aria-label="Menu utama siswa">
            {navItems.map((it) => {
              const active = activeMenu === it.key;
              const Icon = it.icon;
              return (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => {
                    setActiveMenu(it.key);
                    setMobileSidebarOpen(false);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    active ? 'text-white' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-pill"
                      className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 shadow-[0_16px_26px_-14px_rgba(91,61,240,.9)]"
                      transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                    />
                  )}
                  <Icon className="relative h-[1.15rem] w-[1.15rem] shrink-0" />
                  <span className="relative">{it.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="space-y-2.5 border-t border-slate-200/70 p-4">
            <button
              type="button"
              onClick={openChangePassword}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-2xl bg-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-95"
              title="Ganti kata sandi akun"
            >
              <KeyRound className="h-4 w-4 text-slate-500" />
              <span>Ubah Password</span>
            </button>

            <a
              href="https://www.smkmuhiba.sch.id"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-between rounded-2xl bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition-all hover:bg-indigo-100 active:scale-95"
            >
              <span>Website Sekolah</span>
              <ExternalLink className="h-4 w-4" />
            </a>

            <button
              type="button"
              onClick={onNavigateHome}
              className="flex w-full cursor-pointer items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-95"
            >
              <span>← Beranda PPDB</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-rose-600 text-sm font-bold text-white shadow-[0_16px_26px_-14px_rgba(225,29,72,.9)] transition-all hover:bg-rose-700 active:scale-95"
            >
              <LogOut className="h-4 w-4" />
              <span>Keluar / Logout</span>
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">

          <div className="mx-auto w-full max-w-5xl space-y-5 p-4 pb-6 sm:p-8">

            {newCredentials && (
              <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white rounded-[2rem] p-5 sm:p-7 shadow-[0_34px_50px_-30px_rgba(234,120,0,.9)] border border-amber-300/40 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white text-amber-600 flex items-center justify-center font-black shadow">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black tracking-wide uppercase">
                        PENTING: Simpan Username & Password Anda
                      </h3>
                      <p className="text-xs text-amber-100 font-medium">
                        Kredensial ini digunakan untuk masuk kembali ke dashboard siswa & mengecek status pengumuman.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleCloseCredentialsWarning}
                    className="self-end sm:self-center px-3 py-1.5 bg-black/20 hover:bg-black/40 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                    title="Tutup peringatan"
                  >
                    <X className="w-4 h-4" />
                    <span>Tutup</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white/10 backdrop-blur-sm p-3 sm:p-4 rounded-3xl border border-white/20">
                  <div className="bg-white/95 rounded-2xl p-3.5 text-slate-800 shadow-sm flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">
                        Username (NIK 16 Digit)
                      </span>
                      <span className="text-lg sm:text-xl font-mono font-black text-rose-700 tracking-wide select-all">
                        {newCredentials.nik}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyText(newCredentials.nik, 'username')}
                      className="h-10 px-3.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedField === 'username' ? 'Tersalin!' : 'Salin'}</span>
                    </button>
                  </div>

                  <div className="bg-white/95 rounded-2xl p-3.5 text-slate-800 shadow-sm flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">
                        Password Pendaftaran
                      </span>
                      <span className="text-lg sm:text-xl font-mono font-black text-slate-900 tracking-wide select-all">
                        {newCredentials.password}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyText(newCredentials.password, 'password')}
                      className="h-10 px-3.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedField === 'password' ? 'Tersalin!' : 'Salin'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <p className="text-[11px] text-amber-100">
                    *Username login siswa selalu berupa <strong>16 digit NIK</strong>. Jangan berikan password Anda kepada siapapun.
                  </p>

                  <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                    <button
                      onClick={handleDownloadCredentialsPDF}
                      className="w-full sm:w-auto min-h-12 px-5 py-2.5 bg-white hover:bg-amber-50 active:scale-95 text-slate-900 font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4 text-amber-600" />
                      <span>Unduh PDF Username & Password</span>
                    </button>

                    <button
                      onClick={handleCloseCredentialsWarning}
                      className="w-full sm:w-auto min-h-12 px-4 py-2.5 bg-amber-700/80 hover:bg-amber-800 active:scale-95 text-white font-bold text-xs rounded-2xl transition-all text-center"
                    >
                      Saya sudah menyimpan / Tutup
                    </button>
                  </div>
                </div>
              </div>
            )}

            <ViewTransition viewKey={activeMenu}>

            {activeMenu === 'beranda' && (
              <div className="space-y-5">

                <Hero
                  chip={<>Status Pendaftaran: {student.status_pendaftaran || 'Berkas Fisik'}</>}
                  title={<>Hai, {student.nama_lengkap}!</>}
                  subtitle={
                    <>
                      No. Pendaftaran: <span className="font-mono font-bold text-white">{student.nomor_pendaftaran}</span> • Pilihan:{' '}
                      <span className="font-bold text-yellow-300">{student.jurusan_pilihan || 'Belum dipilih'}</span>
                    </>
                  }
                  actions={
                    <motion.button
                      type="button"
                      onClick={() => {
                        setActiveMenu('formulir');
                        handleSelectTab('diri');
                      }}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                      className="ui-cta ui-shine"
                    >
                      <FileText className="h-5 w-5 text-indigo-600" />
                      <span>Lengkapi Formulir</span>
                      <ArrowRight className="h-4 w-4" />
                    </motion.button>
                  }
                >
                  <div className="flex items-center gap-4 pt-2">
                    <ProgressRing percent={progressPercent} label={`Formulir terisi ${progressPercent} persen`} />
                    <div className="min-w-0 text-sm leading-snug">
                      <p className="font-bold text-white">{doneCount} dari 4 bagian terisi</p>
                      <p className="text-indigo-100">
                        {doneCount === 4 ? 'Semua data lengkap. Tinggal menunggu verifikasi.' : 'Lengkapi sisanya agar berkas bisa diverifikasi.'}
                      </p>
                    </div>
                  </div>
                </Hero>

                {/* 4 bagian formulir */}
                <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  <StatCard
                    tone="blue"
                    index={0}
                    label="1. Data Diri"
                    icon={User}
                    value={
                      <span className="flex items-center gap-2 text-[1.35rem] leading-tight sm:text-2xl">
                        {isDiriLengkap && <CheckCircle2 className="h-6 w-6 shrink-0" />}
                        {isDiriLengkap ? 'Lengkap' : 'Belum lengkap'}
                      </span>
                    }
                    caption="Biodata calon siswa & NIK"
                    onClick={() => {
                      setActiveMenu('formulir');
                      handleSelectTab('diri');
                    }}
                    ariaLabel="Buka formulir Data Diri"
                  />
                  <StatCard
                    tone="amber"
                    index={1}
                    label="2. Data Alamat"
                    icon={MapPin}
                    locked={!isTabAccessible('alamat')}
                    value={
                      <span className="flex items-center gap-2 text-[1.35rem] leading-tight sm:text-2xl">
                        {isAlamatLengkap && <CheckCircle2 className="h-6 w-6 shrink-0" />}
                        {!isTabAccessible('alamat') && !isAlamatLengkap && <Lock className="h-5 w-5 shrink-0" />}
                        {isAlamatLengkap ? 'Lengkap' : !isTabAccessible('alamat') ? 'Terkunci' : 'Belum lengkap'}
                      </span>
                    }
                    caption={!isTabAccessible('alamat') ? 'Isi data diri dahulu' : 'Domisili & tempat tinggal'}
                    onClick={() => {
                      if (isTabAccessible('alamat')) {
                        setActiveMenu('formulir');
                        handleSelectTab('alamat');
                      }
                    }}
                    ariaLabel="Buka formulir Data Alamat"
                  />
                  <StatCard
                    tone="green"
                    index={2}
                    label="3. Orang Tua / Wali"
                    icon={Users}
                    locked={!isTabAccessible('ortu')}
                    value={
                      <span className="flex items-center gap-2 text-[1.35rem] leading-tight sm:text-2xl">
                        {isOrtuLengkap && <CheckCircle2 className="h-6 w-6 shrink-0" />}
                        {!isTabAccessible('ortu') && !isOrtuLengkap && <Lock className="h-5 w-5 shrink-0" />}
                        {isOrtuLengkap ? 'Lengkap' : !isTabAccessible('ortu') ? 'Terkunci' : 'Belum lengkap'}
                      </span>
                    }
                    caption={!isTabAccessible('ortu') ? 'Isi alamat dahulu' : 'Data ayah, ibu, atau wali'}
                    onClick={() => {
                      if (isTabAccessible('ortu')) {
                        setActiveMenu('formulir');
                        handleSelectTab('ortu');
                      }
                    }}
                    ariaLabel="Buka formulir Orang Tua atau Wali"
                  />
                  <StatCard
                    tone="rose"
                    index={3}
                    label="4. Upload Berkas"
                    icon={FolderCheck}
                    locked={!isTabAccessible('berkas')}
                    value={
                      <span className="flex items-center gap-2 text-[1.35rem] leading-tight sm:text-2xl">
                        {isBerkasLengkap && <CheckCircle2 className="h-6 w-6 shrink-0" />}
                        {!isTabAccessible('berkas') && !isBerkasLengkap && <Lock className="h-5 w-5 shrink-0" />}
                        {isBerkasLengkap ? 'Lengkap' : !isTabAccessible('berkas') ? 'Terkunci' : 'Belum lengkap'}
                      </span>
                    }
                    caption="KK, Akta, SKL, Pas Foto"
                    onClick={() => {
                      if (isTabAccessible('berkas')) {
                        setActiveMenu('formulir');
                        handleSelectTab('berkas');
                      }
                    }}
                    ariaLabel="Buka formulir Upload Berkas"
                  />
                </Stagger>

                {/* Tahapan proses */}
                <section className="ui-panel space-y-5 p-5 sm:p-7">
                  <PanelTitle
                    title="Tahapan Proses Pendaftaran"
                    live
                    right={
                      <span className="text-sm text-slate-500">
                        Status saat ini: <span className="font-bold text-indigo-700">{student.status_pendaftaran || 'Berkas Fisik'}</span>
                      </span>
                    }
                  />

                  <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatusTile
                      tone={isSemuaFormLengkap ? 'green' : 'blue'}
                      label="1. Isi Formulir"
                      value={
                        <span className="block text-[0.95rem] font-bold leading-snug">
                          {isSemuaFormLengkap ? '✓ Selesai Diisi' : 'Sedang Dilengkapi'}
                        </span>
                      }
                    />
                    <StatusTile
                      tone={
                        student.status_pendaftaran === 'Menunggu Verifikasi' ||
                        student.status_pendaftaran === 'Terverifikasi' ||
                        student.status_pendaftaran === 'Diterima'
                          ? 'amber'
                          : 'slate'
                      }
                      label="2. Verifikasi Berkas"
                      value={
                        <span className="block text-[0.95rem] font-bold leading-snug">
                          {student.status_pendaftaran === 'Menunggu Verifikasi'
                            ? 'Menunggu Panitia'
                            : student.status_pendaftaran === 'Terverifikasi' || student.status_pendaftaran === 'Diterima'
                            ? '✓ Terverifikasi'
                            : 'Belum Diajukan'}
                        </span>
                      }
                    />
                    <StatusTile
                      tone={student.status_pendaftaran === 'Terverifikasi' || student.status_pendaftaran === 'Diterima' ? 'blue' : 'slate'}
                      label="3. Biaya Masuk"
                      value={
                        <span className="block text-[0.95rem] font-bold leading-snug">
                          {isSemuaFormLengkap ? 'Bisa Dikonfirmasi' : 'Terkunci'}
                        </span>
                      }
                    />
                    <StatusTile
                      tone={student.status_pendaftaran === 'Diterima' ? 'violet' : 'slate'}
                      label="4. Pengumuman"
                      value={
                        <span className="block text-[0.95rem] font-bold leading-snug">
                          {student.status_pendaftaran === 'Diterima' ? '✓ DITERIMA' : 'Belum Diumumkan'}
                        </span>
                      }
                    />
                  </Stagger>

                  <div className="ui-note">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    <span>Data tersimpan otomatis di database cloud. Pastikan seluruh formulir terisi lengkap.</span>
                  </div>
                </section>

                {/* Persiapan berkas (bisa dilipat) */}
                <section className="ui-panel overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowDocs((v) => !v)}
                    aria-expanded={showDocs}
                    aria-controls="panel-persiapan-berkas"
                    className="flex w-full cursor-pointer items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 sm:px-7"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-[0_14px_24px_-12px_rgba(91,61,240,.9)]">
                        <Megaphone className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base font-bold text-slate-900">Informasi Pendaftaran</span>
                        <span className="block truncate text-xs text-slate-500">Tahun Ajaran 2026/2027 • 7 dokumen persyaratan</span>
                      </span>
                    </span>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${showDocs ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {showDocs && (
                      <motion.div
                        id="panel-persiapan-berkas"
                        key="docs"
                        initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-5 px-5 pb-5 sm:px-7 sm:pb-7">
                          <div className="flex items-center justify-between gap-3 rounded-3xl bg-slate-50 px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                              Pengumuman Resmi
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              2026-02-02 10:40:54
                            </span>
                          </div>

                          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-700 p-5 text-center text-white shadow-[0_26px_40px_-28px_rgba(67,56,202,.9)] sm:p-6">
                            <div className="relative z-10 mx-auto max-w-2xl space-y-2">
                              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold text-yellow-300">
                                Selamat Datang Calon Peserta Didik Baru
                              </span>
                              <h3 className="text-lg font-extrabold leading-snug tracking-tight sm:text-xl">
                                Sekolah Pencetak Wirausaha • Siap Kerja • Siap Kuliah
                              </h3>
                              <p className="text-sm text-blue-100">
                                Persiapkan masa depan gemilang dengan pendidikan vokasi unggul dan berkarakter islami bersama SMK Muhammadiyah Bawang.
                              </p>
                            </div>
                            <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
                            <div className="pointer-events-none absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-violet-400/20 blur-2xl" />
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-sm font-bold text-slate-900">Sebelum mendaftar, silakan persiapkan berkas berikut :</h4>
                            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                              {DOCS.map((d) => (
                                <div
                                  key={d.title}
                                  className="group flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 transition-colors hover:border-indigo-200 hover:bg-white"
                                >
                                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-4 ring-emerald-50 transition-transform group-hover:scale-110">
                                    <Check className="h-3 w-3 stroke-[3]" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                      <p className="text-sm font-bold text-slate-800">{d.title}</p>
                                      <span
                                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ${
                                          d.tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-white text-slate-500 ring-1 ring-slate-200'
                                        }`}
                                      >
                                        {d.badge}
                                      </span>
                                    </div>
                                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{d.desc}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col items-stretch justify-between gap-4 rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50/60 to-slate-50 p-4 sm:flex-row sm:items-center sm:p-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_14px_24px_-12px_rgba(37,99,235,.9)]">
                                <FileCheck2 className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900">
                                  Setelah berkas disiapkan, silakan lengkapi data formulir pendaftaran kamu
                                </p>
                                <p className="text-xs text-slate-500">
                                  Pengisian data lengkap menjamin validasi berkas lebih cepat oleh panitia.
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveMenu('formulir')}
                              className="ui-shine group flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 text-sm font-bold text-white shadow-[0_18px_30px_-16px_rgba(91,61,240,.9)] transition-all hover:brightness-110 active:scale-95"
                            >
                              <span>Buka & Lengkapi Formulir Sekarang</span>
                              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>

              </div>
            )}

            {activeMenu === 'formulir' && (
              <div className="space-y-6">

                {showWarningBanner && (
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 rounded-3xl flex items-center justify-between gap-3 text-sm font-semibold shadow-[0_22px_34px_-22px_rgba(234,120,0,.9)]">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>Untuk mencetak formulir ada dimenu pembayaran setelah verifikasi.</span>
                    </div>
                    <button 
                      onClick={() => setShowWarningBanner(false)}
                      className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-full transition-all active:scale-90 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  <div className="ui-panel ui-form lg:col-span-8 p-4 sm:p-8 space-y-6">
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 flex items-center justify-center shrink-0">
                          <User className="w-8 h-8" />
                        </div>
                        <div>
                          <span className="text-xs text-slate-400 font-semibold block">Status Pendaftaran</span>
                          <span className="inline-block mt-1 px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-bold">
                            {student.status_pendaftaran || 'Berkas Fisik'}
                          </span>
                        </div>
                      </div>

                      <div className="ui-scroll-x -mx-1 px-1 sm:mx-0 sm:px-0">
                        <SegTabs
                          id="formtab"
                          ariaLabel="Bagian formulir pendaftaran"
                          className="min-w-max"
                          active={activeFormTab}
                          onChange={(k) => handleSelectTab(k as 'diri' | 'alamat' | 'ortu' | 'berkas')}
                          items={[
                            {
                              key: 'diri',
                              icon: User,
                              label: (
                                <span className="inline-flex items-center gap-1">
                                  Data Diri {isDiriLengkap && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                                </span>
                              ),
                            },
                            {
                              key: 'alamat',
                              icon: isTabAccessible('alamat') ? MapPin : Lock,
                              disabled: !isTabAccessible('alamat'),
                              label: (
                                <span className="inline-flex items-center gap-1">
                                  Data Alamat {isAlamatLengkap && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                                </span>
                              ),
                            },
                            {
                              key: 'ortu',
                              icon: isTabAccessible('ortu') ? Users : Lock,
                              disabled: !isTabAccessible('ortu'),
                              label: (
                                <span className="inline-flex items-center gap-1">
                                  Orang Tua {isOrtuLengkap && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                                </span>
                              ),
                            },
                            {
                              key: 'berkas',
                              icon: isTabAccessible('berkas') ? FolderCheck : Lock,
                              disabled: !isTabAccessible('berkas'),
                              label: (
                                <span className="inline-flex items-center gap-1">
                                  Data Berkas {isBerkasLengkap && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                                </span>
                              ),
                            },
                          ]}
                        />
                      </div>
                    </div>

                    {activeFormTab === 'diri' && (
                      <form onSubmit={handleSaveDataDiri} className="space-y-6">
                        
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
                                onChange={(e) => setNisn(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                placeholder="10 Digit Angka NISN"
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
                                onChange={(e) => setNoKk(e.target.value.replace(/\D/g, '').slice(0, 16))}
                                placeholder="16 Digit Nomor KK"
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
                                <option value="" disabled>-- Pilih Jenis Kelamin --</option>
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
                                <option value="" disabled>-- Pilih Agama --</option>
                                <option value="Islam">Islam</option>
                                <option value="Kristen">Kristen</option>
                                <option value="Katolik">Katolik</option>
                                <option value="Hindu">Hindu</option>
                                <option value="Buddha">Buddha</option>
                                <option value="Konghucu">Konghucu</option>
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
                                list="list-asal-sekolah"
                                value={asalSekolah}
                                onChange={(e) => setAsalSekolah(e.target.value)}
                                placeholder="Ketik atau Pilih Asal Sekolah..."
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                              <datalist id="list-asal-sekolah">
                                {daftarSekolahBatang.map((sekolah, index) => (
                                  <option key={index} value={sekolah} />
                                ))}
                              </datalist>
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
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white font-bold text-xs rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                          >
                            <Save className="w-4 h-4" />
                            <span>Simpan Data Diri</span>
                          </button>
                        </div>
                      </form>
                    )}

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
                                placeholder="Contoh: Jawa Tengah"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Kabupaten / Kota</label>
                              <input
                                type="text"
                                value={kabupaten}
                                onChange={(e) => setKabupaten(e.target.value)}
                                placeholder="Contoh: Kabupaten Batang"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Kecamatan</label>
                              <input
                                type="text"
                                value={kecamatan}
                                onChange={(e) => setKecamatan(e.target.value)}
                                placeholder="Contoh: Bawang"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Desa / Kelurahan</label>
                              <input
                                type="text"
                                value={desa}
                                onChange={(e) => setDesa(e.target.value)}
                                placeholder="Nama Desa / Kelurahan"
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
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white font-bold text-xs rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                          >
                            <Save className="w-4 h-4" />
                            <span>Simpan Data Alamat</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {activeFormTab === 'ortu' && (
                      <form onSubmit={handleSaveDataOrangTua} className="space-y-6">
                        
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                            <span>Data Lengkap Ayah</span>
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-slate-600 mb-1">NIK Ayah (16 Digit Angka)</label>
                              <input
                                type="text"
                                value={nikAyah}
                                onChange={(e) => setNikAyah(e.target.value.replace(/\D/g, '').slice(0, 16))}
                                placeholder="16 Digit NIK Ayah"
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

                        <div className="space-y-3 pt-3 border-t">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b">
                            <User className="w-3.5 h-3.5 text-rose-600" />
                            <span>Data Lengkap Ibu</span>
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-slate-600 mb-1">NIK Ibu (16 Digit Angka)</label>
                              <input
                                type="text"
                                value={nikIbu}
                                onChange={(e) => setNikIbu(e.target.value.replace(/\D/g, '').slice(0, 16))}
                                placeholder="16 Digit NIK Ibu"
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

                        <div className="space-y-3 pt-3 border-t">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b">
                            <User className="w-3.5 h-3.5 text-purple-600" />
                            <span>Data Lengkap Wali (Opsional)</span>
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-slate-600 mb-1">NIK Wali (16 Digit Angka)</label>
                              <input
                                type="text"
                                value={nikWali}
                                onChange={(e) => setNikWali(e.target.value.replace(/\D/g, '').slice(0, 16))}
                                placeholder="16 Digit NIK Wali"
                                className="w-full px-3 py-2 border border-slate-300 rounded"
                              />
                            </div>
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
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white font-bold text-xs rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                          >
                            <Save className="w-4 h-4" />
                            <span>Simpan Data Orang Tua</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {activeFormTab === 'berkas' && (
                      <form onSubmit={handleSaveDataBerkas} className="space-y-5">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b">
                          <FolderCheck className="w-4 h-4 text-blue-600" />
                          <span>Upload Data Berkas</span>
                        </h3>

                        <div className="space-y-4 text-xs">
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="block font-bold text-slate-800 mb-1">Kartu Keluarga</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                                disabled={isUploadingBerkas}
                                onChange={(e) => handleFileUpload(e, 'kartu_keluarga')}
                                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                              />
                            </div>
                            {student.data_berkas?.kartu_keluarga?.nama_file && (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-[11px] text-emerald-600 font-semibold">
                                  ✓ File: {student.data_berkas.kartu_keluarga.nama_file}
                                </span>
                              </div>
                            )}
                            <p className="text-[10px] text-slate-400 mt-0.5">Foto otomatis dikompres. PDF maksimum 2 MB. (PDF/JPG/PNG)</p>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="block font-bold text-slate-800 mb-1">Ijazah / SKL</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                                disabled={isUploadingBerkas}
                                onChange={(e) => handleFileUpload(e, 'ijazah_skl')}
                                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                              />
                            </div>
                            {student.data_berkas?.ijazah_skl?.nama_file && (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-[11px] text-emerald-600 font-semibold">
                                  ✓ File: {student.data_berkas.ijazah_skl.nama_file}
                                </span>
                              </div>
                            )}
                            <p className="text-[10px] text-slate-400 mt-0.5">Foto otomatis dikompres. PDF maksimum 2 MB.</p>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="block font-bold text-slate-800 mb-1">Akta Lahir</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                                disabled={isUploadingBerkas}
                                onChange={(e) => handleFileUpload(e, 'akta_kelahiran')}
                                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                              />
                            </div>
                            {student.data_berkas?.akta_kelahiran?.nama_file && (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-[11px] text-emerald-600 font-semibold">
                                  ✓ File: {student.data_berkas.akta_kelahiran.nama_file}
                                </span>
                              </div>
                            )}
                            <p className="text-[10px] text-slate-400 mt-0.5">Foto otomatis dikompres. PDF maksimum 2 MB.</p>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="block font-bold text-slate-800 mb-1">Kartu KIP (jika punya)</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                                disabled={isUploadingBerkas}
                                onChange={(e) => handleFileUpload(e, 'kartu_kip')}
                                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                              />
                            </div>
                            {student.data_berkas?.kartu_kip?.nama_file && (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-[11px] text-emerald-600 font-semibold">
                                  ✓ File: {student.data_berkas.kartu_kip.nama_file}
                                </span>
                              </div>
                            )}
                            <p className="text-[10px] text-slate-400 mt-0.5">Foto otomatis dikompres. PDF maksimum 2 MB.</p>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="block font-bold text-slate-800 mb-1">Pas Foto (3x4)</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                disabled={isUploadingBerkas}
                                onChange={(e) => handleFileUpload(e, 'pas_foto')}
                                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                              />
                            </div>
                            {student.data_berkas?.pas_foto?.nama_file && (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-[11px] text-emerald-600 font-semibold">
                                  ✓ File: {student.data_berkas.pas_foto.nama_file}
                                </span>
                              </div>
                            )}
                            <p className="text-[10px] text-slate-400 mt-0.5">Foto otomatis dikompres. Format JPG, JPEG, PNG, WEBP.</p>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 italic">
                          *Harap isi data berkas dengan sebenarnya. Setelah data berkas disimpan, status pendaftaran berubah menjadi Menunggu Verifikasi.
                        </p>

                        <div className="pt-2">
                          <button
                            type="submit"
                            disabled={isUploadingBerkas}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 active:scale-[0.97] text-white font-bold text-xs rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                          >
                            <Save className="w-4 h-4" />
                            <span>{isUploadingBerkas ? 'Mengunggah Berkas...' : 'Simpan Data Berkas'}</span>
                          </button>
                        </div>
                      </form>
                    )}

                  </div>

                  <div className="ui-panel hidden lg:block lg:col-span-4 p-6 space-y-5">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Progres Pengisian Formulir
                    </h3>

                    <div className="space-y-4">
                      <div 
                        onClick={() => handleSelectTab('diri')}
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

                      <div 
                        onClick={() => handleSelectTab('alamat')}
                        className={`p-3.5 rounded-xl border flex items-center gap-3.5 transition-all ${
                          activeFormTab === 'alamat' 
                            ? 'border-blue-500 bg-blue-50/40 shadow-sm' 
                            : isTabAccessible('alamat')
                            ? 'border-slate-100 hover:bg-slate-50 cursor-pointer'
                            : 'border-slate-100 bg-slate-50/70 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full text-white font-extrabold flex items-center justify-center shrink-0 text-sm ${
                          isTabAccessible('alamat') ? 'bg-blue-600' : 'bg-slate-400'
                        }`}>
                          {isTabAccessible('alamat') ? '2' : <Lock className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-900">Data Alamat</p>
                          <div className="mt-0.5">
                            {isAlamatLengkap ? (
                              <span className="text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" /> Lengkap
                              </span>
                            ) : !isTabAccessible('alamat') ? (
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" /> Terkunci
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-white bg-rose-500 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <X className="w-2.5 h-2.5" /> Belum Lengkap
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div 
                        onClick={() => handleSelectTab('ortu')}
                        className={`p-3.5 rounded-xl border flex items-center gap-3.5 transition-all ${
                          activeFormTab === 'ortu' 
                            ? 'border-blue-500 bg-blue-50/40 shadow-sm' 
                            : isTabAccessible('ortu')
                            ? 'border-slate-100 hover:bg-slate-50 cursor-pointer'
                            : 'border-slate-100 bg-slate-50/70 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full text-white font-extrabold flex items-center justify-center shrink-0 text-sm ${
                          isTabAccessible('ortu') ? 'bg-blue-600' : 'bg-slate-400'
                        }`}>
                          {isTabAccessible('ortu') ? '3' : <Lock className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-900">Data Orang Tua</p>
                          <div className="mt-0.5">
                            {isOrtuLengkap ? (
                              <span className="text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" /> Lengkap
                              </span>
                            ) : !isTabAccessible('ortu') ? (
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" /> Terkunci
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-white bg-rose-500 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <X className="w-2.5 h-2.5" /> Belum Lengkap
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div 
                        onClick={() => handleSelectTab('berkas')}
                        className={`p-3.5 rounded-xl border flex items-center gap-3.5 transition-all ${
                          activeFormTab === 'berkas' 
                            ? 'border-blue-500 bg-blue-50/40 shadow-sm' 
                            : isTabAccessible('berkas')
                            ? 'border-slate-100 hover:bg-slate-50 cursor-pointer'
                            : 'border-slate-100 bg-slate-50/70 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full text-white font-extrabold flex items-center justify-center shrink-0 text-sm ${
                          isTabAccessible('berkas') ? 'bg-blue-600' : 'bg-slate-400'
                        }`}>
                          {isTabAccessible('berkas') ? '4' : <Lock className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-900">Data Berkas</p>
                          <div className="mt-0.5">
                            {isBerkasLengkap ? (
                              <span className="text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" /> Lengkap
                              </span>
                            ) : !isTabAccessible('berkas') ? (
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" /> Terkunci
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

                    <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-2">
                      <p className="font-bold text-slate-800">Petunjuk Panitia:</p>
                      <p className="text-[11px] leading-relaxed">
                        Setelah semua data terisi lengkap, status pendaftaran akan diproses oleh verifikator SMK Muhammadiyah Bawang.
                      </p>
                    </div>

                  </div>

                </div>

              </div>
            )}

            {activeMenu === 'pembayaran' && isSemuaFormLengkap && (
              <div className="ui-panel p-5 sm:p-8 space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Rincian Pembayaran & Cetak Formulir</h2>
                      <p className="text-xs text-slate-500">Informasi administrasi pendaftaran siswa baru SMK Muhammadiyah Bawang</p>
                    </div>
                    <button
                      onClick={handlePrintFormulir}
                      className="ui-shine h-11 px-5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 text-white font-bold text-sm rounded-2xl shadow-[0_18px_30px_-16px_rgba(91,61,240,.9)] transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Cetak Formulir Lengkap</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
                      <p className="text-xs text-emerald-800 font-semibold">Biaya Pendaftaran / Formulir</p>
                      <p className="text-2xl font-black text-emerald-700 mt-1">GRATIS (Rp 0,-)</p>
                      <p className="text-[11px] text-emerald-600 mt-0.5">Program Bebas Biaya Gelombang 1 Sekolah SMART</p>
                    </div>

                    <div className="p-5 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                      <p className="text-xs text-blue-800 font-semibold">Biaya Seragam & Atribut Sekolah</p>
                      <p className="text-2xl font-black text-blue-700 mt-1">Rp 350.000,-</p>
                      <p className="text-[11px] text-blue-600 mt-0.5">3 Stel Seragam Praktik, Pramuka, Hizbul Wathan & Jas</p>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-slate-50/70 p-4 sm:p-6 space-y-4">
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

            {activeMenu === 'pengumuman' && (
              <div className="ui-panel p-5 sm:p-8 space-y-6">
                <div className="pb-4 border-b border-slate-100">
                  <h2 className="text-base font-bold text-slate-900">Pengumuman Hasil Seleksi</h2>
                  <p className="text-xs text-slate-500">Status kelulusan penerimaan peserta didik baru tahun ajaran 2026/2027</p>
                </div>

                {student.status_pendaftaran === 'Diterima' && (
                  <div className="p-6 sm:p-8 rounded-[2rem] bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-300 text-center space-y-3 max-w-xl mx-auto shadow-sm">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-emerald-950 uppercase tracking-wide">
                      SELAMAT! ANDA DINYATAKAN DITERIMA
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Peserta Didik atas nama <strong>{student.nama_lengkap}</strong> dengan nomor pendaftaran <strong>{student.nomor_pendaftaran}</strong> resmi dinyatakan <span className="text-emerald-700 font-bold uppercase">DITERIMA</span> sebagai siswa baru di SMK Muhammadiyah Bawang pada kompetensi keahlian:
                    </p>
                    <div className="inline-block px-4 py-1.5 bg-emerald-600 text-white rounded-full text-xs font-bold shadow-sm">
                      {student.jurusan_pilihan === 'TO' && 'TEKNIK OTOMOTIF (TO)'}
                      {student.jurusan_pilihan === 'TJKT' && 'TEKNIK JARINGAN KOMPUTER & TELEKOMUNIKASI (TJKT)'}
                      {student.jurusan_pilihan === 'AKL' && 'AKUNTANSI DAN KEUANGAN LEMBAGA (AKL)'}
                    </div>
                    <p className="text-[11px] text-slate-500 pt-2">
                      Silakan ikuti instruksi panitia untuk pengambilan seragam, daftar ulang, dan masa orientasi (MPLS).
                    </p>
                  </div>
                )}

                {student.status_pendaftaran === 'Terverifikasi' && (
                  <div className="p-6 sm:p-8 rounded-[2rem] bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-300 text-center space-y-3 max-w-xl mx-auto shadow-sm">
                    <div className="w-14 h-14 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center mx-auto shadow-inner">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-teal-950 uppercase tracking-wide">
                      BERKAS TERVERIFIKASI
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Berkas Anda atas nama <strong>{student.nama_lengkap}</strong> (No. Pendaftaran: <strong>{student.nomor_pendaftaran}</strong>) sudah terverifikasi. Tunggu pengumuman hasil seleksi resmi dari panitia SPMB.
                    </p>
                    <div className="inline-block px-4 py-1.5 bg-teal-600 text-white rounded-full text-xs font-bold shadow-sm">
                      Dokumen Sah & Lengkap
                    </div>
                    <p className="text-[11px] text-slate-500 pt-2">
                      Pengumuman final kelulusan dan pemetaan kelas akan diumumkan sesuai jadwal gelombang.
                    </p>
                  </div>
                )}

                {student.status_pendaftaran === 'Cadangan' && (
                  <div className="p-6 sm:p-8 rounded-[2rem] bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-300 text-center space-y-3 max-w-xl mx-auto shadow-sm">
                    <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                      <Clock className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-amber-950 uppercase tracking-wide">
                      ANDA MASUK DAFTAR CADANGAN
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Peserta Didik atas nama <strong>{student.nama_lengkap}</strong> dengan nomor pendaftaran <strong>{student.nomor_pendaftaran}</strong> saat ini berada pada status <strong>CADANGAN</strong> untuk jurusan pilihan <strong>{student.jurusan_pilihan}</strong>.
                    </p>
                    <p className="text-[11px] text-amber-800 bg-amber-100/70 p-3 rounded-lg border border-amber-200">
                      Panitia SPMB akan menghubungi nomor WhatsApp Anda (<strong>{student.no_wa}</strong>) apabila terdapat kuota tambahan atau pembukaan gelombang susulan.
                    </p>
                  </div>
                )}

                {(student.status_pendaftaran === 'Menunggu Verifikasi' || (isSemuaFormLengkap && student.status_pendaftaran !== 'Diterima' && student.status_pendaftaran !== 'Terverifikasi' && student.status_pendaftaran !== 'Cadangan')) && (
                  <div className="p-6 sm:p-8 rounded-[2rem] bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-300 text-center space-y-3 max-w-xl mx-auto shadow-sm">
                    <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                      <Clock className="w-8 h-8 animate-spin" />
                    </div>
                    <h3 className="text-lg font-black text-blue-950 uppercase tracking-wide">
                      SEDANG DALAM PROSES VERIFIKASI
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Data pendaftaran dan berkas peserta didik atas nama <strong>{student.nama_lengkap}</strong> (No. Pendaftaran: <strong>{student.nomor_pendaftaran}</strong>) telah diterima oleh sistem dan sedang diperiksa oleh tim panitia verifikator PPDB.
                    </p>
                    <div className="inline-block px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold shadow-sm">
                      Menunggu Validasi Dokumen
                    </div>
                    <p className="text-[11px] text-slate-500 pt-2">
                      Hasil seleksi resmi akan diperbarui secara berkala pada menu ini.
                    </p>
                  </div>
                )}

                {!isSemuaFormLengkap &&
                 student.status_pendaftaran !== 'Diterima' && 
                 student.status_pendaftaran !== 'Terverifikasi' && 
                 student.status_pendaftaran !== 'Cadangan' && 
                 student.status_pendaftaran !== 'Menunggu Verifikasi' && (
                  <div className="p-6 sm:p-8 rounded-[2rem] bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-300 text-center space-y-3 max-w-xl mx-auto shadow-sm">
                    <div className="w-14 h-14 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto shadow-inner">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-orange-950 uppercase tracking-wide">
                      LENGKAPI BERKAS TERLEBIH DAHULU
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Status pendaftaran Anda saat ini adalah <strong>{student.status_pendaftaran || 'Berkas Fisik'}</strong>. Data formulir dan berkas belum lengkap. Setelah semua formulir dan berkas terisi lengkap, pengumuman hasil secara otomatis akan berubah menjadi Menunggu Verifikasi.
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setActiveMenu('formulir');
                          handleSelectTab('diri');
                        }}
                        className="h-12 px-6 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-2xl shadow-[0_18px_30px_-16px_rgba(234,88,12,.9)] transition-all active:scale-95"
                      >
                        Lengkapi Formulir Sekarang
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 pt-1">
                      Pengumuman hasil seleksi hanya akan diproses setelah semua tahapan formulir dan berkas terpenuhi.
                    </p>
                  </div>
                )}
              </div>
            )}

            </ViewTransition>

          </div>

          <footer className="mt-auto px-4 sm:px-8 pt-4 pb-[calc(7rem_+_env(safe-area-inset-bottom,0px))] md:pb-5 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Copyright © 2026 SPMB SMK MUHIBA | by @hndx07</span>
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

      {showLocalChangePassword && (
        <React.Suspense fallback={null}>
          <ChangePasswordModal
            forced={false}
            nik={student.nik}
            onClose={() => setShowLocalChangePassword(false)}
            onChanged={() => {
              setShowLocalChangePassword(false);
              showNotification('Kata sandi berhasil diperbarui.');
            }}
          />
        </React.Suspense>
      )}

      {/* Navigasi bawah (ponsel) */}
      <BottomNav
        label="Navigasi Bawah Siswa"
        items={[
          ...navItems.map((it) => ({
            key: it.key,
            label: it.shortLabel,
            icon: it.icon,
            active: activeMenu === it.key && !mobileSidebarOpen,
            onClick: () => {
              setMobileSidebarOpen(false);
              setActiveMenu(it.key);
            },
          })),
          {
            key: 'akun',
            label: 'Akun',
            icon: User,
            active: mobileSidebarOpen,
            onClick: () => setMobileSidebarOpen(true),
          },
        ]}
      />

      {/* Menu akun (ponsel) — pengganti bilah samping */}
      <Sheet open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} title="Akun saya">
        <div className="mb-4 flex items-center gap-3 rounded-3xl bg-indigo-50/80 p-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-bold text-white shadow-md">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{student.nama_lengkap}</p>
            <p className="font-mono text-xs text-slate-500">No. {student.nomor_pendaftaran}</p>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => {
              setMobileSidebarOpen(false);
              openChangePassword();
            }}
            className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-2xl bg-slate-100 px-4 text-left text-sm font-semibold text-slate-700 transition-all active:scale-[0.97]"
          >
            <KeyRound className="h-4 w-4 text-slate-500" />
            <span>Ubah Password</span>
          </button>

          <a
            href="https://www.smkmuhiba.sch.id"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-between rounded-2xl bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition-all active:scale-[0.97]"
          >
            <span>Website Sekolah</span>
            <ExternalLink className="h-4 w-4" />
          </a>

          <button
            type="button"
            onClick={() => {
              setMobileSidebarOpen(false);
              onNavigateHome();
            }}
            className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-2xl bg-slate-100 px-4 text-left text-sm font-semibold text-slate-700 transition-all active:scale-[0.97]"
          >
            <span>← Beranda PPDB</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-rose-600 text-sm font-bold text-white shadow-[0_16px_26px_-14px_rgba(225,29,72,.9)] transition-all active:scale-[0.97]"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar / Logout</span>
          </button>
        </div>
      </Sheet>
    </div>
  );
};
