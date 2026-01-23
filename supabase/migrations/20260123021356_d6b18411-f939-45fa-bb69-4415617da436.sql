-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    display_name TEXT,
    role TEXT DEFAULT 'content_creator' CHECK (role IN ('admin', 'content_creator')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create doctrine_documents table for Silent Shield doctrine storage
CREATE TABLE public.doctrine_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    document_type TEXT DEFAULT 'doctrine' CHECK (document_type IN ('doctrine', 'framework', 'reference')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create episodes table for generated content
CREATE TABLE public.episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    risk_domains TEXT[] NOT NULL DEFAULT '{}',
    content_length INTEGER NOT NULL DEFAULT 10,
    tone_intensity TEXT NOT NULL DEFAULT 'strategic' CHECK (tone_intensity IN ('clinical', 'strategic', 'commanding')),
    output_mode TEXT NOT NULL DEFAULT 'podcast_script' CHECK (output_mode IN ('podcast_script', 'executive_briefing', 'field_intelligence', 'narrative_story')),
    script_content TEXT,
    audio_url TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'completed', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctrine_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Doctrine documents policies
CREATE POLICY "Users can view their own doctrine documents"
ON public.doctrine_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own doctrine documents"
ON public.doctrine_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own doctrine documents"
ON public.doctrine_documents FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own doctrine documents"
ON public.doctrine_documents FOR DELETE
USING (auth.uid() = user_id);

-- Episodes policies
CREATE POLICY "Users can view their own episodes"
ON public.episodes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own episodes"
ON public.episodes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own episodes"
ON public.episodes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own episodes"
ON public.episodes FOR DELETE
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_doctrine_documents_updated_at
    BEFORE UPDATE ON public.doctrine_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_episodes_updated_at
    BEFORE UPDATE ON public.episodes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, display_name)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();