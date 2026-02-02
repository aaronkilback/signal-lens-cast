-- Create table for AI-to-AI interview sessions and transcripts
CREATE TABLE public.agent_interviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  agent_codename TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  topic TEXT,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  audio_url TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.agent_interviews ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own agent interviews" 
ON public.agent_interviews 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own agent interviews" 
ON public.agent_interviews 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agent interviews" 
ON public.agent_interviews 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agent interviews" 
ON public.agent_interviews 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_agent_interviews_updated_at
BEFORE UPDATE ON public.agent_interviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_agent_interviews_user_id ON public.agent_interviews(user_id);
CREATE INDEX idx_agent_interviews_created_at ON public.agent_interviews(created_at DESC);