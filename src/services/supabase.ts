import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Student, User, Pembayaran, StatusPendaftaran, JurusanType } from '../types/database';

// Initial default students matching the screenshots
const SEED_USERS: User[] = [
  {
    id: 'user-admin-1',
    nik: 'admin',
    role: 'admin',
    password_hash: 'admin123',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user-student-1',
    nik: '3325028202892999',
    role: 'student',
    password_hash: '12345',
    created_at: '2026-09-25T06:49:00Z',
  },
  {
    id: 'user-student-2',
    nik: '3325028202892888',
    role: 'student',
    password_hash: '12345',
    created_at: '2026-09-24T08:15:00Z',
  },
  {
    id: 'user-student-3',
    nik: '3325028202892777',
    role: 'student',
    password_hash: '12345',
    created_at: '2026-09-23T10:30:00Z',
  }
];

const SEED_STUDENTS: Student[] = [
  {
    id: 'student-1',
    user_id: 'user-student-1',
    nik: '3325028202892999',
    nama_lengkap: 'Eko Juniarto',
    jurusan_pilihan: 'TO',
    no_wa: '085582580',
    status_pendaftaran: 'Berkas Fisik',
    nomor_pendaftaran: '2026476',
    tanggal_daftar: '25-09-2026 06:49',
    data_diri: {
      nisn: '8729209999',
      nik: '3325028202892999',
      no_kk: '3325021204050001',
      nama_lengkap: 'Eko Juniarto',
      tempat_lahir: 'Batang',
      tanggal_lahir: '2008-09-25',
      jenis_kelamin: 'Laki-laki',
      agama: 'Islam',
      no_hp: '085582580',
      asal_sekolah: 'SMP NEGERI 1 PLANTUNGAN',
      anak_ke: 2,
      jumlah_saudara: 3,
      is_anak_guru: false,
      tinggi_badan: 165,
      berat_badan: 55,
      status_dalam_keluarga: 'Anak Kandung',
      ukuran_baju: 'L',
      kode_referal: 'ALDI / XII TO 1',
      kip: 'KIP-2024-88912',
    },
    data_alamat: {
      dukuh: 'Krapyak RT 02 RW 01',
      rt: '02',
      rw: '01',
      provinsi: 'Jawa Tengah',
      kabupaten: 'Kabupaten Batang',
      kecamatan: 'Bawang',
      desa: 'Jlamprang',
      kode_pos: '51274',
      tinggal_bersama: 'Orang Tua',
      transportasi: 'Sepeda Motor',
    },
    data_orang_tua: {
      nik_ayah: '3325021005700001',
      nama_ayah: 'Suryadi',
      tempat_lahir_ayah: 'Batang',
      tanggal_lahir_ayah: '1970-05-10',
      pendidikan_ayah: 'SMA / SMK',
      pekerjaan_ayah: 'Wiraswasta',
      no_hp_ayah: '08561333392',
      nik_ibu: '3325025008740002',
      nama_ibu: 'Siti Aminah',
      tempat_lahir_ibu: 'Batang',
      tanggal_lahir_ibu: '1974-08-15',
      pendidikan_ibu: 'SMP / MTs',
      pekerjaan_ibu: 'Ibu Rumah Tangga',
      no_hp_ibu: '085741977501',
    },
    data_berkas: {
      kartu_keluarga: {
        nama_file: 'KK_Eko_Juniarto.pdf',
        ukuran: '1.2 MB',
        uploaded_at: '25-09-2026',
      },
      ijazah_skl: {
        nama_file: 'SKL_SMPN1_Plantungan.pdf',
        ukuran: '850 KB',
        uploaded_at: '25-09-2026',
      },
      akta_kelahiran: {
        nama_file: 'Akta_Eko_Juniarto.pdf',
        ukuran: '940 KB',
        uploaded_at: '25-09-2026',
      },
    },
  },
  {
    id: 'student-2',
    user_id: 'user-student-2',
    nik: '3325028202892888',
    nama_lengkap: 'Siti Rahmawati',
    jurusan_pilihan: 'AKL',
    no_wa: '081234567890',
    status_pendaftaran: 'Menunggu Verifikasi',
    nomor_pendaftaran: '2026477',
    tanggal_daftar: '24-09-2026 08:15',
    data_diri: {
      nisn: '8729208888',
      nik: '3325028202892888',
      nama_lengkap: 'Siti Rahmawati',
      tempat_lahir: 'Pekalongan',
      tanggal_lahir: '2008-04-12',
      jenis_kelamin: 'Perempuan',
      agama: 'Islam',
      no_hp: '081234567890',
      asal_sekolah: 'SMP N 2 Bawang',
      ukuran_baju: 'M',
    },
    data_alamat: {
      dukuh: 'Wonobodro',
      rt: '01',
      rw: '03',
      provinsi: 'Jawa Tengah',
      kabupaten: 'Kabupaten Batang',
      kecamatan: 'Blado',
      desa: 'Wonobodro',
      kode_pos: '51255',
      tinggal_bersama: 'Orang Tua',
      transportasi: 'Angkutan Umum',
    },
    data_orang_tua: {
      nama_ayah: 'Budi Santoso',
      pekerjaan_ayah: 'Petani',
      nama_ibu: 'Tri Mulyani',
      pekerjaan_ibu: 'Pedagang',
    },
    data_berkas: {},
  },
  {
    id: 'student-3',
    user_id: 'user-student-3',
    nik: '3325028202892777',
    nama_lengkap: 'Muhammad Rizky Pratama',
    jurusan_pilihan: 'TJKT',
    no_wa: '087812345678',
    status_pendaftaran: 'Terverifikasi',
    nomor_pendaftaran: '2026478',
    tanggal_daftar: '23-09-2026 10:30',
    data_diri: {
      nisn: '8729207777',
      nik: '3325028202892777',
      nama_lengkap: 'Muhammad Rizky Pratama',
      tempat_lahir: 'Batang',
      tanggal_lahir: '2008-01-18',
      jenis_kelamin: 'Laki-laki',
      agama: 'Islam',
      no_hp: '087812345678',
      asal_sekolah: 'MTs Muhammadiyah Bawang',
      ukuran_baju: 'XL',
    },
    data_alamat: {
      dukuh: 'Pangempon',
      rt: '03',
      rw: '02',
      provinsi: 'Jawa Tengah',
      kabupaten: 'Kabupaten Batang',
      kecamatan: 'Bawang',
      desa: 'Pangempon',
      kode_pos: '51274',
      tinggal_bersama: 'Orang Tua',
      transportasi: 'Sepeda Motor',
    },
    data_orang_tua: {
      nama_ayah: 'Ahmad Fauzi',
      pekerjaan_ayah: 'Guru / Tenaga Pengajar',
      nama_ibu: 'Nur Hasanah',
      pekerjaan_ibu: 'PNS',
    },
    data_berkas: {},
  }
];

