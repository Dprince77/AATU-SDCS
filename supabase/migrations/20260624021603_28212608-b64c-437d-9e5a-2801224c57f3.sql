
-- 1. Add 'staff' value to app_role enum if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid='public.app_role'::regtype AND enumlabel='staff') THEN
    ALTER TYPE public.app_role ADD VALUE 'staff';
  END IF;
END $$;
