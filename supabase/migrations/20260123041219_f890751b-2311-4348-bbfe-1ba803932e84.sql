-- Create marketing_assets table to store episode assets
CREATE TABLE public.marketing_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('show_notes', 'chapter_markers', 'transcript', 'social_posts', 'blog_post')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(episode_id, asset_type)
);

-- Enable RLS
ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own marketing assets"
  ON public.marketing_assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own marketing assets"
  ON public.marketing_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own marketing assets"
  ON public.marketing_assets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own marketing assets"
  ON public.marketing_assets FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_marketing_assets_updated_at
  BEFORE UPDATE ON public.marketing_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();