export const SUPABASE_SQL_SCHEMA = `-- ==========================================
-- SKEMA SUPABASE UNTUK SPDB SMK MUHAMMADIYAH BAWANG
-- Jalankan di: Supabase SQL Editor
-- ==========================================

-- 1. Tabel users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nik VARCHAR(20) UNIQUE NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('admin', 'student')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabel students
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  nik VARCHAR(20) UNIQUE NOT NULL,
  nama_lengkap VARCHAR(255) NOT NULL,
  jurusan_pilihan VARCHAR(10) NOT NULL CHECK (jurusan_pilihan IN ('TO', 'TJKT', 'AKL')),
  no_wa VARCHAR(20) NOT NULL,
  status_pendaftaran VARCHAR(30) DEFAULT 'Berkas Fisik',
  nomor_pendaftaran VARCHAR(20) UNIQUE NOT NULL,
  tanggal_daftar VARCHAR(50) NOT NULL,
  catatan_admin TEXT,
  data_diri JSONB DEFAULT '{}'::jsonb,
  data_alamat JSONB DEFAULT '{}'::jsonb,
  data_orang_tua JSONB DEFAULT '{}'::jsonb,
  data_berkas JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabel pembayaran (opsional)
CREATE TABLE IF NOT EXISTS public.pembayaran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  nik VARCHAR(20) NOT NULL,
  nominal NUMERIC NOT NULL,
  metode VARCHAR(50) NOT NULL,
  bukti_url TEXT,
  status VARCHAR(30) DEFAULT 'Menunggu Verifikasi',
  tanggal_bayar TIMESTAMPTZ DEFAULT now(),
  keterangan TEXT
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pembayaran ENABLE ROW LEVEL SECURITY;

-- Policy sederhana untuk SPDB
CREATE POLICY "Public Read/Write users" ON public.users FOR ALL USING (true);
CREATE POLICY "Public Read/Write students" ON public.students FOR ALL USING (true);
CREATE POLICY "Public Read/Write pembayaran" ON public.pembayaran FOR ALL USING (true);
`;

