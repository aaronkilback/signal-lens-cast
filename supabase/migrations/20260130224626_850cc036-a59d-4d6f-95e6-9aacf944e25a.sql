-- Add file attachment columns to doctrine_documents
ALTER TABLE public.doctrine_documents
ADD COLUMN file_path text,
ADD COLUMN file_name text,
ADD COLUMN file_type text,
ADD COLUMN file_size_bytes bigint,
ADD COLUMN extracted_text text;

-- Create storage bucket for doctrine files
INSERT INTO storage.buckets (id, name, public)
VALUES ('doctrine-files', 'doctrine-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for doctrine-files bucket
CREATE POLICY "Users can view their own doctrine files"
ON storage.objects FOR SELECT
USING (bucket_id = 'doctrine-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own doctrine files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'doctrine-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own doctrine files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'doctrine-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own doctrine files"
ON storage.objects FOR DELETE
USING (bucket_id = 'doctrine-files' AND auth.uid()::text = (storage.foldername(name))[1]);