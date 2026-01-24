-- Guest invitations table
CREATE TABLE public.guest_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_user_id UUID NOT NULL,
  invite_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  guest_email TEXT,
  guest_name TEXT NOT NULL,
  topic TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  guest_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add social links and CTAs to guest_profiles
ALTER TABLE public.guest_profiles
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS cta_text TEXT,
ADD COLUMN IF NOT EXISTS cta_url TEXT,
ADD COLUMN IF NOT EXISTS invitation_id UUID,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Recording sessions table (for segment-based recording)
CREATE TABLE public.interview_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invitation_id UUID NOT NULL REFERENCES public.guest_invitations(id) ON DELETE CASCADE,
  guest_user_id UUID NOT NULL,
  host_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'recording', 'reviewing', 'completed')),
  final_video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Recording segments table (individual takes)
CREATE TABLE public.recording_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  segment_number INTEGER NOT NULL,
  start_time DECIMAL,
  end_time DECIMAL,
  video_url TEXT,
  transcript TEXT,
  status TEXT NOT NULL DEFAULT 'recording' CHECK (status IN ('recording', 'completed', 'discarded', 'selected')),
  is_retake BOOLEAN DEFAULT false,
  original_segment_id UUID REFERENCES public.recording_segments(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guest_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_segments ENABLE ROW LEVEL SECURITY;

-- Guest invitations policies
-- Hosts can manage their invitations
CREATE POLICY "Hosts can create invitations"
ON public.guest_invitations FOR INSERT
WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Hosts can view their invitations"
ON public.guest_invitations FOR SELECT
USING (auth.uid() = host_user_id OR auth.uid() = guest_user_id);

CREATE POLICY "Hosts can update their invitations"
ON public.guest_invitations FOR UPDATE
USING (auth.uid() = host_user_id OR auth.uid() = guest_user_id);

CREATE POLICY "Hosts can delete their invitations"
ON public.guest_invitations FOR DELETE
USING (auth.uid() = host_user_id);

-- Interview sessions policies
CREATE POLICY "Users can view their sessions"
ON public.interview_sessions FOR SELECT
USING (auth.uid() = host_user_id OR auth.uid() = guest_user_id);

CREATE POLICY "Guests can create sessions"
ON public.interview_sessions FOR INSERT
WITH CHECK (auth.uid() = guest_user_id);

CREATE POLICY "Users can update their sessions"
ON public.interview_sessions FOR UPDATE
USING (auth.uid() = host_user_id OR auth.uid() = guest_user_id);

-- Recording segments policies
CREATE POLICY "Users can view segments from their sessions"
ON public.recording_segments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.interview_sessions s
    WHERE s.id = session_id
    AND (s.host_user_id = auth.uid() OR s.guest_user_id = auth.uid())
  )
);

CREATE POLICY "Users can manage segments from their sessions"
ON public.recording_segments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.interview_sessions s
    WHERE s.id = session_id
    AND (s.host_user_id = auth.uid() OR s.guest_user_id = auth.uid())
  )
);

CREATE POLICY "Users can update segments from their sessions"
ON public.recording_segments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.interview_sessions s
    WHERE s.id = session_id
    AND (s.host_user_id = auth.uid() OR s.guest_user_id = auth.uid())
  )
);

CREATE POLICY "Users can delete segments from their sessions"
ON public.recording_segments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.interview_sessions s
    WHERE s.id = session_id
    AND (s.host_user_id = auth.uid() OR s.guest_user_id = auth.uid())
  )
);

-- Update guest_profiles RLS to allow guests to manage their invitation-linked profiles
CREATE POLICY "Guests can view profiles linked to their invitation"
ON public.guest_profiles FOR SELECT
USING (
  auth.uid() = user_id OR
  invitation_id IN (SELECT id FROM public.guest_invitations WHERE guest_user_id = auth.uid())
);

-- Triggers for updated_at
CREATE TRIGGER update_guest_invitations_updated_at
BEFORE UPDATE ON public.guest_invitations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_interview_sessions_updated_at
BEFORE UPDATE ON public.interview_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recording_segments_updated_at
BEFORE UPDATE ON public.recording_segments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('recordings', 'recordings', false);

-- Storage policies for recordings
CREATE POLICY "Users can upload their recordings"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their recordings"
ON storage.objects FOR SELECT
USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their recordings"
ON storage.objects FOR DELETE
USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);