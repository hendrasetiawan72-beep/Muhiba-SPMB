import { createClient, SupabaseClient, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { 
  Student, 
  User, 
  UserRole, 
  StatusPendaftaran, 
  JurusanType, 
  DataBerkas
} from '../types/database';
import { uploadBerkasFile as uploadBerkas } from './uploadBerkas';

class DatabaseService {
  private supabase: SupabaseClient | null = null;
  private currentUrl: string = '';
  private currentAnonKey: string = '';

  constructor() {
    this.initSupabaseFromEnv();
  }

  /**
   * Initialize Supabase client strictly using public environment variables.
   */
  public initSupabaseFromEnv() {
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

    this.currentUrl = envUrl;
    this.currentAnonKey = envKey;

    if (envUrl && envKey) {
      try {
        this.supabase = createClient(envUrl, envKey, {
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

  public getClient(): SupabaseClient | null {
    return this.supabase;
  }

  public isConnected(): boolean {
    return Boolean(this.supabase);
  }

  public getUrl(): string {
    return this.currentUrl;
  }

  public getAnonKey(): string {
    return this.currentAnonKey;
  }

  /**
   * User Registration: Single path via /api/auth/register endpoint.
   * Supabase Admin API provisions the user with email_confirm: true on the server,
   * with Cloudflare Turnstile verification and IP rate limiting.
   */
  public async register(payload: {
    nik: string;
    nama_lengkap: string;
    jurusan_pilihan: JurusanType;
    no_wa: string;
    password: string;
    turnstileToken?: string;
  }): Promise<{ user: User; student: Student }> {
    const cleanNik = payload.nik.trim();
    if (!/^\d{16}$/.test(cleanNik)) {
      throw new Error('NIK harus terdiri dari 16 digit angka sesuai KTP / Kartu Keluarga.');
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get('content-type') || '';
      let result: any = null;

      if (contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error('[Registration] Non-JSON response:', text);
        throw new Error('Terjadi kesalahan pada server saat pendaftaran.');
      }

      if (!response.ok || !result.success) {
        const errMessage = result?.message || result?.error || 'Gagal melakukan pendaftaran.';
        const errObj = new Error(errMessage) as any;
        errObj.code = result?.code || 'SERVER_ERROR';
        throw errObj;
      }

      // If session tokens returned, set session in client SDK so auth.uid() is active
      if (result.session && this.supabase) {
        await this.supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
      }

      return { user: result.user, student: result.student };
    } catch (err: any) {
      console.error('[Registration] Registration process error:', err);
      throw err;
    }
  }

  /**
   * User & Admin Login via /api/auth/login (CAPTCHA + rate limit + auth di server).
   * Server mengembalikan session + user + student. Client hanya memasang sesi ke SDK
   * agar auth.uid() / RLS berjalan. Tidak ada lagi fallback baca-ulang dari DB.
   */
  public async login(
    nikOrUsername: string,
    password: string,
    captchaToken?: string
  ): Promise<{ user: User; student?: Student }> {
    const cleanIdentifier = nikOrUsername.trim();
    const cleanPassword = password.trim();

    if (!cleanIdentifier) throw new Error('Username / NIK wajib diisi.');
    if (!cleanPassword) throw new Error('Kata sandi wajib diisi.');
    if (!this.supabase) throw new Error('Supabase client belum terhubung.');

    let response: Response;
    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          identifier: cleanIdentifier,
          password: cleanPassword,
          turnstileToken: captchaToken || '',
        }),
      });
    } catch {
      throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
    }

    let result: any = null;
    try {
      result = await response.json();
    } catch {
      // respons bukan JSON → ditangani di bawah
    }

    if (!response.ok || !result?.success) {
      const fallbackMsg =
        response.status === 429
          ? 'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.'
          : 'Login gagal. Periksa NIK dan kata sandi.';
      const err = new Error(result?.error || result?.message || fallbackMsg) as Error & {
        code?: string;
      };
      err.code = result?.code || 'LOGIN_FAILED';
      throw err;
    }

    if (!result.session?.access_token || !result.session?.refresh_token || !result.user) {
      throw new Error('Login berhasil tetapi sesi tidak lengkap. Muat ulang halaman dan coba lagi.');
    }

    const { error: sessionError } = await this.supabase.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
    });
    if (sessionError) {
      throw new Error('Gagal memulai sesi. Silakan coba lagi.');
    }

    return {
      user: result.user as User,
      student: result.student as Student | undefined,
    };
  }

  /**
   * Fetch profile and student data for an authenticated Supabase user once.
   * Role is strictly verified from public.profiles in database.
   */
  public async fetchUserSessionDetails(authUser: SupabaseAuthUser): Promise<{ user: User; student?: Student }> {
    if (!this.supabase) throw new Error('Supabase client tidak tersedia.');

    // 1. Fetch Profile directly from database (source of truth for role)
    const { data: profileData, error: profileErr } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileErr) {
      console.warn('Error reading profile in session restore:', profileErr);
    }

    const userRole: UserRole = (profileData?.role === 'admin') ? 'admin' : 'student';
    const userNik: string = profileData?.nik || authUser.user_metadata?.nik || '';
    const fullName: string = profileData?.full_name || authUser.user_metadata?.full_name || 'Pengguna';

    const userObj: User = {
      id: authUser.id,
      nik: userNik,
      role: userRole,
      full_name: fullName,
      email: authUser.email || '',
      must_change_password: !!profileData?.must_change_password,
      created_at: authUser.created_at,
    };

    let studentData: Student | undefined = undefined;

    // 2. If student, fetch single student record
    if (userRole === 'student') {
      const { data: stdRecord, error: stdErr } = await this.supabase
        .from('students')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (stdErr) {
        console.warn('Error fetching student record:', stdErr);
      } else if (stdRecord) {
        studentData = stdRecord as Student;
      }
    }

    return { user: userObj, student: studentData };
  }

  /**
   * Restores active Supabase session on application startup
   */
  public async getCurrentSessionUser(): Promise<{ user: User; student?: Student } | null> {
    if (!this.supabase) return null;

    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (error || !session?.user) {
        return null;
      }
      return await this.fetchUserSessionDetails(session.user);
    } catch (err) {
      console.error('getCurrentSessionUser error:', err);
      return null;
    }
  }

  /**
   * Listens to Auth state changes and avoids deadlock by deferring Supabase queries with setTimeout
   */
  public onAuthStateChange(callback: (sessionData: { user: User; student?: Student } | null) => void): () => void {
    if (!this.supabase) return () => {};

    const { data: { subscription } } = this.supabase.auth.onAuthStateChange((_event, session) => {
      // Pindahkan query Supabase di dalam onAuthStateChange ke setTimeout(() => {...}, 0) agar tidak deadlock
      setTimeout(async () => {
        if (session && session.user) {
          try {
            const data = await this.fetchUserSessionDetails(session.user);
            callback(data);
          } catch (err) {
            console.error('Error fetching user session details in onAuthStateChange:', err);
            callback(null);
          }
        } else {
          callback(null);
        }
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  }

  /**
   * Sign Out
   */
  public async logout(): Promise<void> {
    if (this.supabase) {
      await this.supabase.auth.signOut();
    }
  }

  /**
   * Fetch Student by NIK
   */
  public async getStudentByNik(nik: string): Promise<Student | null> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const { data, error } = await this.supabase
      .from('students')
      .select('*')
      .eq('nik', nik.trim())
      .maybeSingle();

    if (error) {
      console.error('getStudentByNik error:', error);
      throw new Error(`Gagal memuat data siswa: ${error.message}`);
    }

    return (data as Student) || null;
  }

  /**
   * Fetch Single Student by ID
   */
  public async getStudentById(id: string): Promise<Student | null> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const { data, error } = await this.supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('getStudentById error:', error);
      throw new Error(`Gagal memuat detail data siswa: ${error.message}`);
    }

    return (data as Student) || null;
  }

  /**
   * Fetch all students (Admin overview)
   */
  public async getAllStudents(): Promise<Student[]> {
    return this.getStudentsForExport({});
  }

  /**
   * Server-side paginated list for Admin with search and filters
   */
  private static readonly STUDENT_LIST_COLUMNS =
    'id, user_id, nik, nama_lengkap, jurusan_pilihan, no_wa, status_pendaftaran, nomor_pendaftaran, tanggal_daftar, catatan_admin, created_at, updated_at, data_diri, data_alamat, data_orang_tua, data_berkas';

  private applyStudentFilters(query: any, f: { search?: string; jurusan?: string; status?: string }) {
    if (f.jurusan && f.jurusan !== 'ALL') query = query.eq('jurusan_pilihan', f.jurusan);
    if (f.status && f.status !== 'ALL') query = query.eq('status_pendaftaran', f.status);
    // Buang karakter yang bermakna di sintaks filter PostgREST (, ( ) dan wildcard
    const term = (f.search || '').trim().replace(/[,()%_*\\]/g, ' ').trim();
    if (term) {
      const q = `%${term}%`;
      query = query.or(
        `nama_lengkap.ilike.${q},nik.ilike.${q},nomor_pendaftaran.ilike.${q},data_diri->>asal_sekolah.ilike.${q}`
      );
    }
    return query;
  }

  public async getStudentsPaginated(params: {
    page: number;
    pageSize: number;
    search?: string;
    jurusan?: string;
    status?: string;
  }): Promise<{ students: Student[]; totalCount: number }> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const { page, pageSize } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from('students')
      .select(DatabaseService.STUDENT_LIST_COLUMNS, { count: 'exact' });
    query = this.applyStudentFilters(query, params);
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    if (error) {
      throw new Error(`Gagal memuat data pendaftar: ${error.message}`);
    }

    return {
      students: (data as Student[]) || [],
      totalCount: count || 0,
    };
  }

  /**
   * Ambil SEMUA baris sesuai filter secara bertahap (untuk ekspor).
   * Diunduh per 500 baris agar tidak terpotong batas 1.000 baris API Supabase.
   * Hanya dipanggil saat admin menekan tombol ekspor (hemat egress).
   */
  public async getStudentsForExport(f: {
    search?: string;
    jurusan?: string;
    status?: string;
  }): Promise<Student[]> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const CHUNK = 500;
    const all: Student[] = [];
    for (let from = 0; ; from += CHUNK) {
      let query = this.supabase.from('students').select(DatabaseService.STUDENT_LIST_COLUMNS);
      query = this.applyStudentFilters(query, f);
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + CHUNK - 1);
      if (error) throw new Error(`Gagal memuat data pendaftar: ${error.message}`);
      const rows = (data as Student[]) || [];
      all.push(...rows);
      if (rows.length < CHUNK) break;
    }
    return all;
  }

  /**
   * Statistik ringkas untuk kartu KPI admin. Hanya menghitung (head: true),
   * tidak ada baris yang diunduh sehingga egress nyaris nol.
   */
  public async getStudentStats(): Promise<{
    total: number;
    to: number;
    tjkt: number;
    akl: number;
    lolos: number;
  }> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');
    const client = this.supabase;
    const head = () => client.from('students').select('id', { count: 'exact', head: true });

    const results = await Promise.all([
      head(),
      head().eq('jurusan_pilihan', 'TO'),
      head().eq('jurusan_pilihan', 'TJKT'),
      head().eq('jurusan_pilihan', 'AKL'),
      head().in('status_pendaftaran', ['Diterima', 'Terverifikasi']),
    ]);
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(`Gagal memuat statistik: ${failed.error.message}`);

    return {
      total: results[0].count || 0,
      to: results[1].count || 0,
      tjkt: results[2].count || 0,
      akl: results[3].count || 0,
      lolos: results[4].count || 0,
    };
  }

  /**
   * Update Student Data Diri directly by id without sending locked columns
   */
  public async updateStudentDataDiri(
    studentId: string,
    dataDiri: Partial<Student['data_diri']>,
    jurusan?: JurusanType,
    ukuranBaju?: string,
    kodeReferal?: string
  ): Promise<Student> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const mergedDataDiri = {
      ...dataDiri,
      ...(ukuranBaju ? { ukuran_baju: ukuranBaju } : {}),
      ...(kodeReferal ? { kode_referal: kodeReferal } : {}),
    };

    const updatePayload: any = {
      data_diri: mergedDataDiri,
    };

    if (jurusan) updatePayload.jurusan_pilihan = jurusan;
    if (dataDiri.nama_lengkap) updatePayload.nama_lengkap = dataDiri.nama_lengkap;
    if (dataDiri.no_hp) updatePayload.no_wa = dataDiri.no_hp;

    const { data, error } = await this.supabase
      .from('students')
      .update(updatePayload)
      .eq('id', studentId)
      .select()
      .single();

    if (error) {
      console.error('updateStudentDataDiri error:', error);
      throw new Error(`Gagal memperbarui data diri ke Supabase: ${error.message}`);
    }

    return data as Student;
  }

  /**
   * Update Student Data Alamat directly by id
   */
  public async updateStudentDataAlamat(studentId: string, dataAlamat: Student['data_alamat']): Promise<Student> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const { data, error } = await this.supabase
      .from('students')
      .update({ data_alamat: dataAlamat })
      .eq('id', studentId)
      .select()
      .single();

    if (error) {
      console.error('updateStudentDataAlamat error:', error);
      throw new Error(`Gagal memperbarui data alamat ke Supabase: ${error.message}`);
    }

    return data as Student;
  }

  /**
   * Update Student Data Orang Tua directly by id
   */
  public async updateStudentDataOrangTua(studentId: string, dataOrangTua: Student['data_orang_tua']): Promise<Student> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const { data, error } = await this.supabase
      .from('students')
      .update({ data_orang_tua: dataOrangTua })
      .eq('id', studentId)
      .select()
      .single();

    if (error) {
      console.error('updateStudentDataOrangTua error:', error);
      throw new Error(`Gagal memperbarui data orang tua ke Supabase: ${error.message}`);
    }

    return data as Student;
  }

  /**
   * Upload berkas ke Supabase Storage (bucket 'dokumen-ppdb').
   * Validasi, kompresi per jenis berkas, dan penimpaan berkas lama ada di ./uploadBerkas.ts.
   * Batas ukuran ada di ../Utils/uploadConfig.ts.
   * Path: {userId}/{jenis}.{ext}  (userId HARUS = auth.uid())
   * oldPath (opsional): berkas lama jenis yang sama, dihapus setelah upload sukses.
   */
  public async uploadBerkasFile(
    userId: string,
    jenis: string,
    rawFile: File,
    oldPath?: string
  ): Promise<{ path: string; nama_file: string; ukuran: string; url?: string }> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');
    return uploadBerkas(this.supabase, userId, jenis, rawFile, oldPath);
  }

  /**
   * Generate temporary Signed URL (valid for 300 seconds) for private storage documents
   */
  public async getSignedFileUrl(filePathOrUrl: string, expiresInSeconds: number = 300): Promise<string> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');
    if (!filePathOrUrl) throw new Error('Tautan berkas tidak valid.');

    // If string is already an http(s) URL, check if it points to Supabase storage to convert to signed URL
    if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
      const match = filePathOrUrl.match(/(?:dokumen-ppdb|berkas-spmb)\/(.+)$/);
      if (match && match[1]) {
        const decodedPath = decodeURIComponent(match[1].split('?')[0]);
        const { data, error } = await this.supabase.storage
          .from('dokumen-ppdb')
          .createSignedUrl(decodedPath, expiresInSeconds);
        if (!error && data?.signedUrl) {
          return data.signedUrl;
        }
      }
      return filePathOrUrl;
    }

    const { data, error } = await this.supabase.storage
      .from('dokumen-ppdb')
      .createSignedUrl(filePathOrUrl, expiresInSeconds);

    if (error) {
      console.error('[Storage SignedUrl] Error creating signed URL:', error);
      throw new Error(`Gagal membuka berkas: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Update Student Data Berkas directly by id without changing status_pendaftaran
   */
  public async updateStudentDataBerkas(studentId: string, mergedBerkas: DataBerkas): Promise<Student> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const { data, error } = await this.supabase
      .from('students')
      .update({
        data_berkas: mergedBerkas,
      })
      .eq('id', studentId)
      .select()
      .single();

    if (error) {
      console.error('updateStudentDataBerkas error:', error);
      throw new Error(`Gagal memperbarui berkas ke Supabase: ${error.message}`);
    }

    return data as Student;
  }

  /**
   * Final submission: Student submits complete files for verification (changes status to Menunggu Verifikasi)
   */
  public async submitStudentRegistration(studentId: string): Promise<Student> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const { data, error } = await this.supabase
      .from('students')
      .update({
        status_pendaftaran: 'Menunggu Verifikasi',
      })
      .eq('id', studentId)
      .select()
      .single();

    if (error) {
      console.error('submitStudentRegistration error:', error);
      throw new Error(`Gagal menyerahkan berkas: ${error.message}`);
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
      if (error.code === '42501') {
        throw new Error('Akses ditolak: Akun administrator tidak memiliki izin update (periksa hak akses RLS tabel students).');
      }
      throw new Error(`Gagal memperbarui status pendaftar: ${error.message}`);
    }

    return data as Student;
  }

  /**
   * Admin: Delete Student via secure server endpoint /api/admin/delete-student
   */
  public async deleteStudent(identifier: { user_id?: string; nik?: string }): Promise<void> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const { data: sessionData } = await this.supabase.auth.getSession();
    const token = sessionData?.session?.access_token || '';

    const resp = await fetch('/api/admin/delete-student', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(identifier),
    });

    const resJson = await resp.json().catch(() => ({}));
    if (!resp.ok || !resJson.success) {
      throw new Error(resJson.message || 'Gagal menghapus pendaftar.');
    }
  }

  /**
   * Admin: Reset password pendaftar lewat endpoint server /api/admin/reset-password.
   * `verifikasi` adalah jawaban pemohon yang DIKETIK admin; server mencocokkannya dengan data
   * pendaftaran (nomor pendaftaran + nomor WA wajib cocok, tanggal lahir opsional).
   */
  public async resetStudentPassword(
    identifier: { user_id?: string; nik?: string },
    verifikasi: { nomor_pendaftaran: string; no_wa: string; tanggal_lahir?: string }
  ): Promise<{
    temporaryPassword: string;
    nama_lengkap: string;
    nomor_pendaftaran: string;
    no_wa: string;
    sessionsRevoked: boolean;
    logged: boolean;
  }> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const { data: sessionData } = await this.supabase.auth.getSession();
    const token = sessionData?.session?.access_token || '';

    const resp = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...identifier, verifikasi }),
    });

    const resJson = await resp.json().catch(() => ({}));
    if (!resp.ok || !resJson.success) {
      throw new Error(resJson.message || 'Gagal mereset kata sandi siswa.');
    }

    return {
      temporaryPassword: resJson.temporaryPassword,
      nama_lengkap: resJson.nama_lengkap,
      nomor_pendaftaran: resJson.nomor_pendaftaran,
      no_wa: resJson.no_wa,
      sessionsRevoked: !!resJson.sessionsRevoked,
      logged: resJson.logged !== false,
    };
  }

  /**
   * Siswa: ganti password milik sendiri (sesi harus aktif), lalu hapus penanda wajib-ganti.
   */
  public async changeMyPassword(newPassword: string): Promise<void> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const { error } = await this.supabase.auth.updateUser({ password: newPassword });
    if (error) {
      const msg = error.message || '';
      if (/same|different from the old/i.test(msg)) {
        throw new Error('Password baru tidak boleh sama dengan password lama.');
      }
      if (/reauth/i.test(msg)) {
        throw new Error('Demi keamanan, silakan keluar lalu login ulang sebelum mengganti password.');
      }
      if (/weak|at least|short/i.test(msg)) {
        throw new Error('Password terlalu lemah. Gunakan minimal 8 karakter kombinasi huruf dan angka.');
      }
      throw new Error(msg || 'Gagal mengganti password.');
    }

    const { error: rpcErr } = await this.supabase.rpc('complete_password_change');
    const rpcMissing = !!rpcErr && /does not exist|could not find|PGRST202|42883/i.test(`${rpcErr.code} ${rpcErr.message}`);
    if (rpcErr && !rpcMissing) {
      throw new Error('Password berhasil diganti, tetapi status akun belum diperbarui. Silakan muat ulang halaman.');
    }
  }
}

export const dbService = new DatabaseService();
