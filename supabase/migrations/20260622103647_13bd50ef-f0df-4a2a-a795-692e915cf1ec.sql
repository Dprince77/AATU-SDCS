
-- 1. Tighten evidence storage INSERT policy: require case membership or staff
DROP POLICY IF EXISTS "Evidence files: reporter upload" ON storage.objects;
CREATE POLICY "Evidence files: reporter upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'evidence'
  AND (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.reporter_id = auth.uid()
    )
  )
);

-- 2. Replace uploader-read policy with an application-ownership join
DROP POLICY IF EXISTS "Evidence files: uploader read" ON storage.objects;
CREATE POLICY "Evidence files: uploader read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'evidence'
  AND EXISTS (
    SELECT 1 FROM public.evidence e
    WHERE e.file_path = storage.objects.name
      AND e.uploader_id = auth.uid()
  )
);

-- 3. Explicit admin-only INSERT/UPDATE/DELETE policies on user_roles
CREATE POLICY "Admins can insert user roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Lock down SECURITY DEFINER trigger function from direct API execution
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
