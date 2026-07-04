
-- 1. Update handle_new_user: assign 'staff' (not 'student') when staff_id is present
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_staff_id text := NULLIF(NEW.raw_user_meta_data->>'staff_id', '');
BEGIN
  INSERT INTO public.profiles (id, full_name, email, matric_number, staff_id, department, level, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'matric_number', ''),
    v_staff_id,
    NULLIF(NEW.raw_user_meta_data->>'department', ''),
    NULLIF(NEW.raw_user_meta_data->>'level', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', '')
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
END $function$;

-- 2. Trigger on profiles: when staff_id transitions from null/empty to non-null,
--    grant 'staff' and remove 'student'.
CREATE OR REPLACE FUNCTION public.sync_staff_role_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.staff_id IS NOT NULL AND NEW.staff_id <> '' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff')
    ON CONFLICT (user_id, role) DO NOTHING;
    -- Remove default 'student' role unless they also still have a matric number
    IF NEW.matric_number IS NULL OR NEW.matric_number = '' THEN
      PERFORM set_config('app.allow_remove_student_for_staff', 'on', true);
      DELETE FROM public.user_roles WHERE user_id = NEW.id AND role = 'student';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_staff_role ON public.profiles;
CREATE TRIGGER trg_sync_staff_role
  AFTER INSERT OR UPDATE OF staff_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_staff_role_from_profile();

-- 3. Protect Administration role: block deletes/updates that affect the admin
--    role through the API. To remove an admin role, run SQL directly with the
--    session GUC `app.allow_admin_role_mutation` set to 'on'.
CREATE OR REPLACE FUNCTION public.protect_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'admin')
     OR (TG_OP = 'UPDATE' AND (OLD.role = 'admin' OR NEW.role = 'admin')) THEN
    IF coalesce(current_setting('app.allow_admin_role_mutation', true), '') <> 'on' THEN
      RAISE EXCEPTION 'The Administration role is protected and cannot be modified from the app. Change it directly in the database.';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_protect_admin_role ON public.user_roles;
CREATE TRIGGER trg_protect_admin_role
  BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_admin_role();

-- 4. Backfill: existing profiles with a staff_id should have the 'staff' role
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'staff'::public.app_role
FROM public.profiles p
WHERE p.staff_id IS NOT NULL AND p.staff_id <> ''
ON CONFLICT (user_id, role) DO NOTHING;

-- Remove 'student' from those who have a staff_id and no matric_number
DELETE FROM public.user_roles ur
USING public.profiles p
WHERE ur.user_id = p.id
  AND ur.role = 'student'
  AND p.staff_id IS NOT NULL AND p.staff_id <> ''
  AND (p.matric_number IS NULL OR p.matric_number = '');
