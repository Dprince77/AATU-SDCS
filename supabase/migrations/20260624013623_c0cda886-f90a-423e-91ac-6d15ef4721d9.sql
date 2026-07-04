CREATE OR REPLACE FUNCTION private.enforce_profile_identifier_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF NEW.matric_number IS DISTINCT FROM OLD.matric_number
     OR NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
    -- Admin can always change
    IF private.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RETURN NEW;
    END IF;
    -- Allow the owner to set their identifier ONCE when it was previously empty
    -- (covers Google sign-ups completing their profile for the first time).
    IF auth.uid() = NEW.id
       AND (
         (OLD.matric_number IS NULL AND NEW.matric_number IS NOT NULL
            AND NEW.staff_id IS NOT DISTINCT FROM OLD.staff_id)
         OR (OLD.staff_id IS NULL AND NEW.staff_id IS NOT NULL
            AND NEW.matric_number IS NOT DISTINCT FROM OLD.matric_number)
       ) THEN
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
END $function$;