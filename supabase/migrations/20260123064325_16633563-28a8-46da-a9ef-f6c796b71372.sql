-- Create guest_profiles table for storing podcast guest personas
CREATE TABLE public.guest_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL,
  expertise TEXT[] NOT NULL DEFAULT '{}',
  speaking_style TEXT,
  notable_quotes TEXT[],
  voice_id TEXT NOT NULL DEFAULT 'echo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.guest_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own guest profiles" 
ON public.guest_profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own guest profiles" 
ON public.guest_profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own guest profiles" 
ON public.guest_profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own guest profiles" 
ON public.guest_profiles 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_guest_profiles_updated_at
BEFORE UPDATE ON public.guest_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add guest_id column to episodes table to track which guest appeared
ALTER TABLE public.episodes 
ADD COLUMN guest_id UUID REFERENCES public.guest_profiles(id) ON DELETE SET NULL;