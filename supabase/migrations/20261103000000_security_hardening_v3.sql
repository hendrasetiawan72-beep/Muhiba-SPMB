-- ============================================================================
-- SPMB SMK MUHAMMADIYAH BAWANG — SECURITY HARDENING v3
-- File: supabase/migrations/20261103000000_security_hardening_v3.sql
--
-- MIGRASI BARU (tidak mengedit migrasi lama). Idempotent: aman dijalankan ulang.
-- TIDAK menghapus data, bucket, objek storage, maupun user Auth.
--
-- URUTAN DEPLOY (penting):
--   1) Jalankan migrasi ini di Supabase  (membuat tabel password_reset_secrets)
--   2) Deploy kode Worker/aplikasi terbaru
-- Jika urutan dibalik, endpoint reset password gagal-tertutup (HTTP 503) sampai migrasi
-- dijalankan; tidak ada data yang rusak.
--
-- ISI:
--   A. Perbaikan trigger proteksi yang SELAMA INI TIDAK EFEKTIF (lihat catatan di bawah)
--   B. Tabel rahasia sekali-tampil untuk reset password
--   C. Bucket legacy 'berkas-spmb' -> PRIVATE (objek TIDAK dihapus)
--   D. Storage RLS 'dokumen-ppdb' -> nama file whitelist + wajib punya data pendaftaran
--   E. Hak EXECUTE fungsi & hak tabel untuk anon (defense in depth)
-- ============================================================================


-- ============================================================================
-- A. PERBAIKAN TRIGGER PROTEKSI
--
-- MASALAH: protect_students_update() dan protect_profiles_update() adalah
-- SECURITY DEFINER dan memeriksa `current_user IN ('service_role','postgres',...)`.
-- Di dalam fungsi SECURITY DEFINER, current_user = PEMILIK FUNGSI (postgres), sehingga
-- kondisi itu SELALU benar dan trigger langsung `RETURN NEW` untuk SEMUA pemanggil —
-- termasuk siswa. Akibatnya siswa dapat (lewat PostgREST dengan token miliknya sendiri)
-- mengubah status_pendaftaran menjadi 'Diterima', catatan_admin, nomor_pendaftaran, dll.
--
-- PERBAIKAN: identitas pemanggil ditentukan dari klaim JWT (auth.role()/auth.uid()),
-- bukan current_user. Validasi format hanya dijalankan pada nilai yang DIUBAH sehingga
-- baris lama (mis. no_wa berformat lama) tidak membuat update siswa tiba-tiba gagal.
-- ============================================================================

-- Sesi "istimewa": service_role (API server) atau koneksi DB langsung tanpa JWT (SQL editor/migrasi).
CREATE OR REPLACE FUNCTION public.is_privileged_db_session()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(auth.role(), '') = 'service_role'
      OR (auth.uid() IS NULL AND COALESCE(auth.role(), '') = '');
$$;

