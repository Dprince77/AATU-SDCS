-- Attach the trigger (it was missing, so Google sign-ups never got a profile row).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for users created before the trigger existed.
INSERT INTO public.profiles (id, full_name, email, matric_number, staff_id, department, level, phone)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
  u.email,
  NULLIF(u.raw_user_meta_data->>'matric_number', ''),
  NULLIF(u.raw_user_meta_data->>'staff_id', ''),
  NULLIF(u.raw_user_meta_data->>'department', ''),
  NULLIF(u.raw_user_meta_data->>'level', ''),
  NULLIF(u.raw_user_meta_data->>'phone', '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Make sure every user has at least the default student role.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'student'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'student'
);