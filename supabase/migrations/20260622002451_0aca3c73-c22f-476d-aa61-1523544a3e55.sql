
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'dsa', 'chair', 'committee', 'faculty', 'student');
CREATE TYPE public.case_status AS ENUM ('reported', 'under_review', 'hearing_scheduled', 'decided', 'closed', 'appealed');
CREATE TYPE public.case_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.sanction_type AS ENUM ('warning', 'probation', 'community_service', 'fine', 'suspension', 'expulsion', 'dismissed');
CREATE TYPE public.hearing_status AS ENUM ('scheduled', 'completed', 'cancelled', 'rescheduled');
CREATE TYPE public.apology_status AS ENUM ('submitted', 'accepted', 'rejected');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  matric_number TEXT UNIQUE,
  staff_id TEXT UNIQUE,
  department TEXT,
  level TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','dsa','chair','committee')
  )
$$;

-- Profile policies
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Staff read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admin update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Staff read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Cases
CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  student_matric TEXT NOT NULL,
  student_department TEXT,
  student_level TEXT,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  offense_category TEXT NOT NULL,
  description TEXT NOT NULL,
  incident_date DATE,
  incident_location TEXT,
  severity public.case_severity NOT NULL DEFAULT 'medium',
  status public.case_status NOT NULL DEFAULT 'reported',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own cases" ON public.cases
  FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Reporters view own filed cases" ON public.cases
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "Staff view all cases" ON public.cases
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Faculty/staff create cases" ON public.cases
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'faculty') OR public.is_staff(auth.uid())
  );
CREATE POLICY "Staff update cases" ON public.cases
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin delete cases" ON public.cases
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Auto case number
CREATE SEQUENCE IF NOT EXISTS public.case_number_seq START 1000;
CREATE OR REPLACE FUNCTION public.set_case_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.case_number IS NULL OR NEW.case_number = '' THEN
    NEW.case_number := 'DC-' || to_char(now(),'YYYY') || '-' || nextval('public.case_number_seq');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_set_case_number BEFORE INSERT ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_case_number();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_cases_updated BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Hearings
CREATE TABLE public.hearings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  status public.hearing_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  outcome TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hearings TO authenticated;
GRANT ALL ON public.hearings TO service_role;
ALTER TABLE public.hearings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hearings: student sees own" ON public.hearings
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.student_id = auth.uid())
  );
CREATE POLICY "Hearings: staff all" ON public.hearings
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Evidence
CREATE TABLE public.evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES public.profiles(id),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence TO authenticated;
GRANT ALL ON public.evidence TO service_role;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Evidence: student sees own case" ON public.evidence
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.student_id = auth.uid())
  );
CREATE POLICY "Evidence: reporter sees own case" ON public.evidence
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.reporter_id = auth.uid())
  );
CREATE POLICY "Evidence: staff all" ON public.evidence
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Evidence: reporter upload" ON public.evidence
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS(SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.reporter_id = auth.uid())
  );

-- Sanctions
CREATE TABLE public.sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  type public.sanction_type NOT NULL,
  description TEXT,
  duration_days INTEGER,
  starts_at DATE,
  ends_at DATE,
  issued_by UUID REFERENCES public.profiles(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sanctions TO authenticated;
GRANT ALL ON public.sanctions TO service_role;
ALTER TABLE public.sanctions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sanctions: student sees own" ON public.sanctions
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.student_id = auth.uid())
  );
CREATE POLICY "Sanctions: staff all" ON public.sanctions
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Apology letters
CREATE TABLE public.apology_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status public.apology_status NOT NULL DEFAULT 'submitted',
  reviewer_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apology_letters TO authenticated;
GRANT ALL ON public.apology_letters TO service_role;
ALTER TABLE public.apology_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apology: student own" ON public.apology_letters
  FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Apology: student insert own" ON public.apology_letters
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Apology: staff all" ON public.apology_letters
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Case history
CREATE TABLE public.case_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id),
  actor_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.case_history TO authenticated;
GRANT ALL ON public.case_history TO service_role;
ALTER TABLE public.case_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "History: student sees own" ON public.case_history
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.student_id = auth.uid())
  );
CREATE POLICY "History: reporter sees own" ON public.case_history
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.reporter_id = auth.uid())
  );
CREATE POLICY "History: staff all" ON public.case_history
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Auto-create profile + default student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, matric_number, department, level, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'matric_number',
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'level',
    NEW.raw_user_meta_data->>'phone'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
