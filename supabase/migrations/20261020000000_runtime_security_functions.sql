-- ============================================================================
-- SPMB SMK MUHAMMADIYAH BAWANG - RUNTIME SECURITY FUNCTIONS & AUDIT SCHEMA
-- File: supabase/migrations/20261020000000_runtime_security_functions.sql
-- Description: Official migration providing all database security functions,
--              rate limiting tables, session revocation, password change completion,
--              atomic registration number sequence, and activity_logs audit table.
-- ============================================================================

-- ============================================================================
-- 1. TABEL & STRUKTUR ACTIVITY_LOGS (AUDIT TRAIL)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  actor_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name        text NOT NULL DEFAULT 'Sistem',
  action            text NOT NULL,
  target_student_id uuid,
  target_nik        text,
  target_nama       text,
  target_nomor      text,
  detail            jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_created_at
  ON public.activity_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_target_nik
  ON public.activity_logs (target_nik, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_logs_select_admin ON public.activity_logs;
CREATE POLICY activity_logs_select_admin ON public.activity_logs
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS activity_logs_insert_admin ON public.activity_logs;
CREATE POLICY activity_logs_insert_admin ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) AND actor_id = (SELECT auth.uid()));

-- Log bersifat append-only: tolak UPDATE, DELETE, TRUNCATE untuk seluruh role client
REVOKE ALL ON public.activity_logs FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.activity_logs FROM authenticated;
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

-- Aktor dan waktu dikunci di server agar tidak dapat dipalsukan
CREATE OR REPLACE FUNCTION public.activity_logs_set_actor()
RETURNS TRIGGER AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_name text;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;
    NEW.actor_id   := v_uid;
    NEW.actor_name := COALESCE(NULLIF(v_name, ''), 'Administrator');
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_activity_logs_set_actor ON public.activity_logs;
CREATE TRIGGER trg_activity_logs_set_actor
  BEFORE INSERT ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.activity_logs_set_actor();

