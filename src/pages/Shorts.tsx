import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { VideoUploader } from '@/components/shorts/VideoUploader';
import { VideoLibrary } from '@/components/shorts/VideoLibrary';
import { ClipEditor } from '@/components/shorts/ClipEditor';
import { Upload, Film, Scissors, Sparkles } from 'lucide-react';

export interface VideoUpload {
  id: string;
  title: string;
  description: string | null;
  original_filename: string;
  storage_path: string;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  transcription: string | null;
  transcription_segments: unknown;
  status: string;
  created_at: string;
}

export interface VideoClip {
  id: string;
  source_video_id: string;
  title: string;
  start_time: number;
  end_time: number;
  duration_seconds: number;
  aspect_ratio: string;
  ai_suggested: boolean;
  ai_score: number | null;
  headline_text: string | null;
  caption_style: unknown;
  captions: unknown;
  export_status: string;
  platform: string | null;
}

export default function Shorts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('upload');
  const [videos, setVideos] = useState<VideoUpload[]>([]);
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoUpload | null>(null);
  const [selectedClip, setSelectedClip] = useState<VideoClip | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVideos = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('video_uploads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  }, [user]);

  const fetchClips = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('video_clips')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClips(data || []);
    } catch (error) {
      console.error('Error fetching clips:', error);
    }
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchVideos(), fetchClips()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchVideos, fetchClips]);

  const handleVideoUploaded = (video: VideoUpload) => {
    setVideos(prev => [video, ...prev]);
    setSelectedVideo(video);
    setActiveTab('library');
    toast({
      title: 'Video Uploaded',
      description: 'Your video is being processed. Transcription will start shortly.',
    });
  };

  const handleVideoSelect = (video: VideoUpload) => {
    setSelectedVideo(video);
    setActiveTab('edit');
  };

  const handleClipCreated = (clip: VideoClip) => {
    setClips(prev => [clip, ...prev]);
    setSelectedClip(clip);
    toast({
      title: 'Clip Created',
      description: 'Your short clip has been created. Now add captions and export!',
    });
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Shorts Studio</h1>
            <p className="text-muted-foreground">
              Turn your videos into viral Instagram Reels & YouTube Shorts
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Dan Martell Style</span>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="library" className="flex items-center gap-2">
              <Film className="h-4 w-4" />
              Library
            </TabsTrigger>
            <TabsTrigger value="edit" className="flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              Edit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Video</CardTitle>
                <CardDescription>
                  Upload your source video (up to 500MB). We'll transcribe it and help you find the best clips.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VideoUploader onVideoUploaded={handleVideoUploaded} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="library" className="space-y-6">
            <VideoLibrary
              videos={videos}
              clips={clips}
              isLoading={isLoading}
              onVideoSelect={handleVideoSelect}
              onRefresh={fetchVideos}
            />
          </TabsContent>

          <TabsContent value="edit" className="space-y-6">
            {selectedVideo ? (
              <ClipEditor
                video={selectedVideo}
                existingClips={clips.filter(c => c.source_video_id === selectedVideo.id)}
                onClipCreated={handleClipCreated}
                onBack={() => setActiveTab('library')}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Scissors className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Video Selected</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Select a video from your library to start creating clips
                  </p>
                  <Button onClick={() => setActiveTab('library')}>
                    Go to Library
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