class DatabaseService {
  private supabase: SupabaseClient | null = null;
  private usersKey = 'smk_muhiba_users';
  private studentsKey = 'smk_muhiba_students';
  private configKey = 'smk_muhiba_supabase_config';

  constructor() {
    this.initLocalData();
    this.initSupabaseFromEnvOrStorage();
  }

  private initLocalData() {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(this.usersKey)) {
      localStorage.setItem(this.usersKey, JSON.stringify(SEED_USERS));
    }
    if (!localStorage.getItem(this.studentsKey)) {
      localStorage.setItem(this.studentsKey, JSON.stringify(SEED_STUDENTS));
    }
  }

  public initSupabaseFromEnvOrStorage() {
    const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    let url = envUrl;
    let key = envKey;

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.configKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.url && parsed.key) {
            url = parsed.url;
            key = parsed.key;
          }
        } catch {
          // ignore
        }
      }
    }

    if (url && key) {
      try {
        this.supabase = createClient(url, key);
      } catch (err) {
        console.error('Failed to init Supabase client:', err);
        this.supabase = null;
      }
    }
  }

  public getSupabaseClient(): SupabaseClient | null {
    return this.supabase;
  }

  public isSupabaseConnected(): boolean {
    return !!this.supabase;
  }

  public saveSupabaseConfig(url: string, key: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.configKey, JSON.stringify({ url, key }));
      this.initSupabaseFromEnvOrStorage();
    }
  }

  public getStoredSupabaseConfig(): { url: string; key: string } {
    if (typeof window === 'undefined') return { url: '', key: '' };
    const stored = localStorage.getItem(this.configKey);
    if (!stored) {
      return {
        url: import.meta.env.VITE_SUPABASE_URL || '',
        key: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
      };
    }
    try {
      return JSON.parse(stored);
    } catch {
      return { url: '', key: '' };
    }
  }

  // --- LOCAL REPOSITORY HELPERS ---
  private getLocalUsers(): User[] {
    if (typeof window === 'undefined') return SEED_USERS;
    const str = localStorage.getItem(this.usersKey);
    return str ? JSON.parse(str) : SEED_USERS;
  }

  private saveLocalUsers(users: User[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.usersKey, JSON.stringify(users));
  }

  private getLocalStudents(): Student[] {
    if (typeof window === 'undefined') return SEED_STUDENTS;
    const str = localStorage.getItem(this.studentsKey);
    return str ? JSON.parse(str) : SEED_STUDENTS;
  }

  private saveLocalStudents(students: Student[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.studentsKey, JSON.stringify(students));
  }

  // --- CRUD API ---

  public async register(payload: {
    nik: string;
    nama_lengkap: string;
    jurusan_pilihan: JurusanType;
    no_wa: string;
    password: string;
  }): Promise<{ user: User; student: Student }> {
    const cleanNik = payload.nik.trim();
    const users = this.getLocalUsers();
    const students = this.getLocalStudents();

    // Check if NIK already registered
    const existingUser = users.find(u => u.nik === cleanNik);
    if (existingUser) {
      throw new Error(`NIK ${cleanNik} sudah terdaftar. Silakan login atau hubungi panitia.`);
    }

    const userId = 'usr-' + Date.now();
    const studentId = 'std-' + Date.now();
    
    // Generate consecutive-like registration number (e.g. 2026479)
    const baseNumber = 2026470 + students.length + 1;
    const nomorPendaftaran = baseNumber.toString();

    // Format Indonesian timestamp: DD-MM-YYYY HH:mm
    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newUser: User = {
      id: userId,
      nik: cleanNik,
      role: 'student',
      password_hash: payload.password,
      created_at: new Date().toISOString(),
    };

    const newStudent: Student = {
      id: studentId,
      user_id: userId,
      nik: cleanNik,
      nama_lengkap: payload.nama_lengkap.trim(),
      jurusan_pilihan: payload.jurusan_pilihan,
      no_wa: payload.no_wa.trim(),
      status_pendaftaran: 'Berkas Fisik',
      nomor_pendaftaran: nomorPendaftaran,
      tanggal_daftar: dateFormatted,
      data_diri: {
        nik: cleanNik,
        nama_lengkap: payload.nama_lengkap.trim(),
        no_hp: payload.no_wa.trim(),
      },
      data_alamat: {},
      data_orang_tua: {},
      data_berkas: {},
    };

    // Save locally
    users.push(newUser);
    students.push(newStudent);
    this.saveLocalUsers(users);
    this.saveLocalStudents(students);

    // Sync to Supabase if connected
    if (this.supabase) {
      try {
        await this.supabase.from('users').insert({
          id: userId,
          nik: cleanNik,
          role: 'student',
          password_hash: payload.password,
        });
        await this.supabase.from('students').insert({
          id: studentId,
          user_id: userId,
          nik: cleanNik,
          nama_lengkap: payload.nama_lengkap.trim(),
          jurusan_pilihan: payload.jurusan_pilihan,
          no_wa: payload.no_wa.trim(),
          status_pendaftaran: 'Berkas Fisik',
          nomor_pendaftaran: nomorPendaftaran,
          tanggal_daftar: dateFormatted,
          data_diri: newStudent.data_diri,
          data_alamat: {},
          data_orang_tua: {},
          data_berkas: {},
        });
      } catch (err) {
        console.warn('Supabase remote sync warning (using local fallback):', err);
      }
    }

    return { user: newUser, student: newStudent };
  }

  public async login(nik: string, password: string): Promise<{ user: User; student?: Student }> {
    const cleanNik = nik.trim();
    const cleanPassword = password.trim();

    // Try Supabase if connected first
    if (this.supabase) {
      try {
        const { data: userData, error: userErr } = await this.supabase
          .from('users')
          .select('*')
          .eq('nik', cleanNik)
          .single();

        if (userData && !userErr) {
          if (userData.password_hash === cleanPassword) {
            let studentData: Student | undefined;
            if (userData.role === 'student') {
              const { data: sData } = await this.supabase
                .from('students')
                .select('*')
                .eq('nik', cleanNik)
                .single();
              if (sData) studentData = sData as Student;
            }
            return { user: userData as User, student: studentData };
          } else {
            throw new Error('Password salah. Periksa kembali atau hubungi panitia PPDB.');
          }
        }
      } catch (err: any) {
        // Fallback to local if error wasn't invalid password
        if (err.message && err.message.includes('Password salah')) {
          throw err;
        }
      }
    }

    // Local check
    const users = this.getLocalUsers();
    // Allow 'admin' or direct match
    const user = users.find(u => u.nik.toLowerCase() === cleanNik.toLowerCase());

    if (!user) {
      // Special allowance for demo admin
      if (cleanNik.toLowerCase() === 'admin' && (cleanPassword === 'admin123' || cleanPassword === 'admin')) {
        const adminUser: User = {
          id: 'admin-auto',
          nik: 'admin',
          role: 'admin',
          password_hash: cleanPassword,
          created_at: new Date().toISOString()
        };
        return { user: adminUser };
      }
      throw new Error(`NIK / Username "${cleanNik}" tidak ditemukan.`);
    }

    if (user.password_hash !== cleanPassword) {
      throw new Error('Password yang Anda masukkan salah. Hubungi panitia jika lupa password.');
    }

    let student: Student | undefined;
    if (user.role === 'student') {
      const students = this.getLocalStudents();
      student = students.find(s => s.nik === user.nik || s.nomor_pendaftaran === user.nik);
    }

    return { user, student };
  }

  public getStudentByNik(nik: string): Student | undefined {
    const students = this.getLocalStudents();
    return students.find(s => s.nik === nik || s.nomor_pendaftaran === nik);
  }

  public getAllStudents(): Student[] {
    return this.getLocalStudents();
  }

  public async updateStudentDataDiri(
    nik: string,
    dataDiri: Partial<Student['data_diri']>,
    jurusan?: JurusanType,
    ukuranBaju?: string,
    kodeReferal?: string
  ): Promise<Student> {
    const students = this.getLocalStudents();
    const idx = students.findIndex(s => s.nik === nik || s.nomor_pendaftaran === nik);
    if (idx === -1) throw new Error('Data calon peserta didik tidak ditemukan.');

    const updated = { ...students[idx] };
    updated.data_diri = {
      ...updated.data_diri,
      ...dataDiri,
      ukuran_baju: ukuranBaju || updated.data_diri?.ukuran_baju,
      kode_referal: kodeReferal || updated.data_diri?.kode_referal,
    };
    if (jurusan) {
      updated.jurusan_pilihan = jurusan;
    }
    if (dataDiri.nama_lengkap) {
      updated.nama_lengkap = dataDiri.nama_lengkap;
    }
    if (dataDiri.no_hp) {
      updated.no_wa = dataDiri.no_hp;
    }

    students[idx] = updated;
    this.saveLocalStudents(students);

    if (this.supabase) {
      try {
        await this.supabase
          .from('students')
          .update({
            nama_lengkap: updated.nama_lengkap,
            jurusan_pilihan: updated.jurusan_pilihan,
            no_wa: updated.no_wa,
            data_diri: updated.data_diri,
          })
          .eq('nik', updated.nik);
      } catch (err) {
        console.warn('Supabase update warning:', err);
      }
    }

    return updated;
  }

  public async updateStudentDataAlamat(nik: string, dataAlamat: Student['data_alamat']): Promise<Student> {
    const students = this.getLocalStudents();
    const idx = students.findIndex(s => s.nik === nik || s.nomor_pendaftaran === nik);
    if (idx === -1) throw new Error('Data calon peserta didik tidak ditemukan.');

    students[idx].data_alamat = { ...students[idx].data_alamat, ...dataAlamat };
    this.saveLocalStudents(students);

    if (this.supabase) {
      try {
        await this.supabase
          .from('students')
          .update({ data_alamat: students[idx].data_alamat })
          .eq('nik', students[idx].nik);
      } catch (err) {
        console.warn('Supabase update warning:', err);
      }
    }

    return students[idx];
  }

  public async updateStudentDataOrangTua(nik: string, dataOrangTua: Student['data_orang_tua']): Promise<Student> {
    const students = this.getLocalStudents();
    const idx = students.findIndex(s => s.nik === nik || s.nomor_pendaftaran === nik);
    if (idx === -1) throw new Error('Data calon peserta didik tidak ditemukan.');

    students[idx].data_orang_tua = { ...students[idx].data_orang_tua, ...dataOrangTua };
    this.saveLocalStudents(students);

    if (this.supabase) {
      try {
        await this.supabase
          .from('students')
          .update({ data_orang_tua: students[idx].data_orang_tua })
          .eq('nik', students[idx].nik);
      } catch (err) {
        console.warn('Supabase update warning:', err);
      }
    }

    return students[idx];
  }

  public async updateStudentDataBerkas(nik: string, dataBerkas: Student['data_berkas']): Promise<Student> {
    const students = this.getLocalStudents();
    const idx = students.findIndex(s => s.nik === nik || s.nomor_pendaftaran === nik);
    if (idx === -1) throw new Error('Data calon peserta didik tidak ditemukan.');

    students[idx].data_berkas = { ...students[idx].data_berkas, ...dataBerkas };
    
    // Automatically promote status if all files/forms ready
    if (students[idx].status_pendaftaran === 'Belum Lengkap' || students[idx].status_pendaftaran === 'Berkas Fisik') {
      students[idx].status_pendaftaran = 'Menunggu Verifikasi';
    }

    this.saveLocalStudents(students);

    if (this.supabase) {
      try {
        await this.supabase
          .from('students')
          .update({
            data_berkas: students[idx].data_berkas,
            status_pendaftaran: students[idx].status_pendaftaran,
          })
          .eq('nik', students[idx].nik);
      } catch (err) {
        console.warn('Supabase update warning:', err);
      }
    }

    return students[idx];
  }

  public async updateStudentStatus(nik: string, status: StatusPendaftaran, catatan?: string): Promise<Student> {
    const students = this.getLocalStudents();
    const idx = students.findIndex(s => s.nik === nik || s.nomor_pendaftaran === nik);
    if (idx === -1) throw new Error('Data calon peserta didik tidak ditemukan.');

    students[idx].status_pendaftaran = status;
    if (catatan !== undefined) {
      students[idx].catatan_admin = catatan;
    }
    this.saveLocalStudents(students);

    if (this.supabase) {
      try {
        await this.supabase
          .from('students')
          .update({
            status_pendaftaran: status,
            catatan_admin: catatan,
          })
          .eq('nik', students[idx].nik);
      } catch (err) {
        console.warn('Supabase update warning:', err);
      }
    }

    return students[idx];
  }

  public async deleteStudent(nik: string): Promise<void> {
    const students = this.getLocalStudents().filter(s => s.nik !== nik && s.nomor_pendaftaran !== nik);
    const users = this.getLocalUsers().filter(u => u.nik !== nik);
    this.saveLocalStudents(students);
    this.saveLocalUsers(users);

    if (this.supabase) {
      try {
        await this.supabase.from('students').delete().eq('nik', nik);
        await this.supabase.from('users').delete().eq('nik', nik);
      } catch (err) {
        console.warn('Supabase delete warning:', err);
      }
    }
  }

  public getPembayaran(nik: string): Pembayaran[] {
    const key = `pembayaran_${nik}`;
    const stored = localStorage.getItem(key);
    if (!stored) {
      return [
        {
          id: 'pay-1',
          student_id: nik,
          nik: nik,
          nominal: 350000,
          metode: 'Transfer Bank Jateng / Loket Sekolah',
          status: 'Lunas',
          tanggal_bayar: '25-09-2026',
          keterangan: 'Biaya Seragam & Atribut Sekolah (Gelombang 1 Bebas Formulir)',
        }
      ];
    }
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  public savePembayaran(pembayaran: Pembayaran) {
    const key = `pembayaran_${pembayaran.nik}`;
    const existing = this.getPembayaran(pembayaran.nik);
    existing.push(pembayaran);
    localStorage.setItem(key, JSON.stringify(existing));
  }
}

export const dbService = new DatabaseService();
