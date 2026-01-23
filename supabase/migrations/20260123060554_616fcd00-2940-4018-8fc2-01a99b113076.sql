-- Create episode_feedback table for learning loop
CREATE TABLE public.episode_feedback (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    what_worked TEXT,
    what_didnt_work TEXT,
    tone_feedback TEXT,
    pacing_feedback TEXT,
    story_quality_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.episode_feedback ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own feedback"
ON public.episode_feedback
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own feedback"
ON public.episode_feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
ON public.episode_feedback
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback"
ON public.episode_feedback
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_episode_feedback_updated_at
BEFORE UPDATE ON public.episode_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();