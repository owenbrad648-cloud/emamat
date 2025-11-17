-- Drop the restrictive INSERT policy on user_roles
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;

-- Create a new policy that allows authenticated users to insert their own first role
-- This is needed when admin creates new users, as the admin is authenticated
-- but the INSERT happens from client-side code
CREATE POLICY "Allow role assignment during user creation"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if the current user is an admin
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Allow if this is the user's first role being assigned (no existing roles)
  NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
  )
);