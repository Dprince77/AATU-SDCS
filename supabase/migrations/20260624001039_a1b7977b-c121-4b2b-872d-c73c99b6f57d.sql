
-- 1) Move SECURITY DEFINER helpers out of the public API schema
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.is_staff(uuid) SET SCHEMA private;

-- Ensure search_path of moved functions still resolves public types/tables
ALTER FUNCTION private.has_role(uuid, public.app_role) SET search_path = public;
ALTER FUNCTION private.is_staff(uuid) SET search_path = public;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated;

-- 2) Lock down matric_number / staff_id on profiles to admins only
CREATE OR REPLACE FUNCTION private.enforce_profile_identifier_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.matric_number IS DISTINCT FROM OLD.matric_number
     OR NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
    IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Only an administrator can change matric_number or staff_id'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION private.enforce_profile_identifier_lock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_identifier_lock ON public.profiles;
CREATE TRIGGER trg_profiles_identifier_lock
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.enforce_profile_identifier_lock();

-- 3) Explicit deny on UPDATE for evidence storage objects (no upsert/overwrite)
DROP POLICY IF EXISTS "Evidence files: deny update" ON storage.objects;
CREATE POLICY "Evidence files: deny update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id <> 'evidence')
WITH CHECK (bucket_id <> 'evidence');

-- 4) Allow students who are the case subject to read evidence files for their case
DROP POLICY IF EXISTS "Evidence files: student subject read" ON storage.objects;
CREATE POLICY "Evidence files: student subject read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'evidence'
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE (c.id)::text = (storage.foldername(storage.objects.name))[1]
      AND c.student_id = auth.uid()
  )
);
