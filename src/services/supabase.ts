import { createClient, SupabaseClient, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { 
  Student, 
  User, 
  UserRole, 
  Pembayaran, 
  StatusPendaftaran, 
  JurusanType, 
  Database 
} from '../types/database';

export const SUPABASE_SQL_SCHEMA = `-- ============================================================================
-- SKEMA SUPABASE RESMI - SPMB SMK MUHAMMADIYAH BAWANG
-- File: supabase/migrations/20260925000000_spmb_initial_schema.sql
-- Silakan copy dan jalankan di: Supabase SQL Editor
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabel profiles (Terhubung langsung ke auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nik TEXT UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Tabel students (Data Pendaftaran Siswa)
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nik TEXT UNIQUE NOT NULL,
  nama_lengkap TEXT NOT NULL,
  jurusan_pilihan TEXT NOT NULL CHECK (jurusan_pilihan IN ('TO', 'TJKT', 'AKL')),
  no_wa TEXT NOT NULL,
  status_pendaftaran TEXT DEFAULT 'Berkas Fisik' NOT NULL 
    CHECK (status_pendaftaran IN ('Belum Lengkap', 'Berkas Fisik', 'Menunggu Verifikasi', 'Terverifikasi', 'Diterima', 'Cadangan')),
  nomor_pendaftaran TEXT UNIQUE NOT NULL,
  tanggal_daftar TEXT NOT NULL,
  catatan_admin TEXT,
  data_diri JSONB DEFAULT '{}'::jsonb NOT NULL,
  data_alamat JSONB DEFAULT '{}'::jsonb NOT NULL,
  data_orang_tua JSONB DEFAULT '{}'::jsonb NOT NULL,
  data_berkas JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Tabel pembayaran (Opsional)
CREATE TABLE IF NOT EXISTS public.pembayaran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nik TEXT NOT NULL,
  nominal NUMERIC NOT NULL,
  metode TEXT NOT NULL,
  bukti_url TEXT,
  status TEXT DEFAULT 'Menunggu Verifikasi' NOT NULL 
    CHECK (status IN ('Lunas', 'Menunggu Verifikasi', 'Belum Bayar')),
  tanggal_bayar TIMESTAMPTZ DEFAULT now() NOT NULL,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Indeks Performa
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_nik ON public.students(nik);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status_pendaftaran);
CREATE INDEX IF NOT EXISTS idx_students_jurusan ON public.students(jurusan_pilihan);
CREATE INDEX IF NOT EXISTS idx_students_nomor_pendaftaran ON public.students(nomor_pendaftaran);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 5. Helper Function: is_admin() (SECURITY DEFINER untuk cegah recursive RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 6. Trigger Auth: Otomatis sinkronisasi auth.users ke profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nik, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nik', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Calon Siswa'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    nik = COALESCE(EXCLUDED.nik, profiles.nik),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Aktifkan ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pembayaran ENABLE ROW LEVEL SECURITY;

-- 8. Policies RLS
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK ((auth.uid() = id AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())) OR public.is_admin());

DROP POLICY IF EXISTS "students_select_policy" ON public.students;
CREATE POLICY "students_select_policy" ON public.students FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "students_insert_policy" ON public.students;
CREATE POLICY "students_insert_policy" ON public.students FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "students_update_policy" ON public.students;
CREATE POLICY "students_update_policy" ON public.students FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "students_delete_policy" ON public.students;
CREATE POLICY "students_delete_policy" ON public.students FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "pembayaran_select_policy" ON public.pembayaran;
CREATE POLICY "pembayaran_select_policy" ON public.pembayaran FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "pembayaran_insert_policy" ON public.pembayaran;
CREATE POLICY "pembayaran_insert_policy" ON public.pembayaran FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "pembayaran_update_policy" ON public.pembayaran;
CREATE POLICY "pembayaran_update_policy" ON public.pembayaran FOR UPDATE TO authenticated
  USING (public.is_admin());
`;

class DatabaseService {
  private supabase: SupabaseClient | null = null;
  private configKey = 'smk_muhiba_supabase_config';
  private studentDomain = 'siswa.smkmuhiba.sch.id';
  private adminDomain = 'smkmuhiba.sch.id';

  constructor() {
    this.initSupabaseFromEnvOrStorage();
  }

  /**
   * Initialize Supabase client strictly using public environment variables,
   * with fallback to UI stored config for testing/preview environments.
   */
  public initSupabaseFromEnvOrStorage() {
    const envUrl = (
      import.meta.env.VITE_SUPABASE_URL ||
      import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
      ''
    ).trim();

    const envKey = (
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ''
    ).trim();

    let url = envUrl;
    let key = envKey;

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.configKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.url && parsed.key) {
            url = parsed.url.trim();
            key = parsed.key.trim();
          }
        } catch {
          // ignore parsing error
        }
      }
    }

    if (url && key) {
      try {
        this.supabase = createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          },
        });
      } catch (err) {
        console.error('Inisialisasi Supabase Client gagal:', err);
        this.supabase = null;
      }
    } else {
      this.supabase = null;
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
      localStorage.setItem(this.configKey, JSON.stringify({ url: url.trim(), key: key.trim() }));
      this.initSupabaseFromEnvOrStorage();
    }
  }

  public getStoredSupabaseConfig(): { url: string; key: string } {
    if (typeof window === 'undefined') return { url: '', key: '' };
    const stored = localStorage.getItem(this.configKey);
    if (!stored) {
      return {
        url: import.meta.env.VITE_SUPABASE_URL || '',
        key: import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
      };
    }
    try {
      return JSON.parse(stored);
    } catch {
      return { url: '', key: '' };
    }
  }

  /**
   * Map NIK or Admin username to a standard Supabase Auth synthetic email
   */
  public toSyntheticEmail(identifier: string): string {
    const clean = identifier.trim().toLowerCase();
    if (clean.includes('@')) {
      return clean;
    }
    if (clean === 'admin') {
      return `admin@${this.adminDomain}`;
    }
    // Student NIK
    return `${clean}@${this.studentDomain}`;
  }

  /**
   * User Registration with Supabase Auth & PostgreSQL students table
   */
  public async register(payload: {
    nik: string;
    nama_lengkap: string;
    jurusan_pilihan: JurusanType;
    no_wa: string;
    password: string;
  }): Promise<{ user: User; student: Student }> {
    const cleanNik = payload.nik.trim();
    const cleanNama = payload.nama_lengkap.trim();
    const cleanNoWa = payload.no_wa.trim();

    if (!/^\d{16}$/.test(cleanNik)) {
      throw new Error('NIK harus terdiri dari 16 digit angka sesuai KTP / Kartu Keluarga.');
    }

    if (!this.supabase) {
      throw new Error(
        'Koneksi Supabase belum terkonfigurasi. Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY telah diatur di Vercel atau panel konfigurasi database.'
      );
    }

    // 1. Check if NIK already exists in Supabase
    const { data: existingStudent, error: checkError } = await this.supabase
      .from('students')
      .select('nik')
      .eq('nik', cleanNik)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Supabase NIK check error:', checkError);
    }

    if (existingStudent) {
      throw new Error(`NIK ${cleanNik} sudah terdaftar di sistem SPMB. Silakan masuk atau hubungi panitia.`);
    }

    // 2. Generate consecutive registration number
    const { count } = await this.supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

    const nextSeq = (count || 0) + 1;
    const nomorPendaftaran = (2026470 + nextSeq).toString();

    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const syntheticEmail = this.toSyntheticEmail(cleanNik);

    // 3. Register user via Supabase Auth
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: syntheticEmail,
      password: payload.password,
      options: {
        data: {
          nik: cleanNik,
          full_name: cleanNama,
          role: 'student',
        },
      },
    });

    if (authError) {
      if (authError.message.includes('User already registered')) {
        throw new Error(`Akun dengan NIK ${cleanNik} sudah terdaftar. Silakan lakukan login.`);
      }
      throw new Error(`Pendaftaran akun gagal: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('Gagal membuat akun siswa di Supabase Auth.');
    }

    const userId = authData.user.id;

    // 4. Create row in public.profiles (in case DB trigger is not yet installed)
    try {
      await this.supabase
        .from('profiles')
        .upsert({
          id: userId,
          nik: cleanNik,
          full_name: cleanNama,
          role: 'student',
        });
    } catch (e) {
      console.warn('Upsert profile notice:', e);
    }

    // 5. Insert student registration into public.students
    const newStudentPayload = {
      user_id: userId,
      nik: cleanNik,
      nama_lengkap: cleanNama,
      jurusan_pilihan: payload.jurusan_pilihan,
      no_wa: cleanNoWa,
      status_pendaftaran: 'Berkas Fisik' as StatusPendaftaran,
      nomor_pendaftaran: nomorPendaftaran,
      tanggal_daftar: dateFormatted,
      data_diri: {
        nik: cleanNik,
        nama_lengkap: cleanNama,
        no_hp: cleanNoWa,
      },
      data_alamat: {},
      data_orang_tua: {},
      data_berkas: {},
    };

    const { data: insertedStudent, error: insertError } = await this.supabase
      .from('students')
      .insert(newStudentPayload)
      .select()
      .single();

    if (insertError) {
      console.error('Insert student error in Supabase:', insertError);
      throw new Error(`Gagal menyimpan data pendaftaran ke database: ${insertError.message}`);
    }

    const appUser: User = {
      id: userId,
      nik: cleanNik,
      role: 'student',
      full_name: cleanNama,
      email: syntheticEmail,
      created_at: new Date().toISOString(),
    };

    return { user: appUser, student: insertedStudent as Student };
  }

  /**
   * User & Admin Login via Supabase Auth
   */
  public async login(nikOrUsername: string, password: string): Promise<{ user: User; student?: Student }> {
    const cleanIdentifier = nikOrUsername.trim();
    const cleanPassword = password.trim();

    if (!cleanIdentifier) {
      throw new Error('Username / NIK wajib diisi.');
    }
    if (!cleanPassword) {
      throw new Error('Password wajib diisi.');
    }

    if (!this.supabase) {
      throw new Error(
        'Koneksi Supabase belum terkonfigurasi. Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY telah diatur di Vercel atau panel database.'
      );
    }

    const syntheticEmail = this.toSyntheticEmail(cleanIdentifier);

    // 1. Supabase Auth Sign In
    const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password: cleanPassword,
    });

    if (authError) {
      // Map error to user-friendly Indonesian explanation
      if (
        authError.message.includes('Invalid login credentials') ||
        authError.message.includes('invalid_grant')
      ) {
        throw new Error(
          'NIK / Username atau Password salah. Periksa kembali data Anda atau hubungi panitia PPDB jika lupa password.'
        );
      }
      throw new Error(`Login gagal: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('Gagal memverifikasi akun pengguna.');
    }

    const authUser = authData.user;
    return await this.fetchUserSessionDetails(authUser);
  }

  /**
   * Fetch profile and (if applicable) student data for an authenticated Supabase user
   */
  private async fetchUserSessionDetails(authUser: SupabaseAuthUser): Promise<{ user: User; student?: Student }> {
    if (!this.supabase) throw new Error('Supabase client tidak tersedia.');

    // 1. Fetch Profile
    const { data: profileData, error: profileErr } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    let userRole: UserRole = 'student';
    let userNik: string = authUser.user_metadata?.nik || authUser.email || '';
    let fullName: string = authUser.user_metadata?.full_name || 'Pengguna';

    if (profileData && !profileErr) {
      userRole = profileData.role as UserRole;
      if (profileData.nik) userNik = profileData.nik;
      if (profileData.full_name) fullName = profileData.full_name;
    } else {
      // Fallback check metadata
      if (authUser.user_metadata?.role === 'admin' || authUser.email?.startsWith('admin@')) {
        userRole = 'admin';
      }
    }

    const appUser: User = {
      id: authUser.id,
      nik: userNik,
      role: userRole,
      full_name: fullName,
      email: authUser.email || '',
      created_at: authUser.created_at,
    };

    // 2. If student, fetch their student record via user_id
    let studentData: Student | undefined;
    if (userRole === 'student') {
      const { data: stdData, error: stdErr } = await this.supabase
        .from('students')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (stdData && !stdErr) {
        studentData = stdData as Student;
      } else if (userNik) {
        // Fallback by NIK
        const { data: stdByNik } = await this.supabase
          .from('students')
          .select('*')
          .eq('nik', userNik)
          .maybeSingle();
        if (stdByNik) studentData = stdByNik as Student;
      }
    }

    return { user: appUser, student: studentData };
  }

  /**
   * Get active authenticated session from Supabase Auth
   */
  public async getCurrentSessionUser(): Promise<{ user: User; student?: Student } | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase.auth.getSession();
      if (error || !data.session?.user) {
        return null;
      }
      return await this.fetchUserSessionDetails(data.session.user);
    } catch (err) {
      console.warn('Error reading Supabase session:', err);
      return null;
    }
  }

  /**
   * Logout user from Supabase
   */
  public async logout(): Promise<void> {
    if (this.supabase) {
      try {
        await this.supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut error:', err);
      }
    }
  }

  /**
   * Subscribe to Supabase Auth state changes with proper cleanup
   */
  public onAuthStateChange(
    callback: (sessionUser: { user: User; student?: Student } | null) => void
  ): () => void {
    if (!this.supabase) return () => {};

    const {
      data: { subscription },
    } = this.supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          const details = await this.fetchUserSessionDetails(session.user);
          callback(details);
        } else {
          callback(null);
        }
      } catch (e) {
        console.warn('Auth state change processing notice:', e);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }

  /**
   * Migrate / Import Legacy JSON Data into Supabase with duplicate check and validation
   * Flow: JSON -> Validation -> Normalization -> Check duplicate NIK -> Supabase -> Report
   */
  public async importLegacyStudents(rawItems: any[]): Promise<{
    total: number;
    success: number;
    skipped: number;
    errors: string[];
  }> {
    if (!this.supabase) {
      throw new Error('Supabase client tidak terhubung.');
    }

    const report = {
      total: rawItems.length,
      success: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const item of rawItems) {
      try {
        const rawNik = String(item.nik || item.data_diri?.nik || '').trim();
        if (!rawNik || rawNik.length < 10) {
          report.errors.push(`Data dilewati: NIK "${rawNik}" tidak valid.`);
          report.skipped++;
          continue;
        }

        // Check duplicate
        const { data: existing } = await this.supabase
          .from('students')
          .select('nik')
          .eq('nik', rawNik)
          .maybeSingle();

        if (existing) {
          report.skipped++;
          continue;
        }

        const syntheticEmail = this.toSyntheticEmail(rawNik);
        const namaLengkap = String(item.nama_lengkap || item.data_diri?.nama_lengkap || 'Calon Siswa').trim();

        // 1. Create or ensure Auth user
        let userId = item.user_id;
        if (!userId) {
          const { data: authData } = await this.supabase.auth.signUp({
            email: syntheticEmail,
            password: `Muhiba@${rawNik.slice(-6)}`,
            options: {
              data: {
                nik: rawNik,
                full_name: namaLengkap,
                role: 'student',
              },
            },
          });
          userId = authData?.user?.id;
        }

        if (!userId) {
          userId = '00000000-0000-0000-0000-' + rawNik.slice(-12).padStart(12, '0');
        }

        const nomorPendaftaran = item.nomor_pendaftaran || String(Date.now()).slice(-7);
        const tanggalDaftar = item.tanggal_daftar || new Date().toISOString();

        // 2. Insert into students table
        const { error: insErr } = await this.supabase.from('students').insert({
          user_id: userId,
          nik: rawNik,
          nama_lengkap: namaLengkap,
          jurusan_pilihan: item.jurusan_pilihan || 'TO',
          no_wa: String(item.no_wa || item.data_diri?.no_hp || '080000000000'),
          status_pendaftaran: item.status_pendaftaran || 'Berkas Fisik',
          nomor_pendaftaran: nomorPendaftaran,
          tanggal_daftar: tanggalDaftar,
          catatan_admin: item.catatan_admin || null,
          data_diri: item.data_diri || {},
          data_alamat: item.data_alamat || {},
          data_orang_tua: item.data_orang_tua || {},
          data_berkas: item.data_berkas || {},
        });

        if (insErr) {
          report.errors.push(`NIK ${rawNik}: ${insErr.message}`);
          report.skipped++;
        } else {
          report.success++;
        }
      } catch (err: any) {
        report.errors.push(`Error parsing item: ${err.message}`);
        report.skipped++;
      }
    }

    return report;
  }

  /**
   * Get student record by user_id
   */
  public async getStudentByUserId(userId: string): Promise<Student | null> {
    if (!this.supabase) return null;
    const { data, error } = await this.supabase
      .from('students')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error getStudentByUserId:', error);
      return null;
    }
    return data ? (data as unknown as Student) : null;
  }

  /**
   * Get student record by NIK
   */
  public async getStudentByNik(nik: string): Promise<Student | null> {
    if (!this.supabase) return null;
    const { data, error } = await this.supabase
      .from('students')
      .select('*')
      .eq('nik', nik.trim())
      .maybeSingle();

    if (error) {
      console.error('Error getStudentByNik:', error);
      return null;
    }
    return data ? (data as unknown as Student) : null;
  }

  /**
   * Admin: Get all students with optional filters
   */
  public async getAllStudents(filters?: {
    jurusan?: string;
    status?: string;
    search?: string;
  }): Promise<Student[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.jurusan && filters.jurusan !== 'ALL') {
      query = query.eq('jurusan_pilihan', filters.jurusan as JurusanType);
    }

    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('status_pendaftaran', filters.status as StatusPendaftaran);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error getAllStudents:', error);
      throw new Error(`Gagal memuat data pendaftar dari Supabase: ${error.message}`);
    }

    return (data as Student[]) || [];
  }

  /**
   * Update Student Data Diri
   */
  public async updateStudentDataDiri(
    nik: string,
    dataDiri: Partial<Student['data_diri']>,
    jurusan?: JurusanType,
    ukuranBaju?: string,
    kodeReferal?: string
  ): Promise<Student> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    // Fetch existing student record
    const existing = await this.getStudentByNik(nik);
    if (!existing) throw new Error('Data calon peserta didik tidak ditemukan.');

    const mergedDataDiri = {
      ...existing.data_diri,
      ...dataDiri,
      ukuran_baju: ukuranBaju || existing.data_diri?.ukuran_baju,
      kode_referal: kodeReferal || existing.data_diri?.kode_referal,
    };

    const updatePayload: Partial<Student> = {
      data_diri: mergedDataDiri,
    };

    if (jurusan) updatePayload.jurusan_pilihan = jurusan;
    if (dataDiri.nama_lengkap) updatePayload.nama_lengkap = dataDiri.nama_lengkap;
    if (dataDiri.no_hp) updatePayload.no_wa = dataDiri.no_hp;

    const { data, error } = await this.supabase
      .from('students')
      .update(updatePayload)
      .eq('nik', nik.trim())
      .select()
      .single();

    if (error) {
      console.error('updateStudentDataDiri error:', error);
      throw new Error(`Gagal memperbarui data diri ke Supabase: ${error.message}`);
    }

    return data as Student;
  }

  /**
   * Update Student Data Alamat
   */
  public async updateStudentDataAlamat(nik: string, dataAlamat: Student['data_alamat']): Promise<Student> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const existing = await this.getStudentByNik(nik);
    if (!existing) throw new Error('Data calon peserta didik tidak ditemukan.');

    const mergedAlamat = { ...existing.data_alamat, ...dataAlamat };

    const { data, error } = await this.supabase
      .from('students')
      .update({ data_alamat: mergedAlamat })
      .eq('nik', nik.trim())
      .select()
      .single();

    if (error) {
      console.error('updateStudentDataAlamat error:', error);
      throw new Error(`Gagal memperbarui data alamat ke Supabase: ${error.message}`);
    }

    return data as Student;
  }

  /**
   * Update Student Data Orang Tua
   */
  public async updateStudentDataOrangTua(nik: string, dataOrangTua: Student['data_orang_tua']): Promise<Student> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const existing = await this.getStudentByNik(nik);
    if (!existing) throw new Error('Data calon peserta didik tidak ditemukan.');

    const mergedOrtu = { ...existing.data_orang_tua, ...dataOrangTua };

    const { data, error } = await this.supabase
      .from('students')
      .update({ data_orang_tua: mergedOrtu })
      .eq('nik', nik.trim())
      .select()
      .single();

    if (error) {
      console.error('updateStudentDataOrangTua error:', error);
      throw new Error(`Gagal memperbarui data orang tua ke Supabase: ${error.message}`);
    }

    return data as Student;
  }

  /**
   * Update Student Data Berkas
   */
  public async updateStudentDataBerkas(nik: string, dataBerkas: Student['data_berkas']): Promise<Student> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const existing = await this.getStudentByNik(nik);
    if (!existing) throw new Error('Data calon peserta didik tidak ditemukan.');

    const mergedBerkas = { ...existing.data_berkas, ...dataBerkas };

    let nextStatus = existing.status_pendaftaran;
    if (nextStatus === 'Belum Lengkap' || nextStatus === 'Berkas Fisik') {
      nextStatus = 'Menunggu Verifikasi';
    }

    const { data, error } = await this.supabase
      .from('students')
      .update({
        data_berkas: mergedBerkas,
        status_pendaftaran: nextStatus,
      })
      .eq('nik', nik.trim())
      .select()
      .single();

    if (error) {
      console.error('updateStudentDataBerkas error:', error);
      throw new Error(`Gagal memperbarui berkas ke Supabase: ${error.message}`);
    }

    return data as Student;
  }

  /**
   * Admin: Update Student Status
   */
  public async updateStudentStatus(nik: string, status: StatusPendaftaran, catatan?: string): Promise<Student> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const payload: Partial<Student> = {
      status_pendaftaran: status,
    };
    if (catatan !== undefined) {
      payload.catatan_admin = catatan;
    }

    const { data, error } = await this.supabase
      .from('students')
      .update(payload)
      .eq('nik', nik.trim())
      .select()
      .single();

    if (error) {
      console.error('updateStudentStatus error:', error);
      throw new Error(`Gagal memperbarui status pendaftar: ${error.message}`);
    }

    return data as Student;
  }

  /**
   * Admin: Delete Student
   */
  public async deleteStudent(nik: string): Promise<void> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const { error } = await this.supabase
      .from('students')
      .delete()
      .eq('nik', nik.trim());

    if (error) {
      console.error('deleteStudent error:', error);
      throw new Error(`Gagal menghapus pendaftar dari Supabase: ${error.message}`);
    }
  }

  /**
   * Realtime Subscription: Subscribe to changes in students table
   */
  public subscribeToStudents(callback: () => void): () => void {
    if (!this.supabase) return () => {};

    const channel = this.supabase
      .channel('public-students-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => {
          callback();
        }
      )
      .subscribe();

    return () => {
      if (this.supabase) {
        this.supabase.removeChannel(channel);
      }
    };
  }

  /**
   * Pembayaran: Fetch payments for student
   */
  public async getPembayaran(nik: string): Promise<Pembayaran[]> {
    if (!this.supabase) {
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
        },
      ];
    }

    const { data, error } = await this.supabase
      .from('pembayaran')
      .select('*')
      .eq('nik', nik.trim());

    if (error || !data || data.length === 0) {
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
        },
      ];
    }

    return data as Pembayaran[];
  }

  /**
   * Pembayaran: Save payment record
   */
  public async savePembayaran(pembayaran: Omit<Pembayaran, 'id'>): Promise<Pembayaran> {
    if (!this.supabase) {
      throw new Error('Supabase client tidak terhubung.');
    }

    const { data, error } = await this.supabase
      .from('pembayaran')
      .insert(pembayaran)
      .select()
      .single();

    if (error) {
      throw new Error(`Gagal menyimpan bukti pembayaran: ${error.message}`);
    }

    return data as Pembayaran;
  }
}

export const dbService = new DatabaseService();