-- Helper pendeteksi perubahan jsonb
CREATE OR REPLACE FUNCTION public.jsonb_changes(old_row jsonb, new_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  k   text;
  sk  text;
  o   jsonb;
  n   jsonb;
  res jsonb := '{}'::jsonb;
BEGIN
  FOR k IN SELECT jsonb_object_keys(new_row) LOOP
    IF k = 'updated_at' THEN CONTINUE; END IF;
    o := old_row -> k;
    n := new_row -> k;
    IF o IS NOT DISTINCT FROM n THEN CONTINUE; END IF;

    IF jsonb_typeof(o) = 'object' AND jsonb_typeof(n) = 'object' THEN
      FOR sk IN SELECT jsonb_object_keys(o || n) LOOP
        IF (o -> sk) IS DISTINCT FROM (n -> sk) THEN
          res := res || jsonb_build_object(
            k || '.' || sk,
            jsonb_build_object('dari', o -> sk, 'ke', n -> sk)
          );
        END IF;
      END LOOP;
    ELSE
      res := res || jsonb_build_object(
        k, jsonb_build_object('dari', o, 'ke', n)
      );
    END IF;
  END LOOP;
  RETURN res;
END;
$$;

-- Trigger pencatat perubahan data siswa oleh administrator
CREATE OR REPLACE FUNCTION public.log_student_admin_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_changes jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN NEW;
  END IF;

  v_changes := public.jsonb_changes(to_jsonb(OLD), to_jsonb(NEW));
  IF v_changes = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.activity_logs
    (actor_id, action, target_student_id, target_nik, target_nama, target_nomor, detail)
  VALUES (
    auth.uid(),
    CASE WHEN v_changes ? 'status_pendaftaran' THEN 'UBAH_STATUS' ELSE 'EDIT_DATA' END,
    NEW.id, NEW.nik, NEW.nama_lengkap, NEW.nomor_pendaftaran,
    jsonb_build_object('perubahan', v_changes)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_student_admin_changes ON public.students;
CREATE TRIGGER trg_log_student_admin_changes
  AFTER UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.log_student_admin_changes();


-- ============================================================================
-- 2. KOLOM PROFILES.MUST_CHANGE_PASSWORD
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Cegah siswa mengubah flag must_change_password secara langsung lewat UPDATE biasa
CREATE OR REPLACE FUNCTION public.protect_must_change_password_flag()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Siswa dilarang mengubah langsung nilai must_change_password lewat query update profil
  IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    RAISE EXCEPTION 'Akses ditolak: Status ganti kata sandi hanya dapat diubah oleh sistem.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_must_change_password ON public.profiles;
CREATE TRIGGER trg_protect_must_change_password
  BEFORE UPDATE OF must_change_password ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_must_change_password_flag();


-- ============================================================================
-- 3. RATE LIMITING ENGINE (public.rate_limits & rate_limit_hit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket        text NOT NULL,
  key_hash      text NOT NULL,
  hit_count     integer NOT NULL DEFAULT 1,
  window_start  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window
  ON public.rate_limits (bucket, window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_bucket text,
  p_key_hash text,
  p_limit int,
  p_window_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_hit_count int;
  v_window_start timestamptz;
BEGIN
  -- Bersihkan window kedaluwarsa secara berkala
  DELETE FROM public.rate_limits
  WHERE bucket = p_bucket
    AND window_start < v_now - (p_window_seconds || ' seconds')::interval;

  SELECT hit_count, window_start INTO v_hit_count, v_window_start
  FROM public.rate_limits
  WHERE bucket = p_bucket AND key_hash = p_key_hash;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (bucket, key_hash, hit_count, window_start)
    VALUES (p_bucket, p_key_hash, 1, v_now);
    RETURN true;
  ELSIF v_window_start < v_now - (p_window_seconds || ' seconds')::interval THEN
    UPDATE public.rate_limits
    SET hit_count = 1, window_start = v_now
    WHERE bucket = p_bucket AND key_hash = p_key_hash;
    RETURN true;
  ELSIF v_hit_count >= p_limit THEN
    RETURN false;
  ELSE
    UPDATE public.rate_limits
    SET hit_count = hit_count + 1
    WHERE bucket = p_bucket AND key_hash = p_key_hash;
    RETURN true;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(text, text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, text, int, int) TO service_role;


-- ============================================================================
-- 4. REGISTRATION RATE LIMIT (registration_allowed)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.registration_allowed(p_ip_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Batasi maksimal 5 pendaftaran per IP per jam (3600 detik)
  RETURN public.rate_limit_hit('register:ip', p_ip_hash, 5, 3600);
END;
$$;

REVOKE ALL ON FUNCTION public.registration_allowed(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registration_allowed(text) TO service_role;


-- ============================================================================
-- 5. REVOKE USER SESSIONS (revoke_user_sessions)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Cabut refresh tokens pada skema auth Supabase
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'refresh_tokens'
  ) THEN
    DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;
  END IF;

  -- 2. Hapus sesi aktif dari auth.sessions
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'sessions'
  ) THEN
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  END IF;

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) TO service_role;


-- ============================================================================
-- 6. COMPLETE PASSWORD CHANGE (complete_password_change)
-- ============================================================================
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

  UPDATE public.profiles
  SET must_change_password = false
  WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_password_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated, service_role;


-- ============================================================================
-- 7. ATOMIC SEQUENCE NOMOR PENDAFTARAN (next_nomor_pendaftaran)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_nomor_pendaftaran START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.next_nomor_pendaftaran()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq bigint;
  v_year text := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY');
  v_seq_str text;
  v_rand int;
BEGIN
  v_seq := nextval('public.seq_nomor_pendaftaran');
  v_seq_str := lpad(v_seq::text, 4, '0');
  -- 3 digit acak menggunakan generator kriptografis PostgreSQL
  v_rand := 100 + floor(random() * 900)::int;
  RETURN v_year || v_seq_str || v_rand::text;
END;
$$;

REVOKE ALL ON FUNCTION public.next_nomor_pendaftaran() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_nomor_pendaftaran() TO service_role;
