
-- Backfill profiles for any auth user without a profile row
INSERT INTO public.profiles (id, full_name, email, matric_number, staff_id, department, level, phone)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.email),
  u.email,
  NULLIF(u.raw_user_meta_data->>'matric_number', ''),
  NULLIF(u.raw_user_meta_data->>'staff_id', ''),
  NULLIF(u.raw_user_meta_data->>'department', ''),
  NULLIF(u.raw_user_meta_data->>'level', ''),
  NULLIF(u.raw_user_meta_data->>'phone', '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Ensure everyone has a base role: 'staff' if staff_id is set, otherwise 'student'
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, CASE WHEN p.staff_id IS NOT NULL AND p.staff_id <> '' THEN 'staff'::public.app_role ELSE 'student'::public.app_role END
FROM public.profiles p
LEFT JOIN public.user_roles r
  ON r.user_id = p.id
  AND r.role = (CASE WHEN p.staff_id IS NOT NULL AND p.staff_id <> '' THEN 'staff'::public.app_role ELSE 'student'::public.app_role END)
WHERE r.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;
