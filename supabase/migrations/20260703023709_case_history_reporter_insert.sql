-- Bug fix: case_history had no INSERT policy for a plain "reporter" — only
-- staff (FOR ALL) could insert history rows. This silently broke the
-- "Report submitted" / "Case filed" log entry for any non-staff reporter:
--   - self-filing students (pending_review flow)
--   - the pre-existing 'faculty' role, which was never part of is_staff()
--
-- Mirrors the existing "Evidence: reporter upload" policy pattern.
CREATE POLICY "History: reporter insert own" ON public.case_history
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.reporter_id = auth.uid())
  );
