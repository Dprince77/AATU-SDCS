-- Fix: align private.is_staff() with the frontend STAFF role list.
-- Previously only checked: admin, dsa, chair, committee
-- The frontend treats dean, lecturer, and staff as staff too, causing RLS mismatches.

CREATE OR REPLACE FUNCTION private.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'dsa', 'chair', 'committee', 'dean', 'lecturer', 'staff')
  )
$$;
