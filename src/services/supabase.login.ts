  /**
   * TEMPEL menggantikan method `login(...)` lama di class dbService (src/services/supabase.ts).
   *
   * Login lewat /api/auth/login (CAPTCHA + rate limit + auth di server).
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
