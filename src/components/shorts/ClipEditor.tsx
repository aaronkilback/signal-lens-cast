import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Sparkles, Loader2, Plus, Play, Pause, Scissors, Type, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CaptionPreview } from './CaptionPreview';
import type { VideoUpload, VideoClip } from '@/pages/Shorts';

interface ClipEditorProps {
  video: VideoUpload;
  existingClips: VideoClip[];
  onClipCreated: (clip: VideoClip) => void;
  onBack: () => void;
}

interface SuggestedClip {
  start_time: number;
  end_time: number;
  title: string;
  hook: string;
  headline: string;
  score: number;
  reason: string;
}

export function ClipEditor({ video, existingClips, onClipCreated, onBack }: ClipEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Clip creation state
  const [clipTitle, setClipTitle] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(60);
  const [headlineText, setHeadlineText] = useState('');
  const [isCreatingClip, setIsCreatingClip] = useState(false);
  
  // AI suggestions
  const [suggestedClips, setSuggestedClips] = useState<SuggestedClip[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Load video URL
  useEffect(() => {
    const loadVideo = async () => {
      try {
        const { data, error } = await supabase.storage
          .from('videos')
          .createSignedUrl(video.storage_path, 3600);

        if (error) throw error;
        setVideoUrl(data.signedUrl);
      } catch (error) {
        console.error('Error loading video:', error);
        toast({
          title: 'Error',
          description: 'Failed to load video',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingVideo(false);
      }
    };
    loadVideo();
  }, [video.storage_path, toast]);

  // Video event handlers
  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setEndTime(Math.min(60, videoRef.current.duration));
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get AI suggestions
  const getSuggestions = async () => {
    if (!video.transcription || !video.transcription_segments) {
      toast({
        title: 'No Transcription',
        description: 'The video needs to be transcribed first',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-clips`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            transcription: video.transcription,
            segments: video.transcription_segments,
            duration: video.duration_seconds || duration,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get suggestions');
      }

      const data = await response.json();
      setSuggestedClips(data.clips || []);

      if (data.clips?.length > 0) {
        toast({
          title: 'AI Suggestions Ready',
          description: `Found ${data.clips.length} potential viral clips`,
        });
      }
    } catch (error) {
      console.error('Suggestion error:', error);
      toast({
        title: 'Suggestion Failed',
        description: 'Could not generate clip suggestions',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Apply a suggestion
  const applySuggestion = (suggestion: SuggestedClip) => {
    setStartTime(suggestion.start_time);
    setEndTime(suggestion.end_time);
    setClipTitle(suggestion.title);
    setHeadlineText(suggestion.headline);
    seekTo(suggestion.start_time);
  };

  // Create clip
  const createClip = async () => {
    if (!user || !clipTitle.trim()) {
      toast({
        title: 'Missing Title',
        description: 'Please enter a title for the clip',
        variant: 'destructive',
      });
      return;
    }

    if (endTime <= startTime) {
      toast({
        title: 'Invalid Time Range',
        description: 'End time must be after start time',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingClip(true);
    try {
      // Get captions for this clip range
      let captions: any[] = [];
      if (video.transcription_segments) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-captions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              segments: video.transcription_segments,
              startTime,
              endTime,
              style: 'martell',
            }),
          }
        );

        if (response.ok) {
          const captionData = await response.json();
          captions = captionData.captions || [];
        }
      }

      // Create clip record
      const { data: clip, error } = await supabase
        .from('video_clips')
        .insert({
          user_id: user.id,
          source_video_id: video.id,
          title: clipTitle.trim(),
          start_time: startTime,
          end_time: endTime,
          headline_text: headlineText.trim() || null,
          captions,
          ai_suggested: suggestedClips.some(
            s => s.start_time === startTime && s.end_time === endTime
          ),
        })
        .select()
        .single();

      if (error) throw error;

      onClipCreated(clip);
      
      // Reset form
      setClipTitle('');
      setHeadlineText('');
      setStartTime(0);
      setEndTime(Math.min(60, duration));
    } catch (error) {
      console.error('Create clip error:', error);
      toast({
        title: 'Failed to Create Clip',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingClip(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold">{video.title}</h2>
          <p className="text-sm text-muted-foreground">Create clips from this video</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Video Preview */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-0">
              {isLoadingVideo ? (
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full aspect-video bg-black"
                  onLoadedMetadata={handleVideoLoaded}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              ) : (
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <p className="text-muted-foreground">Failed to load video</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Video Controls */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={togglePlay}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <span className="text-sm font-mono">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Clip Range</span>
                  <span className="text-muted-foreground">
                    {formatTime(startTime)} - {formatTime(endTime)} ({formatTime(endTime - startTime)})
                  </span>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Start</Label>
                    <Slider
                      value={[startTime]}
                      max={duration}
                      step={0.1}
                      onValueChange={([val]) => {
                        setStartTime(val);
                        if (val >= endTime) setEndTime(val + 1);
                        seekTo(val);
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">End</Label>
                    <Slider
                      value={[endTime]}
                      max={duration}
                      step={0.1}
                      onValueChange={([val]) => {
                        setEndTime(val);
                        if (val <= startTime) setStartTime(val - 1);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setStartTime(currentTime); }}
                >
                  Set Start
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setEndTime(currentTime); }}
                >
                  Set End
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => seekTo(startTime)}
                >
                  Go to Start
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Tabs defaultValue="create">
            <TabsList className="w-full">
              <TabsTrigger value="create" className="flex-1">
                <Scissors className="h-4 w-4 mr-2" />
                Create
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex-1">
                <Sparkles className="h-4 w-4 mr-2" />
                AI Suggest
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">New Clip</CardTitle>
                  <CardDescription>
                    Set the time range above, then add details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="clipTitle">Clip Title *</Label>
                    <Input
                      id="clipTitle"
                      value={clipTitle}
                      onChange={(e) => setClipTitle(e.target.value)}
                      placeholder="e.g., Why Most CEOs Fail"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headline">Headline Overlay</Label>
                    <Input
                      id="headline"
                      value={headlineText}
                      onChange={(e) => setHeadlineText(e.target.value)}
                      placeholder="e.g., THE TRUTH ABOUT SUCCESS"
                    />
                    <p className="text-xs text-muted-foreground">
                      Bold text that appears over the video
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    onClick={createClip}
                    disabled={isCreatingClip || !clipTitle.trim()}
                  >
                    {isCreatingClip ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Clip
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Existing clips */}
              {existingClips.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Your Clips ({existingClips.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {existingClips.map((clip) => (
                          <div
                            key={clip.id}
                            className="p-2 rounded border bg-muted/50 cursor-pointer hover:bg-muted"
                            onClick={() => {
                              setStartTime(clip.start_time);
                              setEndTime(clip.end_time);
                              seekTo(clip.start_time);
                            }}
                          >
                            <p className="text-sm font-medium line-clamp-1">{clip.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(clip.start_time)} - {formatTime(clip.end_time)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">AI Clip Suggestions</CardTitle>
                  <CardDescription>
                    Let AI find the most viral-worthy moments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={getSuggestions}
                    disabled={isLoadingSuggestions || !video.transcription}
                  >
                    {isLoadingSuggestions ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Find Best Clips
                      </>
                    )}
                  </Button>
                  {!video.transcription && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Waiting for transcription to complete...
                    </p>
                  )}
                </CardContent>
              </Card>

              {suggestedClips.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Suggested Clips</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-80">
                      <div className="space-y-3">
                        {suggestedClips.map((suggestion, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border bg-card hover:border-primary cursor-pointer transition-colors"
                            onClick={() => applySuggestion(suggestion)}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-sm font-medium">{suggestion.title}</p>
                              <Badge variant="secondary" className="shrink-0">
                                {suggestion.score}/10
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {suggestion.hook}
                            </p>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {formatTime(suggestion.start_time)} - {formatTime(suggestion.end_time)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {suggestion.headline}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
