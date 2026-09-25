export type UserRole = 'admin' | 'student';

export type JurusanType = 'TO' | 'TJKT' | 'AKL';

export type StatusPendaftaran = 
  | 'Belum Lengkap' 
  | 'Berkas Fisik'
  | 'Menunggu Verifikasi' 
  | 'Terverifikasi' 
  | 'Diterima' 
  | 'Cadangan';

export interface User {
  id: string;
  nik: string;
  role: UserRole;
  password_hash: string;
  created_at: string;
}

export interface DataDiri {
  nisn?: string;
  nik?: string;
  no_kk?: string;
  nama_lengkap?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  jenis_kelamin?: 'Laki-laki' | 'Perempuan';
  agama?: string;
  no_hp?: string;
  asal_sekolah?: string;
  anak_ke?: number;
  jumlah_saudara?: number;
  is_anak_guru?: boolean;
  tinggi_badan?: number;
  berat_badan?: number;
  status_dalam_keluarga?: string;
  ukuran_baju?: string;
  kode_referal?: string;
  // Bantuan Pemerintah
  kip?: string;
  pkh?: string;
  kks?: string;
  kis?: string;
  foto_profil_url?: string;
}

export interface DataAlamat {
  dukuh?: string;
  rt?: string;
  rw?: string;
  provinsi?: string;
  kabupaten?: string;
  kecamatan?: string;
  desa?: string;
  kode_pos?: string;
  tinggal_bersama?: string;
  transportasi?: string;
}

export interface DataOrangTua {
  // Ayah
  nik_ayah?: string;
  nama_ayah?: string;
  tempat_lahir_ayah?: string;
  tanggal_lahir_ayah?: string;
  pendidikan_ayah?: string;
  pekerjaan_ayah?: string;
  no_hp_ayah?: string;
  // Ibu
  nik_ibu?: string;
  nama_ibu?: string;
  tempat_lahir_ibu?: string;
  tanggal_lahir_ibu?: string;
  pendidikan_ibu?: string;
  pekerjaan_ibu?: string;
  no_hp_ibu?: string;
  // Wali
  nik_wali?: string;
  nama_wali?: string;
  tempat_lahir_wali?: string;
  tanggal_lahir_wali?: string;
  pendidikan_wali?: string;
  pekerjaan_wali?: string;
  no_hp_wali?: string;
}

export interface BerkasItem {
  nama_file: string;
  tipe?: string;
  url?: string;
  ukuran?: string;
  uploaded_at?: string;
}

export interface DataBerkas {
  kartu_keluarga?: BerkasItem;
  ijazah_skl?: BerkasItem;
  akta_kelahiran?: BerkasItem;
  kartu_kip?: BerkasItem;
  pas_foto?: BerkasItem;
  piagam?: BerkasItem;
}

export interface Student {
  id: string;
  user_id: string;
  nik: string;
  nama_lengkap: string;
  jurusan_pilihan: JurusanType;
  no_wa: string;
  status_pendaftaran: StatusPendaftaran;
  nomor_pendaftaran: string;
  tanggal_daftar: string;
  catatan_admin?: string;
  data_diri: DataDiri;
  data_alamat: DataAlamat;
  data_orang_tua: DataOrangTua;
  data_berkas: DataBerkas;
}

export interface Pembayaran {
  id: string;
  student_id: string;
  nik: string;
  nominal: number;
  metode: string;
  bukti_url?: string;
  status: 'Lunas' | 'Menunggu Verifikasi' | 'Belum Bayar';
  tanggal_bayar: string;
  keterangan: string;
}