REVOKE EXECUTE ON FUNCTION public.is_privileged_db_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_privileged_db_session() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.protect_students_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_privileged_db_session() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- 1. Kolom identitas / pelacakan tidak boleh diubah oleh siswa
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Akses ditolak: ID pendaftar tidak dapat diubah.';
  END IF;
  IF NEW.nik IS DISTINCT FROM OLD.nik THEN
    RAISE EXCEPTION 'Akses ditolak: NIK pendaftar tidak dapat diubah.';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Akses ditolak: user_id tidak dapat dipindahtangankan.';
  END IF;
  IF NEW.nomor_pendaftaran IS DISTINCT FROM OLD.nomor_pendaftaran THEN
    RAISE EXCEPTION 'Akses ditolak: Nomor pendaftaran tidak dapat diubah.';
  END IF;
  IF NEW.tanggal_daftar IS DISTINCT FROM OLD.tanggal_daftar THEN
    RAISE EXCEPTION 'Akses ditolak: Tanggal daftar tidak dapat diubah.';
  END IF;
  IF NEW.catatan_admin IS DISTINCT FROM OLD.catatan_admin THEN
    RAISE EXCEPTION 'Akses ditolak: Catatan admin hanya dapat diubah oleh administrator.';
  END IF;

  -- 2. Transisi status siswa: hanya dari 'Belum Lengkap'/'Berkas Fisik'/NULL -> 'Menunggu Verifikasi'
  IF NEW.status_pendaftaran IS DISTINCT FROM OLD.status_pendaftaran THEN
    IF NOT (
      (OLD.status_pendaftaran IN ('Belum Lengkap', 'Berkas Fisik') OR OLD.status_pendaftaran IS NULL)
      AND NEW.status_pendaftaran = 'Menunggu Verifikasi'
    ) THEN
      RAISE EXCEPTION 'Akses ditolak: Siswa hanya dapat mengubah status menjadi "Menunggu Verifikasi" saat melengkapi berkas.';
    END IF;
  END IF;

  -- 3. Batas ukuran JSONB (32 KB) — hanya kolom yang diubah
  IF (NEW.data_diri IS DISTINCT FROM OLD.data_diri AND pg_column_size(NEW.data_diri) > 32768)
     OR (NEW.data_alamat IS DISTINCT FROM OLD.data_alamat AND pg_column_size(NEW.data_alamat) > 32768)
     OR (NEW.data_orang_tua IS DISTINCT FROM OLD.data_orang_tua AND pg_column_size(NEW.data_orang_tua) > 32768)
     OR (NEW.data_berkas IS DISTINCT FROM OLD.data_berkas AND pg_column_size(NEW.data_berkas) > 32768) THEN
    RAISE EXCEPTION 'Akses ditolak: Ukuran data JSON formulir melebihi batas 32 KB.';
  END IF;

  -- 4. Format no_wa (10-16 digit) — hanya bila diubah
  IF NEW.no_wa IS DISTINCT FROM OLD.no_wa
     AND NEW.no_wa IS NOT NULL AND NEW.no_wa <> ''
     AND regexp_replace(NEW.no_wa, '[^0-9]', '', 'g') !~ '^[0-9]{10,16}$' THEN
    RAISE EXCEPTION 'Format nomor WhatsApp tidak valid (harus 10-16 digit angka).';
  END IF;

  -- 5. NIK orang tua (16 digit) — hanya bila nilainya diubah
  IF (NEW.data_orang_tua->>'nik_ayah') IS DISTINCT FROM (OLD.data_orang_tua->>'nik_ayah')
     AND COALESCE(NEW.data_orang_tua->>'nik_ayah', '') <> ''
     AND regexp_replace(NEW.data_orang_tua->>'nik_ayah', '[^0-9]', '', 'g') !~ '^[0-9]{16}$' THEN
    RAISE EXCEPTION 'NIK Ayah harus terdiri dari tepat 16 digit angka.';
  END IF;
  IF (NEW.data_orang_tua->>'nik_ibu') IS DISTINCT FROM (OLD.data_orang_tua->>'nik_ibu')
     AND COALESCE(NEW.data_orang_tua->>'nik_ibu', '') <> ''
     AND regexp_replace(NEW.data_orang_tua->>'nik_ibu', '[^0-9]', '', 'g') !~ '^[0-9]{16}$' THEN
    RAISE EXCEPTION 'NIK Ibu harus terdiri dari tepat 16 digit angka.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profiles_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_privileged_db_session() OR public.is_admin() THEN
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
$$;

