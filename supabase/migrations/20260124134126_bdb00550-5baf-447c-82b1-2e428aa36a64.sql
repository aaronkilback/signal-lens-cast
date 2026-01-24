-- Allow interview sessions to be created without an invitation (host-initiated)
ALTER TABLE public.interview_sessions 
ALTER COLUMN invitation_id DROP NOT NULL;