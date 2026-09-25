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
  Database, 
  Trash2, 
  ShieldCheck, 
  Check, 
  X, 
  Copy, 
  AlertCircle,
  ExternalLink,
  Save,
  Printer
} from 'lucide-react';
import { Student, User, StatusPendaftaran, JurusanType } from '../types/database';
import { dbService, SUPABASE_SQL_SCHEMA } from '../services/supabase';

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

  // Supabase config modal
  const [showDbModal, setShowDbModal] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    loadStudents();
    const config = dbService.getStoredSupabaseConfig();
    setSupabaseUrl(config.url);
    setSupabaseKey(config.key);
  }, []);

  const loadStudents = () => {
    const list = dbService.getAllStudents();
    setStudents([...list]);
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

  const handleSaveDbConfig = () => {
    dbService.saveSupabaseConfig(supabaseUrl.trim(), supabaseKey.trim());
    showToast('Konfigurasi Supabase berhasil disimpan!');
    setShowDbModal(false);
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
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
      <header className="bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold shadow">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-wide uppercase">
              PANEL ADMINISTRATOR PPDB
            </h1>
            <p className="text-[11px] text-slate-400">
              SMK Muhammadiyah Bawang (SMK Muhiba)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDbModal(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-blue-300 rounded-md border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Supabase Sync</span>
          </button>

          <button
            onClick={onNavigateHome}
            className="px-3 py-1.5 text-xs text-slate-300 hover:text-white transition-colors hidden sm:inline"
          >
            Web Sekolah
          </button>

          <button
            onClick={onLogout}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-md transition-colors"
          >
            Logout
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
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
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
                <div className="space-y-1.5">
                  <p className="flex items-center justify-between">
                    <span className="text-slate-500">Kartu Keluarga:</span>
                    <span className="font-medium text-slate-800">
                      {selectedStudent.data_berkas?.kartu_keluarga?.nama_file || 'Belum upload'}
                    </span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-slate-500">Ijazah / SKL:</span>
                    <span className="font-medium text-slate-800">
                      {selectedStudent.data_berkas?.ijazah_skl?.nama_file || 'Belum upload'}
                    </span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-slate-500">Akta Lahir:</span>
                    <span className="font-medium text-slate-800">
                      {selectedStudent.data_berkas?.akta_kelahiran?.nama_file || 'Belum upload'}
                    </span>
                  </p>
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

      {/* ========================================================================= */}
      {/* SUPABASE CONFIG & SQL SCHEMA MODAL */}
      {/* ========================================================================= */}
      {showDbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 relative my-8 animate-in fade-in duration-200 space-y-5">
            
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                  Database & Authentication Setup
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  Integrasi Backend Supabase
                </h3>
              </div>
              <button
                onClick={() => setShowDbModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Aplikasi ini memiliki sistem dual-sync: berjalan langsung dengan penyimpanan lokal reaktif, serta mendukung koneksi live ke <strong>Supabase</strong> untuk tabel <code>users</code> dan <code>students</code>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Supabase Anon Key
                </label>
                <input
                  type="password"
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded font-mono"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveDbConfig}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-md shadow-sm transition-colors"
                >
                  Simpan Konfigurasi Supabase
                </button>
              </div>
            </div>

            {/* SQL Script Viewer */}
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase">
                  Skema SQL Supabase (Copy & Paste ke SQL Editor)
                </h4>
                <button
                  onClick={handleCopySchema}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  {copiedSchema ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSchema ? 'Tersalin!' : 'Salin SQL'}</span>
                </button>
              </div>

              <pre className="bg-slate-900 text-emerald-400 p-4 rounded-lg text-[11px] font-mono overflow-x-auto max-h-56 leading-relaxed">
                {SUPABASE_SQL_SCHEMA}
              </pre>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
