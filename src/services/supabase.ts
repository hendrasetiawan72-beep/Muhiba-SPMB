import { createClient, SupabaseClient, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { 
  Student, 
  User, 
  UserRole, 
  Pembayaran, 
  StatusPendaftaran, 
  JurusanType,
  DataBerkas,
  BerkasItem
} from '../types/database';

class DatabaseService {
  private supabase: SupabaseClient | null = null;
  private currentUrl: string = '';
  private currentAnonKey: string = '';

  constructor() {
    this.initSupabaseFromEnv();
  }

  /**
   * Initialize Supabase client strictly using environment variables.
   * LocalStorage configuration reading is completely removed.
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

  public getSupabaseClient(): SupabaseClient | null {
    return this.supabase;
  }

  public isSupabaseConnected(): boolean {
    return !!this.supabase;
  }

  /**
   * Helper: Strip ephemeral signed/public URLs before writing data_berkas to DB.
   * Signed URLs must NEVER be persisted in the database.
   */
  private sanitizeDataBerkasBeforeSave(dataBerkas: Partial<DataBerkas> | undefined): Partial<DataBerkas> {
    if (!dataBerkas) return {};
    const sanitized: Record<string, any> = {};

    for (const [key, item] of Object.entries(dataBerkas)) {
      if (item && typeof item === 'object') {
        const { url, ...persistedFields } = item as BerkasItem;
        sanitized[key] = persistedFields;
      } else {
        sanitized[key] = item;
      }
    }

    return sanitized as Partial<DataBerkas>;
  }

  /**
   * Helper: Enrich student data_berkas in memory with fresh 1-hour signed URLs.
   * Legacy items with public URLs are only displayed if the URL host matches this project's Supabase host.
   */
  private async enrichStudentWithSignedUrls(student: Student | null): Promise<Student | null> {
    if (!student || !student.data_berkas) return student;

    let projectHost = '';
    try {
      if (this.currentUrl) {
        projectHost = new URL(this.currentUrl).host;
      }
    } catch {
      projectHost = '';
    }

    const enrichedBerkas: DataBerkas = { ...student.data_berkas };

    for (const key of Object.keys(enrichedBerkas) as (keyof DataBerkas)[]) {
      const item = enrichedBerkas[key];
      if (!item) continue;

      let signedUrl = '';

      if (item.path && this.supabase) {
        try {
          const { data, error } = await this.supabase.storage
            .from('dokumen-ppdb')
            .createSignedUrl(item.path, 3600); // 1 hour expiration in memory

          if (!error && data?.signedUrl) {
            signedUrl = data.signedUrl;
          }
        } catch (err) {
          console.warn(`[Storage] Failed creating signed URL for ${item.path}:`, err);
        }
      } else if (item.url) {
        // Legacy file with public URL: only retain if host matches this project's Supabase host
        try {
          const parsed = new URL(item.url);
          if (projectHost && parsed.host === projectHost) {
            signedUrl = item.url;
          } else {
            signedUrl = '';
          }
        } catch {
          signedUrl = '';
        }
      }

      enrichedBerkas[key] = {
        ...item,
        url: signedUrl || undefined,
      };
    }

    return {
      ...student,
      data_berkas: enrichedBerkas,
    };
  }

  /**
   * Unified HTTP caller for backend endpoints (/api/auth/*).
   * Edge Function invocation is completely removed.
   * Relies strictly on HTTP status codes and structured { success, code, error } responses.
   */
  private async safePostAuthApi<T>(
    endpointPath: string,
    payload: Record<string, any>
  ): Promise<T> {
    const response = await fetch(endpointPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Server mengembalikan respons non-JSON (HTTP ${response.status}).`);
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new Error('Gagal memproses data respons dari server.');
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.error || `Permintaan gagal dengan status ${response.status}.`);
    }

    return data as T;
  }

  /**
   * User Registration: Calls backend /api/auth/register
   */
  public async register(payload: {
    nik: string;
    nama_lengkap: string;
    jurusan_pilihan: JurusanType;
    no_wa: string;
    password: string;
  }): Promise<{ user: User; student: Student }> {
    const cleanNik = payload.nik.trim();
    if (!/^\d{16}$/.test(cleanNik)) {
      throw new Error('NIK harus terdiri dari 16 digit angka sesuai KTP / Kartu Keluarga.');
    }
    if (payload.password.length < 8) {
      throw new Error('Password minimal 8 karakter agar akun Anda aman.');
    }

    const result = await this.safePostAuthApi<{
      success: boolean;
      session?: any;
      user: User;
      student: Student;
    }>('/api/auth/register', payload);

    if (result.session && this.supabase) {
      await this.supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
    }

    const enrichedStudent = await this.enrichStudentWithSignedUrls(result.student);
    return { user: result.user, student: enrichedStudent || result.student };
  }

  /**
   * User & Admin Login: Calls backend /api/auth/login
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
    if (cleanPassword.length < 8) {
      throw new Error('Password minimal 8 karakter.');
    }

    const result = await this.safePostAuthApi<{
      success: boolean;
      session?: any;
      user: User;
      student?: Student;
    }>('/api/auth/login', {
      identifier: cleanIdentifier,
      password: cleanPassword,
    });

    if (result.session && this.supabase) {
      await this.supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
    }

    let enrichedStudent = result.student;
    if (enrichedStudent) {
      enrichedStudent = (await this.enrichStudentWithSignedUrls(enrichedStudent)) || enrichedStudent;
    }

    return { user: result.user, student: enrichedStudent };
  }

  /**
   * Fetch profile and student data for an authenticated Supabase user.
   * If role is student but student row is missing: signs out and throws specific error.
   */
  private async fetchUserSessionDetails(authUser: SupabaseAuthUser): Promise<{ user: User; student?: Student }> {
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

    const userRole: UserRole = profileData?.role === 'admin' ? 'admin' : 'student';
    const userNik: string = profileData?.nik || authUser.user_metadata?.nik || '';
    const fullName: string = profileData?.full_name || authUser.user_metadata?.full_name || 'Pengguna';

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
      const { data: stdData } = await this.supabase
        .from('students')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (!stdData) {
        // Student row is missing for student role -> signOut and throw error
        await this.logout();
        throw new Error('Data pendaftaran tidak ditemukan. Hubungi panitia.');
      }

      const enriched = await this.enrichStudentWithSignedUrls(stdData as Student);
      studentData = (enriched as Student) || (stdData as Student);
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
    } catch (err: any) {
      console.warn('Error reading Supabase session:', err?.message || err);
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
      } catch (e: any) {
        console.warn('Auth state change error:', e?.message || e);
        callback(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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
    return this.enrichStudentWithSignedUrls(data as Student);
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
    return this.enrichStudentWithSignedUrls(data as Student);
  }

  /**
   * Admin: Get all students with loop .range() (default 1000 limit)
   */
  public async getAllStudents(filters?: {
    jurusan?: string;
    status?: string;
    search?: string;
  }): Promise<Student[]> {
    if (!this.supabase) return [];

    const pageSize = 1000;
    let from = 0;
    let allData: any[] = [];
    let hasMore = true;

    while (hasMore) {
      let query = this.supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);

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

      if (data && data.length > 0) {
        allData = allData.concat(data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      } else {
        hasMore = false;
      }
    }

    // Enrich all students with signed URLs in memory
    const enriched = await Promise.all(
      allData.map((std) => this.enrichStudentWithSignedUrls(std))
    );

    return (enriched.filter(Boolean) as Student[]) || [];
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

    const enriched = await this.enrichStudentWithSignedUrls(data as Student);
    return (enriched as Student) || (data as Student);
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

    const enriched = await this.enrichStudentWithSignedUrls(data as Student);
    return (enriched as Student) || (data as Student);
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

    const enriched = await this.enrichStudentWithSignedUrls(data as Student);
    return (enriched as Student) || (data as Student);
  }

  /**
   * Upload Berkas File to Supabase Storage:
   * Bucket: 'dokumen-ppdb' (private)
   * Path: `${auth.uid()}/${jenis}_${timestamp}_${sanitizedFileName}`
   * Upsert: false
   * If fails: THROWS error immediately.
   * Returns path and 1-hour signed URL in memory.
   */
  public async uploadBerkasFile(
    nik: string,
    jenis: string,
    file: File
  ): Promise<{ path: string; url: string; nama_file: string; ukuran: string }> {
    if (!this.supabase) {
      throw new Error('Supabase client tidak terhubung.');
    }

    const { data: authData, error: authErr } = await this.supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (authErr || !userId) {
      throw new Error('Sesi autentikasi tidak ditemukan. Silakan login kembali untuk mengunggah berkas.');
    }

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${userId}/${jenis}_${timestamp}_${sanitizedName}`;

    const formatBytes = (bytes: number): string => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1048576).toFixed(1) + ' MB';
    };
    const ukuran = formatBytes(file.size);

    const { error: uploadError } = await this.supabase.storage
      .from('dokumen-ppdb')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[Upload Berkas] Upload to dokumen-ppdb failed:', uploadError);
      throw new Error(`Gagal mengunggah berkas ${file.name}: ${uploadError.message}`);
    }

    // Generate in-memory 1-hour signed URL for UI preview
    let signedUrl = '';
    const { data: signedData, error: signErr } = await this.supabase.storage
      .from('dokumen-ppdb')
      .createSignedUrl(filePath, 3600);

    if (!signErr && signedData?.signedUrl) {
      signedUrl = signedData.signedUrl;
    }

    return {
      path: filePath,
      url: signedUrl,
      nama_file: file.name,
      ukuran,
    };
  }

  /**
   * Update Student Data Berkas:
   * Strips ephemeral `url` before writing to database.
   * Preserves `path` and returns enriched student with in-memory signed URLs.
   */
  public async updateStudentDataBerkas(nik: string, dataBerkas: Student['data_berkas']): Promise<Student> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const existing = await this.getStudentByNik(nik);
    if (!existing) throw new Error('Data calon peserta didik tidak ditemukan.');

    const mergedBerkas = { ...existing.data_berkas, ...dataBerkas };

    // Strip signed URLs before DB update
    const sanitizedPayload = this.sanitizeDataBerkasBeforeSave(mergedBerkas);

    let nextStatus = existing.status_pendaftaran;
    if (nextStatus === 'Belum Lengkap' || nextStatus === 'Berkas Fisik') {
      nextStatus = 'Menunggu Verifikasi';
    }

    const { data, error } = await this.supabase
      .from('students')
      .update({
        data_berkas: sanitizedPayload,
        status_pendaftaran: nextStatus,
      })
      .eq('nik', nik.trim())
      .select()
      .single();

    if (error) {
      console.error('updateStudentDataBerkas error:', error);
      throw new Error(`Gagal memperbarui berkas ke Supabase: ${error.message}`);
    }

    const enriched = await this.enrichStudentWithSignedUrls(data as Student);
    return (enriched as Student) || (data as Student);
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

    const enriched = await this.enrichStudentWithSignedUrls(data as Student);
    return (enriched as Student) || (data as Student);
  }

  /**
   * Admin: Delete Student via backend API /api/admin/delete-student
   * Verifies admin role, deletes user storage files, database records, and Auth user.
   */
  public async deleteStudent(nik: string): Promise<void> {
    if (!this.supabase) throw new Error('Supabase client tidak terhubung.');

    const { data: sessionData } = await this.supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      throw new Error('Sesi login administrator tidak ditemukan. Silakan login kembali.');
    }

    const response = await fetch('/api/admin/delete-student', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ nik: nik.trim() }),
    });

    let resJson: any = {};
    try {
      resJson = await response.json();
    } catch {
      resJson = {};
    }

    if (!response.ok || resJson.success === false) {
      throw new Error(resJson.error || `Gagal menghapus pendaftar (HTTP ${response.status}).`);
    }
  }

  /**
   * Realtime Subscription: Subscribe to changes in students table with 1s debounce
   */
  public subscribeToStudents(callback: () => void): () => void {
    if (!this.supabase) return () => {};

    let debounceTimer: any = null;
    const debouncedCallback = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        callback();
      }, 1000);
    };

    const channel = this.supabase
      .channel('public-students-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => {
          debouncedCallback();
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (this.supabase) {
        this.supabase.removeChannel(channel);
      }
    };
  }

  /**
   * Pembayaran: Fetch payments for student (fake "Lunas" data completely removed)
   */
  public async getPembayaran(nik: string): Promise<Pembayaran[]> {
    if (!this.supabase) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('pembayaran')
      .select('*')
      .eq('nik', nik.trim());

    if (error || !data) {
      return [];
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