-- Flag must_change_password: hanya sistem (service_role/admin) atau RPC complete_password_change
-- yang boleh mengubahnya. RPC memakai penanda transaksi-lokal (GUC) karena di dalam fungsi
-- SECURITY DEFINER identitas pemanggil tetap siswa.
CREATE OR REPLACE FUNCTION public.protect_must_change_password_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_privileged_db_session() OR public.is_admin()
     OR COALESCE(current_setting('app.allow_flag_change', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    RAISE EXCEPTION 'Akses ditolak: Status ganti kata sandi hanya dapat diubah oleh sistem.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Autentikasi diperlukan.';
  END IF;

  PERFORM set_config('app.allow_flag_change', '1', true);   -- berlaku hanya di transaksi ini
  UPDATE public.profiles
     SET must_change_password = false
   WHERE id = v_uid;
  PERFORM set_config('app.allow_flag_change', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_password_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated, service_role;

-- Pastikan trigger terpasang (definisi trigger tidak berubah)
DROP TRIGGER IF EXISTS trg_protect_students_update ON public.students;
CREATE TRIGGER trg_protect_students_update
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.protect_students_update();

DROP TRIGGER IF EXISTS trg_protect_profiles_update ON public.profiles;
CREATE TRIGGER trg_protect_profiles_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profiles_update();

DROP TRIGGER IF EXISTS trg_protect_must_change_password ON public.profiles;
CREATE TRIGGER trg_protect_must_change_password
  BEFORE UPDATE OF must_change_password ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_must_change_password_flag();


-- ============================================================================
-- B. RAHASIA SEKALI-TAMPIL UNTUK RESET PASSWORD
-- Password sementara TIDAK lagi dikembalikan oleh /api/admin/reset-password.
-- API menyimpan password terenkripsi (AES-256-GCM, diikat ke admin+target) di tabel ini;
-- admin yang sama mengambilnya SEKALI lewat /api/admin/reset-password-reveal (TTL singkat),
-- setelah itu ciphertext dikosongkan. Tabel hanya dapat diakses service_role.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.password_reset_secrets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ciphertext      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  consumed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_password_reset_secrets_expires
  ON public.password_reset_secrets (expires_at);

ALTER TABLE public.password_reset_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.password_reset_secrets TO service_role;
-- Sengaja TANPA policy untuk anon/authenticated: akses klien ditolak total.


-- ============================================================================
-- C. BUCKET LEGACY 'berkas-spmb' -> PRIVATE
-- Hanya MENGUNCI akses; objek TIDAK dihapus (hapus hanya setelah dipastikan tidak
-- ada yang memakainya — lihat query audit di bagian bawah file ini).
-- Frontend tidak membaca bucket ini (hanya cleanup server saat hapus siswa, via service_role).
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'berkas-spmb') THEN
    UPDATE storage.buckets SET public = false WHERE id = 'berkas-spmb';
  END IF;
END $$;

-- Buang semua policy storage.objects yang menyebut bucket legacy (mis. "Public read").
-- Policy dokumen-ppdb dibuat ulang LENGKAP di bagian D, jadi tidak ada yang hilang.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (COALESCE(qual, '') ILIKE '%berkas-spmb%' OR COALESCE(with_check, '') ILIKE '%berkas-spmb%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Baca-saja untuk administrator (verifikasi/migrasi). Siswa & anonymous: DITOLAK.
DROP POLICY IF EXISTS "berkas_spmb_admin_select" ON storage.objects;
CREATE POLICY "berkas_spmb_admin_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'berkas-spmb'
    AND (SELECT public.is_admin())
  );


-- ============================================================================
-- D. STORAGE RLS 'dokumen-ppdb'
-- Struktur wajib: dokumen-ppdb/<USER_UUID>/<jenis>.<ext>
--   jenis : kartu_keluarga | ijazah_skl | akta_kelahiran | kartu_kip | pas_foto | piagam
--   ext   : pdf | jpg | png | webp
-- Siswa hanya boleh MENULIS dengan nama di atas (menolak ../, .html, .svg, .exe, ganda ekstensi,
-- subfolder) dan hanya jika memiliki data pendaftaran (akun sembarang hasil signup liar
-- tidak bisa memakai storage). Membaca/menghapus tetap hanya folder sendiri (+ admin).
-- Tidak ada perubahan perilaku untuk alur upload yang berjalan: path klien = {uid}/{jenis}.{ext}.
-- ============================================================================
UPDATE storage.buckets
   SET public = false,
       file_size_limit = 2097152,
       allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
 WHERE id = 'dokumen-ppdb';

DROP POLICY IF EXISTS "dokumen_ppdb_select_policy" ON storage.objects;
CREATE POLICY "dokumen_ppdb_select_policy"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dokumen-ppdb'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR (SELECT public.is_admin())
    )
  );

DROP POLICY IF EXISTS "dokumen_ppdb_insert_policy" ON storage.objects;
CREATE POLICY "dokumen_ppdb_insert_policy"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dokumen-ppdb'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND name ~ ('^' || (SELECT auth.uid())::text || '/(kartu_keluarga|ijazah_skl|akta_kelahiran|kartu_kip|pas_foto|piagam)\.(pdf|jpg|png|webp)$')
    AND EXISTS (SELECT 1 FROM public.students s WHERE s.user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "dokumen_ppdb_update_policy" ON storage.objects;
CREATE POLICY "dokumen_ppdb_update_policy"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'dokumen-ppdb'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR (SELECT public.is_admin())
    )
  )
  WITH CHECK (
    bucket_id = 'dokumen-ppdb'
    AND (
      (SELECT public.is_admin())
      OR (
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
        AND name ~ ('^' || (SELECT auth.uid())::text || '/(kartu_keluarga|ijazah_skl|akta_kelahiran|kartu_kip|pas_foto|piagam)\.(pdf|jpg|png|webp)$')
      )
    )
  );

