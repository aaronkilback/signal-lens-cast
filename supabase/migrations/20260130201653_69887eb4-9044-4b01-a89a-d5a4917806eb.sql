-- Create video_uploads table for source videos
CREATE TABLE public.video_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  duration_seconds NUMERIC,
  file_size_bytes BIGINT,
  mime_type TEXT,
  thumbnail_path TEXT,
  transcription TEXT,
  transcription_segments JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'uploading',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create video_clips table for extracted shorts
CREATE TABLE public.video_clips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_video_id UUID NOT NULL REFERENCES public.video_uploads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_time NUMERIC NOT NULL,
  end_time NUMERIC NOT NULL,
  duration_seconds NUMERIC GENERATED ALWAYS AS (end_time - start_time) STORED,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  ai_suggested BOOLEAN DEFAULT false,
  ai_score NUMERIC,
  headline_text TEXT,
  caption_style JSONB DEFAULT '{"font": "bold", "position": "center", "animation": "word-by-word"}'::jsonb,
  captions JSONB DEFAULT '[]'::jsonb,
  exported_path TEXT,
  export_status TEXT DEFAULT 'draft',
  platform TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_clips ENABLE ROW LEVEL SECURITY;

-- RLS policies for video_uploads
CREATE POLICY "Users can view their own videos" ON public.video_uploads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own videos" ON public.video_uploads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own videos" ON public.video_uploads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own videos" ON public.video_uploads FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for video_clips
CREATE POLICY "Users can view their own clips" ON public.video_clips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own clips" ON public.video_clips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own clips" ON public.video_clips FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own clips" ON public.video_clips FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_video_uploads_updated_at BEFORE UPDATE ON public.video_uploads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_video_clips_updated_at BEFORE UPDATE ON public.video_clips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for videos
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('videos', 'videos', false, 524288000);

-- Storage policies for videos bucket
CREATE POLICY "Users can upload their own videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view their own videos" ON storage.objects FOR SELECT USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own videos" ON storage.objects FOR UPDATE USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own videos" ON storage.objects FOR DELETE USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);