/**
   * User & Admin Login via /api/auth/login (server-side Turnstile + auth).
   * Session di-set ke client SDK agar auth.uid() dan RLS tetap jalan.
   */
  public async login(
    nikOrUsername: string,
    password: string,
    captchaToken?: string
  ): Promise<{ user: User; student?: Student }> {
    const cleanIdentifier = nikOrUsername.trim();
    const cleanPassword = password.trim();

    if (!cleanIdentifier) {
      throw new Error('Username / NIK wajib diisi.');
    }
    if (!cleanPassword) {
      throw new Error('Kata sandi wajib diisi.');
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          identifier: cleanIdentifier,
          password: cleanPassword,
          turnstileToken: captchaToken || '',
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      let result: any = null;

      if (contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error('[Login] Non-JSON response:', text);
        throw new Error('Terjadi kesalahan pada server saat login.');
      }

      if (!response.ok || !result.success) {
        const errMessage =
          result?.error || result?.message || 'Login gagal. Periksa NIK dan kata sandi.';
        const errObj = new Error(errMessage) as any;
        errObj.code = result?.code || 'LOGIN_FAILED';
        throw errObj;
      }

      // Set session di client agar auth.uid() aktif untuk RLS
      if (result.session && this.supabase) {
        await this.supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
      } else if (result.user && this.supabase) {
        // Fallback: ambil detail dari sesi yang mungkin sudah ada
        const { data: sess } = await this.supabase.auth.getSession();
        if (sess?.session?.user) {
          return await this.fetchUserSessionDetails(sess.session.user);
        }
      }

      // Jika server sudah mengembalikan user (+ student), pakai itu
      if (result.user) {
        return {
          user: result.user as User,
          student: result.student as Student | undefined,
        };
      }

      // Fallback terakhir: baca ulang dari DB
      if (!this.supabase) {
        throw new Error('Supabase client belum terhubung.');
      }
      const { data: { user: authUser } } = await this.supabase.auth.getUser();
      if (!authUser) {
        throw new Error('Login berhasil tetapi sesi tidak tersedia. Muat ulang halaman.');
      }
      return await this.fetchUserSessionDetails(authUser);
    } catch (err: any) {
      // Error dari API (CAPTCHA, credentials, dll.) — lempar apa adanya
      if (err?.code || err?.message) {
        throw err instanceof Error ? err : new Error(String(err));
      }
      console.error('[Login] Unexpected error:', err);
      throw new Error('Login gagal. Silakan coba lagi.');
    }
  }
