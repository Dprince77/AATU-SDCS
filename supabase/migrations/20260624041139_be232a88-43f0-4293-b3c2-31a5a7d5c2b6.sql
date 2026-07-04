
-- 1. Add faculty to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS faculty text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_faculty_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_faculty_check
  CHECK (faculty IS NULL OR faculty IN (
    'Natural and Applied Sciences',
    'Engineering',
    'Environmental Sciences'
  ));

-- 2. Add faculty scope to user_roles (only deans use it)
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS faculty text;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_faculty_values_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_faculty_values_check
  CHECK (faculty IS NULL OR faculty IN (
    'Natural and Applied Sciences',
    'Engineering',
    'Environmental Sciences'
  ));
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_dean_requires_faculty;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_dean_requires_faculty
  CHECK (
    (role = 'dean' AND faculty IS NOT NULL)
    OR (role <> 'dean' AND faculty IS NULL)
  );

-- 3. Remove HOD usage
DELETE FROM public.user_roles WHERE role = 'hod';

DROP POLICY IF EXISTS "Managers update student profiles" ON public.profiles;
CREATE POLICY "Managers update student profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    (private.has_role(auth.uid(), 'dsa'::app_role)
      OR private.has_role(auth.uid(), 'dean'::app_role))
    AND NOT private.is_staff(id)
  )
  WITH CHECK (
    (private.has_role(auth.uid(), 'dsa'::app_role)
      OR private.has_role(auth.uid(), 'dean'::app_role))
    AND NOT private.is_staff(id)
  );

-- 4. Helper: which faculty does this dean own?
CREATE OR REPLACE FUNCTION private.dean_faculty(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT faculty
  FROM public.user_roles
  WHERE user_id = _user_id AND role = 'dean'
  LIMIT 1
$$;

-- 5. Dean read policies (faculty-scoped)
DROP POLICY IF EXISTS "Deans read faculty profiles" ON public.profiles;
CREATE POLICY "Deans read faculty profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'dean'::app_role)
    AND faculty IS NOT NULL
    AND faculty = private.dean_faculty(auth.uid())
  );

DROP POLICY IF EXISTS "Deans view faculty cases" ON public.cases;
CREATE POLICY "Deans view faculty cases" ON public.cases
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'dean'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = cases.student_id
        AND p.faculty = private.dean_faculty(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Deans view faculty hearings" ON public.hearings;
CREATE POLICY "Deans view faculty hearings" ON public.hearings
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'dean'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.cases c
      JOIN public.profiles p ON p.id = c.student_id
      WHERE c.id = hearings.case_id
        AND p.faculty = private.dean_faculty(auth.uid())
    )
  );

-- Allow dean to read user_roles (needed for joins/UI; safe — read only)
DROP POLICY IF EXISTS "Deans read user roles" ON public.user_roles;
CREATE POLICY "Deans read user roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'dean'::app_role));

-- 6. Capture faculty on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id text := NULLIF(NEW.raw_user_meta_data->>'staff_id', '');
  v_faculty  text := NULLIF(NEW.raw_user_meta_data->>'faculty', '');
BEGIN
  INSERT INTO public.profiles (id, full_name, email, matric_number, staff_id, department, level, phone, faculty)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'matric_number', ''),
    v_staff_id,
    NULLIF(NEW.raw_user_meta_data->>'department', ''),
    NULLIF(NEW.raw_user_meta_data->>'level', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    CASE WHEN v_faculty IN (
      'Natural and Applied Sciences','Engineering','Environmental Sciences'
    ) THEN v_faculty ELSE NULL END
  );
  IF v_staff_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  IF lower(NEW.email) = lower('yusufoyedele7@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
