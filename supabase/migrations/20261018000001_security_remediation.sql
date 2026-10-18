-- Security remediation for payment ownership and private document lifecycle.

-- 1. Enforce consistency between payment.user_id/nik and the referenced student.
CREATE OR REPLACE FUNCTION public.validate_pembayaran_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_user_id UUID;
  v_student_nik TEXT;
BEGIN
  IF NEW.student_id IS NULL THEN
    RAISE EXCEPTION 'student_id wajib diisi';
  END IF;

  SELECT s.user_id, s.nik
    INTO v_student_user_id, v_student_nik
  FROM public.students AS s
  WHERE s.id = NEW.student_id;

  IF v_student_user_id IS NULL THEN
    RAISE EXCEPTION 'student_id tidak ditemukan';
  END IF;

  IF NEW.user_id IS DISTINCT FROM v_student_user_id
     OR NEW.nik IS DISTINCT FROM v_student_nik THEN
    RAISE EXCEPTION 'Relasi pembayaran dengan siswa tidak valid';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_pembayaran_owner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_pembayaran_owner ON public.pembayaran;
CREATE TRIGGER validate_pembayaran_owner
  BEFORE INSERT OR UPDATE OF student_id, user_id, nik
  ON public.pembayaran
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pembayaran_owner();

DROP POLICY IF EXISTS "pembayaran_insert_policy" ON public.pembayaran;
CREATE POLICY "pembayaran_insert_policy"
  ON public.pembayaran
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      (SELECT auth.uid()) = user_id
      AND status = 'Menunggu Verifikasi'
      AND EXISTS (
        SELECT 1
        FROM public.students AS s
        WHERE s.id = pembayaran.student_id
          AND s.user_id = (SELECT auth.uid())
          AND s.nik = pembayaran.nik
      )
    )
    OR (SELECT public.is_admin())
  );

-- 2. Match the client uploadBerkas.ts lifecycle without making the bucket public.
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
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR (SELECT public.is_admin())
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
