
-- 1. Replace identifier-lock trigger so admin/dsa/dean/hod can edit student identifiers
CREATE OR REPLACE FUNCTION private.enforce_profile_identifier_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.matric_number IS DISTINCT FROM OLD.matric_number
     OR NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
    IF private.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RETURN NEW;
    END IF;
    IF private.is_staff(NEW.id) THEN
      RAISE EXCEPTION 'Only administrators can change staff identifiers'
        USING ERRCODE = '42501';
    END IF;
    IF private.has_role(auth.uid(), 'dsa'::public.app_role)
       OR private.has_role(auth.uid(), 'dean'::public.app_role)
       OR private.has_role(auth.uid(), 'hod'::public.app_role) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'You are not allowed to change this identifier'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- 2. Allow DSA/Dean/HOD to update student profiles (admin already covered)
DROP POLICY IF EXISTS "Managers update student profiles" ON public.profiles;
CREATE POLICY "Managers update student profiles" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    (private.has_role(auth.uid(), 'dsa'::public.app_role)
     OR private.has_role(auth.uid(), 'dean'::public.app_role)
     OR private.has_role(auth.uid(), 'hod'::public.app_role))
    AND NOT private.is_staff(profiles.id)
  )
  WITH CHECK (
    (private.has_role(auth.uid(), 'dsa'::public.app_role)
     OR private.has_role(auth.uid(), 'dean'::public.app_role)
     OR private.has_role(auth.uid(), 'hod'::public.app_role))
    AND NOT private.is_staff(profiles.id)
  );

-- 3. Hearing unavailability columns
ALTER TABLE public.hearings
  ADD COLUMN IF NOT EXISTS unavailability_reason text,
  ADD COLUMN IF NOT EXISTS unavailability_status text
    CHECK (unavailability_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS unavailability_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS unavailability_reviewed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS unavailability_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS unavailability_review_notes text;

-- 4. Allow the linked student to update unavailability fields on their hearings
DROP POLICY IF EXISTS "Hearings: student unavailability" ON public.hearings;
CREATE POLICY "Hearings: student unavailability" ON public.hearings
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = hearings.case_id AND c.student_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = hearings.case_id AND c.student_id = auth.uid()
  ));

-- 5. Trigger constrains what students can touch + who can approve
CREATE OR REPLACE FUNCTION private.guard_hearing_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  status_changed boolean := NEW.unavailability_status IS DISTINCT FROM OLD.unavailability_status;
BEGIN
  -- Only committee or admin can change the unavailability decision
  IF status_changed THEN
    IF NOT (private.has_role(auth.uid(), 'committee'::public.app_role)
            OR private.has_role(auth.uid(), 'admin'::public.app_role)) THEN
      RAISE EXCEPTION 'Only the Disciplinary Committee can review unavailability'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.unavailability_status IN ('approved','rejected') THEN
      NEW.unavailability_reviewed_by := auth.uid();
      NEW.unavailability_reviewed_at := now();
    END IF;
  END IF;

  -- Staff can edit anything else
  IF private.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non-staff (student) updates: only unavailability_reason / review_notes-free fields allowed
  IF NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
     OR NEW.location IS DISTINCT FROM OLD.location
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.outcome IS DISTINCT FROM OLD.outcome
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.unavailability_status IS DISTINCT FROM OLD.unavailability_status
     OR NEW.unavailability_reviewed_by IS DISTINCT FROM OLD.unavailability_reviewed_by
     OR NEW.unavailability_reviewed_at IS DISTINCT FROM OLD.unavailability_reviewed_at
     OR NEW.unavailability_review_notes IS DISTINCT FROM OLD.unavailability_review_notes
  THEN
    RAISE EXCEPTION 'Students may only submit an unavailability reason'
      USING ERRCODE = '42501';
  END IF;

  NEW.unavailability_submitted_at := now();
  NEW.unavailability_status := 'pending';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_hearing_guard_update ON public.hearings;
CREATE TRIGGER trg_hearing_guard_update
  BEFORE UPDATE ON public.hearings
  FOR EACH ROW EXECUTE FUNCTION private.guard_hearing_update();

-- 6. Bootstrap admin role for the specified user (idempotent; runs when the user exists)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = lower('yusufoyedele7@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- 7. Reusable helper so future admins can be granted by email from SQL
CREATE OR REPLACE FUNCTION private.grant_role_by_email(_email text, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email);
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No user with email %', _email;
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION private.grant_role_by_email(text, public.app_role) FROM PUBLIC, anon, authenticated;
