-- Add a third reportee_type: "non_staff" for non-academic/support staff who
-- aren't students or teaching/administrative staff — security, cleaners,
-- porters, etc. Keeps the existing 'student' / 'staff' values untouched.
ALTER TABLE public.cases
  DROP CONSTRAINT IF EXISTS cases_reportee_type_check;

ALTER TABLE public.cases
  ADD CONSTRAINT cases_reportee_type_check
    CHECK (reportee_type IN ('student', 'staff', 'non_staff'));
