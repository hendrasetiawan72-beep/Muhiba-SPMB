import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Download, 
  Trash2, 
  ShieldCheck, 
  Check, 
  X, 
  AlertCircle,
  ExternalLink,
  Save,
  Printer,
  LogOut
} from 'lucide-react';
import { Student, User, StatusPendaftaran, JurusanType } from '../types/database';
import { dbService } from '../services/supabase';

interface AdminDashboardProps {
  currentUser: User;
  onLogout: () => void;
  onNavigateHome: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onLogout,
  onNavigateHome,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJurusan, setFilterJurusan] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  
  // Selected student for detail modal
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [modalStatus, setModalStatus] = useState<StatusPendaftaran>('Berkas Fisik');
  const [adminNotes, setAdminNotes] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    loadStudents();

    // Subscribe to Supabase Realtime changes on students table
    const unsubscribe = dbService.subscribeToStudents(() => {
      loadStudents();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadStudents = async () => {
    try {
      const list = await dbService.getAllStudents();
      setStudents(list);
    } catch (err: any) {
      console.error('Error loading students:', err);
      showToast(err.message || 'Gagal memuat data pendaftar dari server');
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const filteredStudents = students.filter(std => {
    const query = searchQuery.toLowerCase();
    const matchSearch =
      std.nama_lengkap.toLowerCase().includes(query) ||
      std.nik.includes(query) ||
      std.nomor_pendaftaran.includes(query) ||
      (std.data_diri?.asal_sekolah || '').toLowerCase().includes(query);

    const matchJurusan = filterJurusan === 'ALL' || std.jurusan_pilihan === filterJurusan;
    const matchStatus = filterStatus === 'ALL' || std.status_pendaftaran === filterStatus;

    return matchSearch && matchJurusan && matchStatus;
  });

  const handleOpenDetail = (std: Student) => {
    setSelectedStudent(std);
    setModalStatus(std.status_pendaftaran);
    setAdminNotes(std.catatan_admin || '');
  };

  const handleUpdateStatus = async () => {
    if (!selectedStudent) return;
    try {
      const updated = await dbService.updateStudentStatus(selectedStudent.nik, modalStatus, adminNotes);
      setSelectedStudent(updated);
      loadStudents();
      showToast(`Status pendaftaran ${updated.nama_lengkap} berhasil diperbarui menjadi ${modalStatus}`);
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status');
    }
  };

  const handleDeleteStudent = async (nik: string, nama: string) => {
    if (window.confirm(`Yakin ingin menghapus data pendaftar ${nama} (NIK: ${nik})?`)) {
      await dbService.deleteStudent(nik);
      loadStudents();
      if (selectedStudent?.nik === nik) setSelectedStudent(null);
      showToast(`Data pendaftar ${nama} berhasil dihapus.`);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'No Pendaftaran',
      'NIK',
      'Nama Lengkap',
      'Jurusan',
      'No WA',
      'Asal Sekolah',
      'Status Pendaftaran',
      'Tanggal Daftar',
      'Ukuran Baju',
      'Dukuh / Alamat',
      'Kecamatan',
      'Nama Ayah',
      'Nama Ibu',
    ];

    const rows = filteredStudents.map(s => [
      `"${s.nomor_pendaftaran}"`,
      `"${s.nik}"`,
      `"${s.nama_lengkap}"`,
      `"${s.jurusan_pilihan}"`,
      `"${s.no_wa}"`,
      `"${s.data_diri?.asal_sekolah || '-'}"`,
      `"${s.status_pendaftaran}"`,
      `"${s.tanggal_daftar}"`,
      `"${s.data_diri?.ukuran_baju || '-'}"`,
      `"${s.data_alamat?.dukuh || '-'}"`,
      `"${s.data_alamat?.kecamatan || '-'}"`,
      `"${s.data_orang_tua?.nama_ayah || '-'}"`,
      `"${s.data_orang_tua?.nama_ibu || '-'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DATA_PPDB_SMK_MUHIBA_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const jsonContent = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredStudents, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonContent);
    link.setAttribute('download', `DATA_PPDB_SMK_MUHIBA_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Berhasil mengunduh ${filteredStudents.length} data pendaftar dalam format JSON.`);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      
      {/* Toast Alert */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-200">
          <Check className="w-4 h-4 bg-emerald-700 p-0.5 rounded-full" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Admin Header */}
      {/* Header Admin with Modern Gradient */}
      <header className="bg-gradient-to-r from-blue-800 via-indigo-800 to-purple-900 text-white border-b border-indigo-950 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold shadow ring-2 ring-white/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-wide uppercase text-white drop-shadow-xs">
              PANEL ADMINISTRATOR PPDB
            </h1>
            <p className="text-[11px] text-blue-200 font-medium">
              SMK Muhammadiyah Bawang (SMK Muhiba)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Koneksi Hijau */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/40 rounded-full text-xs font-bold text-emerald-200 backdrop-blur-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-[11px] tracking-wide">Terhubung</span>
          </div>

          {/* Download Data JSON in Header */}
          <button
            onClick={handleExportJSON}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
            title="Download data pendaftar format JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Data JSON</span>
          </button>

          <a
            href="https://www.smkmuhiba.sch.id"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs text-blue-100 hover:text-white transition-colors hidden sm:inline-flex items-center gap-1 font-bold"
          >
            <span>Web Sekolah</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={onNavigateHome}
            className="px-3 py-1.5 text-xs text-blue-100 hover:text-white font-semibold transition-colors hidden sm:inline"
          >
            Beranda PPDB
          </button>

          {/* Solid prominent red logout button */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-black rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
            title="Keluar dari Panel Admin"
          >
            <LogOut className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>LOGOUT</span>
          </button>
        </div>
      </header>

      {/* Main Admin Viewport */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 space-y-6">
        
        {/* Quick KPI Counters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Pendaftar</p>
            <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{students.length}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-[11px] font-semibold text-amber-600 uppercase">Teknik Otomotif (TO)</p>
            <p className="text-2xl font-black text-amber-600 mt-1 tabular-nums">
              {students.filter(s => s.jurusan_pilihan === 'TO').length}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-[11px] font-semibold text-blue-600 uppercase">TJKT</p>
            <p className="text-2xl font-black text-blue-600 mt-1 tabular-nums">
              {students.filter(s => s.jurusan_pilihan === 'TJKT').length}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-[11px] font-semibold text-emerald-600 uppercase">AKL</p>
            <p className="text-2xl font-black text-emerald-600 mt-1 tabular-nums">
              {students.filter(s => s.jurusan_pilihan === 'AKL').length}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm col-span-2 md:col-span-1">
            <p className="text-[11px] font-semibold text-purple-600 uppercase">Diterima / Terverifikasi</p>
            <p className="text-2xl font-black text-purple-600 mt-1 tabular-nums">
              {students.filter(s => s.status_pendaftaran === 'Diterima' || s.status_pendaftaran === 'Terverifikasi').length}
            </p>
          </div>
        </div>

        {/* Action & Filter Bar */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Search box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari NIK, Nama, No. Daftar, SMP..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filters and export button */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Jurusan:</span>
              <select
                value={filterJurusan}
                onChange={(e) => setFilterJurusan(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white font-semibold"
              >
                <option value="ALL">Semua Jurusan</option>
                <option value="TO">Teknik Otomotif (TO)</option>
                <option value="TJKT">TJKT</option>
                <option value="AKL">AKL</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white font-semibold"
              >
                <option value="ALL">Semua Status</option>
                <option value="Berkas Fisik">Berkas Fisik</option>
                <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                <option value="Terverifikasi">Terverifikasi</option>
                <option value="Diterima">Diterima</option>
                <option value="Cadangan">Cadangan</option>
              </select>
            </div>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              title="Unduh data pendaftar format CSV/Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              title="Unduh berkas cadangan data pendaftar format JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Data JSON</span>
            </button>
          </div>

        </div>

        {/* DataGrid / Table of Applicants */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3.5">No. Pendaftaran</th>
                  <th className="px-4 py-3.5">NIK Siswa</th>
                  <th className="px-4 py-3.5">Nama Lengkap</th>
                  <th className="px-4 py-3.5">Jurusan</th>
                  <th className="px-4 py-3.5">Asal Sekolah</th>
                  <th className="px-4 py-3.5">No. WhatsApp</th>
                  <th className="px-4 py-3.5">Status Pendaftaran</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada data pendaftar yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((std) => (
                    <tr key={std.nik} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-blue-700">
                        {std.nomor_pendaftaran}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-700">
                        {std.nik}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {std.nama_lengkap}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          std.jurusan_pilihan === 'TO' ? 'bg-amber-100 text-amber-800' :
                          std.jurusan_pilihan === 'TJKT' ? 'bg-blue-100 text-blue-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {std.jurusan_pilihan}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {std.data_diri?.asal_sekolah || '-'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <a
                          href={`https://wa.me/62${std.no_wa.replace(/^0/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:underline font-mono"
                        >
                          {std.no_wa}
                        </a>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          std.status_pendaftaran === 'Diterima' ? 'bg-emerald-100 text-emerald-800' :
                          std.status_pendaftaran === 'Terverifikasi' ? 'bg-blue-100 text-blue-800' :
                          std.status_pendaftaran === 'Menunggu Verifikasi' ? 'bg-purple-100 text-purple-800' :
                          std.status_pendaftaran === 'Cadangan' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {std.status_pendaftaran}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(std)}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="Lihat Detail & Verifikasi"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(std.nik, std.nama_lengkap)}
                            className="p-1.5 text-rose-500 hover:bg-rose-100 rounded transition-colors"
                            title="Hapus Data"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
      
      <footer className="px-4 sm:px-8 py-4 border-t border-slate-200 bg-white text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full">
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

      {/* ========================================================================= */}
      {/* MODAL DETAIL SISWA & VERIFIKASI */}
      {/* ========================================================================= */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 sm:p-8 relative my-8 animate-in fade-in duration-200 space-y-6">
            
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                  Detail Calon Peserta Didik
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  {selectedStudent.nama_lengkap}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  No. Pendaftaran: {selectedStudent.nomor_pendaftaran} • NIK: {selectedStudent.nik}
                </p>
              </div>

              <button
                onClick={() => setSelectedStudent(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Tabs / Information Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              
              {/* Block 1: Data Diri */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800 uppercase pb-1 border-b">Data Diri</h4>
                <div className="grid grid-cols-2 gap-1.5">
                  <span className="text-slate-500">NISN:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_diri?.nisn || '-'}</span>

                  <span className="text-slate-500">TTL:</span>
                  <span className="font-medium text-slate-800">
                    {selectedStudent.data_diri?.tempat_lahir || '-'}, {selectedStudent.data_diri?.tanggal_lahir || '-'}
                  </span>

                  <span className="text-slate-500">Jenis Kelamin:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_diri?.jenis_kelamin || '-'}</span>

                  <span className="text-slate-500">Asal SMP:</span>
                  <span className="font-semibold text-blue-700">{selectedStudent.data_diri?.asal_sekolah || '-'}</span>

                  <span className="text-slate-500">Ukuran Baju:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_diri?.ukuran_baju || '-'}</span>

                  <span className="text-slate-500">Kode Referal:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_diri?.kode_referal || '-'}</span>
                </div>
              </div>

              {/* Block 2: Data Alamat */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800 uppercase pb-1 border-b">Data Alamat</h4>
                <div className="grid grid-cols-2 gap-1.5">
                  <span className="text-slate-500">Dukuh/Jalan:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_alamat?.dukuh || '-'}</span>

                  <span className="text-slate-500">RT / RW:</span>
                  <span className="font-medium text-slate-800">
                    {selectedStudent.data_alamat?.rt || '-'}/{selectedStudent.data_alamat?.rw || '-'}
                  </span>

                  <span className="text-slate-500">Kecamatan:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_alamat?.kecamatan || '-'}</span>

                  <span className="text-slate-500">Kabupaten:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_alamat?.kabupaten || '-'}</span>

                  <span className="text-slate-500">Transportasi:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_alamat?.transportasi || '-'}</span>
                </div>
              </div>

              {/* Block 3: Data Orang Tua */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800 uppercase pb-1 border-b">Data Orang Tua</h4>
                <div className="grid grid-cols-2 gap-1.5">
                  <span className="text-slate-500">Nama Ayah:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_orang_tua?.nama_ayah || '-'}</span>

                  <span className="text-slate-500">Pekerjaan Ayah:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_orang_tua?.pekerjaan_ayah || '-'}</span>

                  <span className="text-slate-500">Nama Ibu:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_orang_tua?.nama_ibu || '-'}</span>

                  <span className="text-slate-500">Pekerjaan Ibu:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_orang_tua?.pekerjaan_ibu || '-'}</span>

                  <span className="text-slate-500">No HP Ortu:</span>
                  <span className="font-medium text-slate-800">
                    {selectedStudent.data_orang_tua?.no_hp_ayah || selectedStudent.data_orang_tua?.no_hp_ibu || '-'}
                  </span>
                </div>
              </div>

              {/* Block 4: Berkas & Dokumen */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800 uppercase pb-1 border-b">Berkas Terunggah</h4>
                <div className="space-y-2 text-xs">
                  {/* Kartu Keluarga */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Kartu Keluarga:</span>
                    <span className="font-medium text-slate-800 text-right truncate">
                      {selectedStudent.data_berkas?.kartu_keluarga?.url ? (
                        <a
                          href={selectedStudent.data_berkas.kartu_keluarga.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline font-semibold flex items-center gap-1 justify-end"
                          title="Klik untuk membuka/unduh berkas"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span className="truncate max-w-[200px]">{selectedStudent.data_berkas.kartu_keluarga.nama_file}</span>
                        </a>
                      ) : (
                        selectedStudent.data_berkas?.kartu_keluarga?.nama_file || <span className="text-slate-400 italic">Belum upload</span>
                      )}
                    </span>
                  </div>

                  {/* Ijazah / SKL */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Ijazah / SKL:</span>
                    <span className="font-medium text-slate-800 text-right truncate">
                      {selectedStudent.data_berkas?.ijazah_skl?.url ? (
                        <a
                          href={selectedStudent.data_berkas.ijazah_skl.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline font-semibold flex items-center gap-1 justify-end"
                          title="Klik untuk membuka/unduh berkas"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span className="truncate max-w-[200px]">{selectedStudent.data_berkas.ijazah_skl.nama_file}</span>
                        </a>
                      ) : (
                        selectedStudent.data_berkas?.ijazah_skl?.nama_file || <span className="text-slate-400 italic">Belum upload</span>
                      )}
                    </span>
                  </div>

                  {/* Akta Lahir */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Akta Lahir:</span>
                    <span className="font-medium text-slate-800 text-right truncate">
                      {selectedStudent.data_berkas?.akta_kelahiran?.url ? (
                        <a
                          href={selectedStudent.data_berkas.akta_kelahiran.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline font-semibold flex items-center gap-1 justify-end"
                          title="Klik untuk membuka/unduh berkas"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span className="truncate max-w-[200px]">{selectedStudent.data_berkas.akta_kelahiran.nama_file}</span>
                        </a>
                      ) : (
                        selectedStudent.data_berkas?.akta_kelahiran?.nama_file || <span className="text-slate-400 italic">Belum upload</span>
                      )}
                    </span>
                  </div>

                  {/* KIP */}
                  {selectedStudent.data_berkas?.kartu_kip && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 shrink-0">Kartu KIP:</span>
                      <span className="font-medium text-slate-800 text-right truncate">
                        {selectedStudent.data_berkas.kartu_kip.url ? (
                          <a
                            href={selectedStudent.data_berkas.kartu_kip.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline font-semibold flex items-center gap-1 justify-end"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">{selectedStudent.data_berkas.kartu_kip.nama_file}</span>
                          </a>
                        ) : (
                          selectedStudent.data_berkas.kartu_kip.nama_file
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Verifikasi Status Action Form */}
            <div className="p-5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-4">
              <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                Verifikasi Status Pendaftaran
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ubah Status:
                  </label>
                  <select
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value as StatusPendaftaran)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md font-bold text-slate-800"
                  >
                    <option value="Berkas Fisik">Berkas Fisik</option>
                    <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                    <option value="Terverifikasi">Terverifikasi</option>
                    <option value="Diterima">Diterima di SMK Muhiba</option>
                    <option value="Cadangan">Cadangan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Panitia / Verifikator:
                  </label>
                  <input
                    type="text"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Contoh: Berkas asli sudah dicek di loket"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleUpdateStatus}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-sm transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan Status</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800"
                >
                  Tutup
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
