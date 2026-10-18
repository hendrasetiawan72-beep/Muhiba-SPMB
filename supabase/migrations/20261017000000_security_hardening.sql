-- ============================================================================
-- SPMB SMK MUHAMMADIYAH BAWANG - DATABASE SECURITY HARDENING MIGRATION
-- File: supabase/migrations/20261017000000_security_hardening.sql
-- Description: Idempotent migration implementing strict RLS policies, trigger-based
--              student/profile immutability, sequence-backed registration numbers,
--              NIK check constraints, and private storage hardening.
-- ============================================================================

-- ============================================================================
-- 1. HARDENED handle_new_user TRIGGER
-- Role is ALWAYS 'student', strictly ignoring any raw_user_meta_data->>'role'.
-- Uses ON CONFLICT (id) DO NOTHING to prevent metadata tampering.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nik, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nik', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Calon Siswa'),
    'student'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. TRIGGER BEFORE UPDATE ON public.students
-- Protects sensitive fields (nik, user_id, nomor_pendaftaran, catatan_admin).
-- Restricts status_pendaftaran transitions for non-admin students.
-- Non-admin students may only transition status from 'Belum Lengkap' or 'Berkas Fisik'
-- to 'Menunggu Verifikasi'.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_students_update()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Service role and superusers bypass this check
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  v_is_admin := public.is_admin();

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- 1. Non-admins cannot alter identity & tracking columns
  IF NEW.nik IS DISTINCT FROM OLD.nik THEN
    RAISE EXCEPTION 'Akses ditolak: NIK pendaftar tidak dapat diubah.';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Akses ditolak: user_id tidak dapat dipindahtangankan.';
  END IF;

  IF NEW.nomor_pendaftaran IS DISTINCT FROM OLD.nomor_pendaftaran THEN
    RAISE EXCEPTION 'Akses ditolak: Nomor pendaftaran tidak dapat diubah.';
  END IF;

  IF NEW.catatan_admin IS DISTINCT FROM OLD.catatan_admin THEN
    RAISE EXCEPTION 'Akses ditolak: Catatan admin hanya dapat diubah oleh administrator.';
  END IF;

  -- 2. Restrict status transitions for students
  IF NEW.status_pendaftaran IS DISTINCT FROM OLD.status_pendaftaran THEN
    IF NOT (
      (OLD.status_pendaftaran IN ('Belum Lengkap', 'Berkas Fisik') OR OLD.status_pendaftaran IS NULL) AND
      (NEW.status_pendaftaran = 'Menunggu Verifikasi')
    ) THEN
      RAISE EXCEPTION 'Akses ditolak: Siswa hanya dapat mengubah status menjadi "Menunggu Verifikasi" saat melengkapi berkas.';
    END IF;
  END IF;

  -- 3. Batasi ukuran JSONB (maksimal 32 KB per kolom) dan validasi struktur
  IF pg_column_size(NEW.data_diri) > 32768 OR
     pg_column_size(NEW.data_alamat) > 32768 OR
     pg_column_size(NEW.data_orang_tua) > 32768 OR
     pg_column_size(NEW.data_berkas) > 32768 THEN
    RAISE EXCEPTION 'Akses ditolak: Ukuran data JSON formulir melebihi batas 32 KB.';
  END IF;

  -- 4. Validasi format no_wa (10-16 digit)
  IF NEW.no_wa IS NOT NULL AND NEW.no_wa <> '' AND NEW.no_wa !~ '^[0-9+]{10,16}$' THEN
    RAISE EXCEPTION 'Format nomor WhatsApp tidak valid (harus 10-16 digit angka).';
  END IF;

  -- 5. Validasi NIK orang tua jika diisi (harus tepat 16 digit angka)
  IF NEW.data_orang_tua->>'nik_ayah' IS NOT NULL AND NEW.data_orang_tua->>'nik_ayah' <> '' AND NEW.data_orang_tua->>'nik_ayah' !~ '^\d{16}$' THEN
    RAISE EXCEPTION 'NIK Ayah harus terdiri dari tepat 16 digit angka.';
  END IF;

  IF NEW.data_orang_tua->>'nik_ibu' IS NOT NULL AND NEW.data_orang_tua->>'nik_ibu' <> '' AND NEW.data_orang_tua->>'nik_ibu' !~ '^\d{16}$' THEN
    RAISE EXCEPTION 'NIK Ibu harus terdiri dari tepat 16 digit angka.';
  END IF;

  -- Students are permitted to update: jurusan_pilihan, nama_lengkap, no_wa, data_diri, data_alamat, data_orang_tua, data_berkas
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_students_update ON public.students;
CREATE TRIGGER trg_protect_students_update
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.protect_students_update();

-- ============================================================================
-- 3. TRIGGER BEFORE UPDATE ON public.profiles
-- Non-admins cannot escalate role or mutate NIK.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_profiles_update()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  v_is_admin := public.is_admin();

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Akses ditolak: Anda tidak memiliki wewenang untuk mengubah hak akses role.';
  END IF;

  IF NEW.nik IS DISTINCT FROM OLD.nik THEN
    RAISE EXCEPTION 'Akses ditolak: NIK profil tidak dapat diubah.';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Akses ditolak: ID profil tidak dapat diubah.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profiles_update ON public.profiles;
CREATE TRIGGER trg_protect_profiles_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profiles_update();

-- ============================================================================
-- 4. TIGHTENED ROW LEVEL SECURITY (RLS) POLICIES
-- Performance optimization: wrap auth.uid() as (SELECT auth.uid()) and
-- is_admin() as (SELECT public.is_admin()) to prevent per-row re-evaluation.
-- INSERT on students & profiles restricted to admin (service_role bypasses).
-- INSERT on pembayaran by non-admin requires user_id = auth.uid() AND status = 'Menunggu Verifikasi'.
-- ============================================================================

