-- Allow anyone to read a specific invitation by token (for validation)
CREATE POLICY "Anyone can validate invitation by token"
ON public.guest_invitations FOR SELECT
USING (true);

-- Drop the old restrictive select policy
DROP POLICY IF EXISTS "Hosts can view their invitations" ON public.guest_invitations;