DROP POLICY IF EXISTS "dokumen_ppdb_delete_policy" ON storage.objects;
CREATE POLICY "dokumen_ppdb_delete_policy"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'dokumen-ppdb'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR (SELECT public.is_admin())
    )
  );


-- ============================================================================
-- E. HAK EKSEKUSI FUNGSI & HAK TABEL (DEFENSE IN DEPTH)
-- Fungsi trigger tidak perlu dapat dipanggil klien (hak EXECUTE hanya diperiksa saat
-- CREATE TRIGGER, bukan saat trigger berjalan, jadi mencabutnya aman).
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_students_update()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profiles_update()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_must_change_password_flag() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activity_logs_set_actor()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_student_admin_changes()     FROM PUBLIC, anon, authenticated;

-- is_admin dipakai policy untuk role authenticated; anon tidak membutuhkannya.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Nomor pendaftaran: tidak untuk anonymous.
REVOKE EXECUTE ON FUNCTION public.generate_nomor_pendaftaran() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.generate_nomor_pendaftaran() TO authenticated, service_role;

-- Anonymous tidak memiliki alur apa pun ke tabel data pendaftar (RLS juga sudah menolak).
REVOKE ALL ON public.profiles    FROM anon;
REVOKE ALL ON public.students    FROM anon;
REVOKE ALL ON public.pembayaran  FROM anon;
REVOKE ALL ON public.activity_logs FROM anon;


-- ============================================================================
-- QUERY AUDIT (JANGAN dijalankan otomatis — salin & jalankan manual di SQL Editor)
-- ============================================================================
-- 1) Bucket & visibilitas:
--    SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets
--     WHERE id IN ('dokumen-ppdb','berkas-spmb');
--
-- 2) Policy storage yang aktif:
--    SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
--     WHERE schemaname='storage' AND tablename='objects' ORDER BY policyname;
--
-- 3) Apakah bucket legacy masih berisi objek? (hapus HANYA bila 0 / sudah termigrasi)
--    SELECT count(*) AS objek_legacy FROM storage.objects WHERE bucket_id='berkas-spmb';
--
-- 4) Objek legacy yang BELUM punya salinan di dokumen-ppdb (butuh pengecekan manual per siswa):
--    SELECT split_part(name,'/',1) AS nik, count(*) FROM storage.objects
--     WHERE bucket_id='berkas-spmb' GROUP BY 1 ORDER BY 2 DESC;
--
-- 5) Fungsi SECURITY DEFINER & hak EXECUTE:
--    SELECT p.proname, p.prosecdef, p.proconfig, p.proacl FROM pg_proc p
--      JOIN pg_namespace n ON n.oid=p.pronamespace
--     WHERE n.nspname='public' AND p.prosecdef ORDER BY 1;
--
-- 6) UJI TRIGGER di staging/SQL Editor (ganti <UUID_SISWA> dengan user_id siswa uji).
--    Semua blok di bawah HARUS menghasilkan ERROR "Akses ditolak: ..." lalu di-ROLLBACK:
--
--    BEGIN;
--      SET LOCAL ROLE authenticated;
--      SELECT set_config('request.jwt.claims', json_build_object('sub','<UUID_SISWA>','role','authenticated')::text, true);
--      UPDATE public.students SET status_pendaftaran = 'Diterima'   WHERE user_id = '<UUID_SISWA>';  -- HARUS ERROR
--    ROLLBACK;
--
--    BEGIN;
--      SET LOCAL ROLE authenticated;
--      SELECT set_config('request.jwt.claims', json_build_object('sub','<UUID_SISWA>','role','authenticated')::text, true);
--      UPDATE public.students SET catatan_admin = 'lulus'            WHERE user_id = '<UUID_SISWA>';  -- HARUS ERROR
--      UPDATE public.profiles SET role = 'admin'                     WHERE id      = '<UUID_SISWA>';  -- HARUS ERROR
--      UPDATE public.profiles SET must_change_password = false       WHERE id      = '<UUID_SISWA>';  -- HARUS ERROR
--    ROLLBACK;
--
--    Dan yang HARUS BERHASIL (alur normal siswa), juga di-ROLLBACK:
--      UPDATE public.students SET data_diri = data_diri WHERE user_id = '<UUID_SISWA>';
--      SELECT public.complete_password_change();
-- ============================================================================
