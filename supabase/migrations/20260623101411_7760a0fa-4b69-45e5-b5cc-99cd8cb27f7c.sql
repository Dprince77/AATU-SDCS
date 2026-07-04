
-- Auto-link cases to student profile by matric number
CREATE OR REPLACE FUNCTION public.link_case_to_student()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.student_id IS NULL AND NEW.student_matric IS NOT NULL THEN
    SELECT id INTO NEW.student_id
    FROM public.profiles
    WHERE matric_number = NEW.student_matric
    LIMIT 1;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_link_case_to_student_ins ON public.cases;
CREATE TRIGGER trg_link_case_to_student_ins
  BEFORE INSERT ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.link_case_to_student();

DROP TRIGGER IF EXISTS trg_link_case_to_student_upd ON public.cases;
CREATE TRIGGER trg_link_case_to_student_upd
  BEFORE UPDATE OF student_matric ON public.cases
  FOR EACH ROW
  WHEN (NEW.student_id IS NULL)
  EXECUTE FUNCTION public.link_case_to_student();

-- When a new student profile is created, link any existing cases filed against their matric
CREATE OR REPLACE FUNCTION public.link_cases_to_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.matric_number IS NOT NULL THEN
    UPDATE public.cases
    SET student_id = NEW.id
    WHERE student_matric = NEW.matric_number
      AND student_id IS NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_link_cases_to_new_profile ON public.profiles;
CREATE TRIGGER trg_link_cases_to_new_profile
  AFTER INSERT OR UPDATE OF matric_number ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.link_cases_to_new_profile();

-- Backfill: link existing cases to matching student profiles
UPDATE public.cases c
SET student_id = p.id
FROM public.profiles p
WHERE c.student_id IS NULL
  AND c.student_matric IS NOT NULL
  AND p.matric_number = c.student_matric;

-- Add semester duration column for sanctions (1-semester suspension, 2-semester, etc.)
ALTER TABLE public.sanctions
  ADD COLUMN IF NOT EXISTS duration_semesters integer;
