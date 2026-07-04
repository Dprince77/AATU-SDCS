
-- Fix search_path on remaining functions
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.set_case_number() SET search_path = public;

-- Revoke broad EXECUTE access on security-definer helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Storage policies for evidence bucket
CREATE POLICY "Evidence files: staff read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'evidence' AND public.is_staff(auth.uid())
  );
CREATE POLICY "Evidence files: staff write" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'evidence' AND public.is_staff(auth.uid())
  );
CREATE POLICY "Evidence files: uploader read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'evidence' AND owner = auth.uid()
  );
CREATE POLICY "Evidence files: reporter upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'evidence' AND auth.uid() IS NOT NULL
  );
CREATE POLICY "Evidence files: staff delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'evidence' AND public.is_staff(auth.uid())
  );
