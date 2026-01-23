-- Add columns for episode continuity
ALTER TABLE public.episodes 
ADD COLUMN IF NOT EXISTS episode_number SERIAL,
ADD COLUMN IF NOT EXISTS key_stories TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS people_mentioned TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS themes TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS episode_summary TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_episodes_user_created ON public.episodes(user_id, created_at DESC);