-- Only the Disciplinary Committee (or admin, as an override) may approve or
-- dismiss a self-filed report while it's in 'pending_review'. Other staff
-- roles (dsa, dean, lecturer, chair, staff) can still see it (unchanged
-- "Staff view all cases" SELECT policy) but can no longer update it until
-- it's been moved out of pending_review.
DROP POLICY IF EXISTS "Staff update cases" ON public.cases;
CREATE POLICY "Staff update cases" ON public.cases
  FOR UPDATE TO authenticated USING (
    private.is_staff(auth.uid())
    AND (
      status <> 'pending_review'
      OR private.has_role(auth.uid(), 'committee'::public.app_role)
      OR private.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

NOTIFY pgrst, 'reload schema';