-- PROFILES POLICIES
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = id OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = id OR (SELECT public.is_admin())
  )
  WITH CHECK (
    ((SELECT auth.uid()) = id AND role = 'student') OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    (SELECT public.is_admin())
  );

-- STUDENTS POLICIES
DROP POLICY IF EXISTS "students_select_policy" ON public.students;
CREATE POLICY "students_select_policy"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "students_insert_policy" ON public.students;
CREATE POLICY "students_insert_policy"
  ON public.students
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "students_update_policy" ON public.students;
CREATE POLICY "students_update_policy"
  ON public.students
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id OR (SELECT public.is_admin())
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "students_delete_policy" ON public.students;
CREATE POLICY "students_delete_policy"
  ON public.students
  FOR DELETE
  TO authenticated
  USING (
    (SELECT public.is_admin())
  );

-- PEMBAYARAN POLICIES
DROP POLICY IF EXISTS "pembayaran_select_policy" ON public.pembayaran;
CREATE POLICY "pembayaran_select_policy"
  ON public.pembayaran
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "pembayaran_insert_policy" ON public.pembayaran;
CREATE POLICY "pembayaran_insert_policy"
  ON public.pembayaran
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND status = 'Menunggu Verifikasi') OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "pembayaran_update_policy" ON public.pembayaran;
CREATE POLICY "pembayaran_update_policy"
  ON public.pembayaran
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "pembayaran_delete_policy" ON public.pembayaran;
CREATE POLICY "pembayaran_delete_policy"
  ON public.pembayaran
  FOR DELETE
  TO authenticated
  USING (
    (SELECT public.is_admin())
  );

-- ============================================================================
-- 5. DROP DUPLICATE INDEXES
-- Tables already enforce UNIQUE constraints on students(nik),
-- students(nomor_pendaftaran), and profiles(nik). Dropping redundant non-unique indexes.
-- ============================================================================
DROP INDEX IF EXISTS public.idx_students_nik;
DROP INDEX IF EXISTS public.idx_students_nomor_pendaftaran;
DROP INDEX IF EXISTS public.idx_profiles_nik;
DROP INDEX IF EXISTS public.idx_profiles_role;

-- ============================================================================
-- 6. SEQUENCE-BACKED NOMOR PENDAFTARAN GENERATOR
-- Format: <Tahun Berjalan (4 digit)> || Sequence (min 4 digit, tidak dipotong jika > 999) || Random (3 digit 100-999)
-- Contoh: 20260001842, 20270125914 (otomatis tahun 2027 di tahun 2027)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.nomor_pendaftaran_seq;

DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT count(*) INTO v_count FROM public.students;
  PERFORM setval('public.nomor_pendaftaran_seq', GREATEST(v_count, 1), true);
END $$;

CREATE OR REPLACE FUNCTION public.next_nomor_pendaftaran()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_seq BIGINT;
  v_seq_str TEXT;
  v_rand TEXT;
BEGIN
  -- 1. Awalan otomatis menyesuaikan tahun berjalan (2026, 2027, dst.)
  v_year := to_char(CURRENT_DATE, 'YYYY');
  v_seq := nextval('public.nomor_pendaftaran_seq');
  v_seq_str := v_seq::TEXT;
  -- 2. Jangan potong urutan jika di atas 999 (minimal 4 digit pad, tidak dipotong jika lebih dari 4 digit)
  IF length(v_seq_str) < 4 THEN
    v_seq_str := lpad(v_seq_str, 4, '0');
  END IF;
  -- 3. 3-digit acak (100 - 999) agar nomor tidak mudah ditebak
  v_rand := lpad((floor(random() * 900) + 100)::text, 3, '0');
  RETURN v_year || v_seq_str || v_rand;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_nomor_pendaftaran()
RETURNS TEXT
LANGUAGE sql
VOLATILE
AS $$
  SELECT public.next_nomor_pendaftaran();
$$;

REVOKE EXECUTE ON FUNCTION public.next_nomor_pendaftaran() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_nomor_pendaftaran() TO service_role;

ALTER TABLE public.students 
  ALTER COLUMN nomor_pendaftaran SET DEFAULT public.generate_nomor_pendaftaran();

-- ============================================================================
-- 7. CHECK CONSTRAINT ON NIK (16 DIGITS ONLY)
-- Added with NOT VALID so legacy unvalidated data (if any) does not block migration.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_nik_check_16_digits'
  ) THEN
    ALTER TABLE public.students 
      ADD CONSTRAINT students_nik_check_16_digits CHECK (nik ~ '^\d{16}$') NOT VALID;
  END IF;
END $$;

-- ============================================================================
-- 8. STORAGE HARDENING: PRIVATE BUCKET 'dokumen-ppdb'
-- 2 MB file size limit, allowed MIME types for PDF, JPG, PNG, WEBP.
-- Policies: users can only write and read their own subfolder (auth.uid()).
-- Admins can read all documents. Anon access completely denied.
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dokumen-ppdb',
  'dokumen-ppdb',
  false,
  2097152,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "storage_student_upload" ON storage.objects;
DROP POLICY IF EXISTS "storage_student_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "dokumen_ppdb_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "dokumen_ppdb_select_policy" ON storage.objects;

CREATE POLICY "dokumen_ppdb_insert_policy"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dokumen-ppdb' AND
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "dokumen_ppdb_select_policy"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dokumen-ppdb' AND
    (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR (SELECT public.is_admin())
    )
  );
