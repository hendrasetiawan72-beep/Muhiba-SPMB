-- ============================================================================
-- SPMB SMK MUHAMMADIYAH BAWANG - SUPABASE DATABASE MIGRATION
-- File: supabase/migrations/20260925000000_spmb_initial_schema.sql
-- Description: Core schema, Row Level Security (RLS) policies, triggers,
--              indexes, storage security, and hardened admin authorization functions.
-- ============================================================================

-- Enable pgcrypto if not already enabled (for UUID generation)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE (Linked directly to Supabase auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nik TEXT UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- 2. STUDENTS / REGISTRATIONS TABLE
-- ============================================================================
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

-- ============================================================================
-- 3. PEMBAYARAN TABLE (Optional payment tracking)
-- ============================================================================
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

-- ============================================================================
-- 4. PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_nik ON public.students(nik);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status_pendaftaran);
CREATE INDEX IF NOT EXISTS idx_students_jurusan ON public.students(jurusan_pilihan);
CREATE INDEX IF NOT EXISTS idx_students_nomor_pendaftaran ON public.students(nomor_pendaftaran);
CREATE INDEX IF NOT EXISTS idx_students_created_at ON public.students(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_nik ON public.profiles(nik);
CREATE INDEX IF NOT EXISTS idx_pembayaran_student_id ON public.pembayaran(student_id);
CREATE INDEX IF NOT EXISTS idx_pembayaran_user_id ON public.pembayaran(user_id);
CREATE INDEX IF NOT EXISTS idx_pembayaran_nik ON public.pembayaran(nik);

-- ============================================================================
-- 5. UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_students_updated_at ON public.students;
CREATE TRIGGER set_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_pembayaran_updated_at ON public.pembayaran;
CREATE TRIGGER set_pembayaran_updated_at
  BEFORE UPDATE ON public.pembayaran
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 6. SECURITY DEFINER HELPER: is_admin()
-- Bypasses RLS safely to prevent recursive policy evaluations on public.profiles.
-- Fixed search_path prevents search_path hijacking attacks.
-- ============================================================================
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

-- Revoke default execute from public and grant explicitly
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- ============================================================================
-- 7. AUTH TRIGGER: Automatically populate profiles when auth.users is created
-- ============================================================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 8. ENABLE ROW LEVEL SECURITY (RLS) ON ALL PUBLIC TABLES
-- Denies all actions by default unless explicitly granted by policy.
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pembayaran ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. RLS POLICIES: PROFILES
-- - anon: DENIED (all operations)
-- - student: SELECT own profile only, UPDATE own profile (cannot escalate role or change id)
-- - admin: SELECT & UPDATE all profiles
-- ============================================================================
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR public.is_admin()
  );

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id OR public.is_admin()
  );

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id OR public.is_admin()
  )
  WITH CHECK (
    -- Normal users cannot self-escalate their role to 'admin' and cannot modify user id
    (auth.uid() = id AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()))
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

-- ============================================================================
-- 10. RLS POLICIES: STUDENTS
-- - anon: DENIED (all operations)
-- - student: SELECT own row only, UPDATE own editable fields, CANNOT change user_id
-- - admin: SELECT all, UPDATE all, DELETE allowed
-- ============================================================================
DROP POLICY IF EXISTS "students_select_policy" ON public.students;
CREATE POLICY "students_select_policy"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR public.is_admin()
  );

DROP POLICY IF EXISTS "students_insert_policy" ON public.students;
CREATE POLICY "students_insert_policy"
  ON public.students
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR public.is_admin()
  );

DROP POLICY IF EXISTS "students_update_policy" ON public.students;
CREATE POLICY "students_update_policy"
  ON public.students
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR public.is_admin()
  )
  WITH CHECK (
    -- Student can only update their own row and CANNOT reassign user_id
    (auth.uid() = user_id AND user_id = (SELECT s.user_id FROM public.students s WHERE s.id = students.id))
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "students_delete_policy" ON public.students;
CREATE POLICY "students_delete_policy"
  ON public.students
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

-- ============================================================================
-- 11. RLS POLICIES: PEMBAYARAN
-- ============================================================================
DROP POLICY IF EXISTS "pembayaran_select_policy" ON public.pembayaran;
CREATE POLICY "pembayaran_select_policy"
  ON public.pembayaran
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR public.is_admin()
  );

DROP POLICY IF EXISTS "pembayaran_insert_policy" ON public.pembayaran;
CREATE POLICY "pembayaran_insert_policy"
  ON public.pembayaran
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR public.is_admin()
  );

DROP POLICY IF EXISTS "pembayaran_update_policy" ON public.pembayaran;
CREATE POLICY "pembayaran_update_policy"
  ON public.pembayaran
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
  );

DROP POLICY IF EXISTS "pembayaran_delete_policy" ON public.pembayaran;
CREATE POLICY "pembayaran_delete_policy"
  ON public.pembayaran
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

-- ============================================================================
-- 12. STORAGE BUCKET FOR DOKUMEN PPDB
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('dokumen-ppdb', 'dokumen-ppdb', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "storage_student_upload" ON storage.objects;
CREATE POLICY "storage_student_upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dokumen-ppdb' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "storage_student_admin_select" ON storage.objects;
CREATE POLICY "storage_student_admin_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dokumen-ppdb' AND
    ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

-- ============================================================================
-- 13. HARDENED ADMIN PROMOTION FUNCTION (RESTRICTED EXECUTION)
-- SECURITY DEFINER with fixed search_path = public.
-- REVOKED from PUBLIC, anon, and authenticated to prevent unauthorized execution.
-- Only database superuser (postgres) or service_role can execute this function.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.promote_to_admin(target_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.profiles
  SET role = 'admin'
  WHERE nik = target_identifier OR id::text = target_identifier;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RETURN 'SUCCESS: Akun ' || target_identifier || ' sekarang memiliki hak akses admin.';
  ELSE
    RETURN 'NOT_FOUND: Akun dengan identifier ' || target_identifier || ' tidak ditemukan.';
  END IF;
END;
$$;

-- CRITICAL PRIVILEGE HARDENING:
REVOKE EXECUTE ON FUNCTION public.promote_to_admin(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_to_admin(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.promote_to_admin(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.promote_to_admin(TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.promote_to_admin(TEXT) TO service_role;
