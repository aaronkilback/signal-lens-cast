import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Library as LibraryIcon, Trash2, Eye, Clock, Target, Edit3, Video } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { OUTPUT_MODE_OPTIONS, LifeDomain, TargetAudience, ToneIntensity, OutputMode, VoiceOption } from '@/lib/aegis-types';

interface Episode {
  id: string;
  title: string;
  topic: string;
  target_audience: string;
  risk_domains: string[];
  content_length: number;
  tone_intensity: string;
  output_mode: string;
  script_content: string | null;
  status: string;
  created_at: string;
}

interface InterviewRecording {
  id: string;
  created_at: string;
  video_url: string | null;
  transcript: string | null;
  session_id: string;
  session?: {
    created_at: string;
    status: string;
  } | null;
}

export default function LibraryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);

  const [recordings, setRecordings] = useState<InterviewRecording[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<InterviewRecording | null>(null);
  const [recordingVideoUrl, setRecordingVideoUrl] = useState<string | null>(null);
  const [recordingVideoLoading, setRecordingVideoLoading] = useState(false);
  const [signedUrlCache, setSignedUrlCache] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchEpisodes();
    fetchRecordings();
  }, [user]);

  const fetchEpisodes = async () => {
    if (!user) {
      setEpisodes([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('episodes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching episodes:', error);
    } else {
      setEpisodes(data || []);
    }
    setLoading(false);
  };

  const fetchRecordings = async () => {
    if (!user) {
      setRecordings([]);
      setRecordingsLoading(false);
      return;
    }

    setRecordingsLoading(true);
    const { data, error } = await supabase
      .from('recording_segments')
      .select(
        `
        id,
        created_at,
        video_url,
        transcript,
        session_id,
        session:interview_sessions(created_at, status)
      `.trim()
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching interview recordings:', error);
      setRecordings([]);
    } else {
      // Supabase type inference can struggle with joined/aliased selects; runtime shape is correct.
      setRecordings(((data ?? []) as unknown as InterviewRecording[]) || []);
    }
    setRecordingsLoading(false);
  };

  const getSignedRecordingUrl = async (storagePath: string) => {
    if (signedUrlCache[storagePath]) return signedUrlCache[storagePath];

    const { data, error } = await supabase.storage
      .from('recordings')
      .createSignedUrl(storagePath, 60 * 60); // 1 hour

    if (error || !data?.signedUrl) {
      throw error || new Error('Failed to generate signed video URL');
    }

    setSignedUrlCache(prev => ({ ...prev, [storagePath]: data.signedUrl }));
    return data.signedUrl;
  };

  const openRecording = async (rec: InterviewRecording) => {
    setSelectedRecording(rec);
    setRecordingVideoUrl(null);
    if (!rec.video_url) return;

    setRecordingVideoLoading(true);
    try {
      const url = await getSignedRecordingUrl(rec.video_url);
      setRecordingVideoUrl(url);
    } catch (e) {
      console.error('Failed to load recording URL:', e);
      toast({
        title: 'Could not load video',
        description: 'This recording exists, but the video file could not be accessed.',
        variant: 'destructive',
      });
    } finally {
      setRecordingVideoLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('episodes').delete().eq('id', id);

    if (error) {
      toast({
        title: 'Delete Failed',
        description: 'Could not delete the episode.',
        variant: 'destructive',
      });
    } else {
      setEpisodes(episodes.filter(e => e.id !== id));
      toast({
        title: 'Episode Deleted',
        description: 'Removed from your library.',
      });
    }
  };

  const handleEditInGenerator = (episode: Episode) => {
    // Save episode data to localStorage so Generate page can load it
    const generatorState = {
      config: {
        topic: episode.topic,
        targetAudience: episode.target_audience as TargetAudience,
        lifeDomains: episode.risk_domains as LifeDomain[],
        contentLength: episode.content_length,
        toneIntensity: episode.tone_intensity as ToneIntensity,
        outputMode: episode.output_mode as OutputMode,
        voice: 'onyx' as VoiceOption,
      },
      generatedScript: episode.script_content || '',
      editableScript: episode.script_content || '',
      toneValue: [episode.tone_intensity === 'clinical' ? 0 : episode.tone_intensity === 'commanding' ? 100 : 50],
      loadedEpisodeId: episode.id,
    };
    localStorage.setItem('aegis-generate-state', JSON.stringify(generatorState));
    
    toast({
      title: 'Episode Loaded',
      description: 'Opening in generator for editing...',
    });
    
    navigate('/generate');
  };

  const getOutputModeLabel = (mode: string) => {
    return OUTPUT_MODE_OPTIONS.find(o => o.value === mode)?.label || mode;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const hasAnyContent = useMemo(() => episodes.length > 0 || recordings.length > 0, [episodes.length, recordings.length]);

  return (
    <AppLayout>
      <div className="container py-8 animate-fade-in">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <LibraryIcon className="h-5 w-5 text-primary" />
            </div>
            <h1 className="font-serif text-3xl font-semibold">Episode Library</h1>
          </div>
          <p className="text-muted-foreground">
            Access and manage your generated intelligence content.
          </p>
        </div>

        {/* Episodes */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif text-xl font-semibold">Episodes</h2>
              <p className="text-sm text-muted-foreground">Generated scripts and audio projects</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/generate">New Episode</a>
            </Button>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="aegis-card animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 bg-muted rounded w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : episodes.length === 0 ? (
            <Card className="aegis-card">
              <CardContent className="flex flex-col items-center justify-center py-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <LibraryIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-serif text-lg font-semibold mb-1">No Episodes Yet</h3>
                <p className="text-muted-foreground text-center max-w-md text-sm">
                  Generate your first piece of strategic intelligence content to populate your episodes.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {episodes.map((episode) => (
                <Card key={episode.id} className="aegis-card hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg line-clamp-2">{episode.title}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {formatDate(episode.created_at)}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {getOutputModeLabel(episode.output_mode)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-1">
                      {episode.risk_domains.map((domain) => (
                        <Badge key={domain} variant="outline" className="text-xs">
                          {domain}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Target className="h-4 w-4" />
                      <span>
                        {episode.content_length} min • {episode.tone_intensity}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedEpisode(episode)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditInGenerator(episode)}
                        title="Edit in Generator"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(episode.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Interview Recordings */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif text-xl font-semibold">Interview Recordings</h2>
              <p className="text-sm text-muted-foreground">Videos saved from the Interview Studio</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/interview">New Recording</a>
            </Button>
          </div>

          {recordingsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="aegis-card animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-2/3" />
                    <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 bg-muted rounded w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : recordings.length === 0 ? (
            <Card className="aegis-card">
              <CardContent className="flex flex-col items-center justify-center py-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <Video className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-serif text-lg font-semibold mb-1">No Recordings Yet</h3>
                <p className="text-muted-foreground text-center max-w-md text-sm">
                  Record a video interview in the Interview Studio and it will appear here automatically.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recordings.map((rec) => (
                <Card key={rec.id} className="aegis-card hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg line-clamp-2">Interview Recording</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {formatDate(rec.created_at)}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {rec.session?.status || 'saved'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {rec.transcript?.slice(0, 140) || 'Video saved (no transcript).'}
                    </p>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openRecording(rec)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!loading && !recordingsLoading && !hasAnyContent && (
            <p className="text-xs text-muted-foreground mt-6">
              Note: the Library is tied to your login—make sure you’re signed into the same account you used to record.
            </p>
          )}
        </div>

        {/* Episode Detail Dialog */}
        <Dialog open={!!selectedEpisode} onOpenChange={() => setSelectedEpisode(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            {selectedEpisode && (
              <>
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl">{selectedEpisode.title}</DialogTitle>
                  <DialogDescription>
                    {getOutputModeLabel(selectedEpisode.output_mode)} • {selectedEpisode.content_length} minutes • {selectedEpisode.tone_intensity}
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {selectedEpisode.script_content}
                  </pre>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button onClick={() => {
                    handleEditInGenerator(selectedEpisode);
                    setSelectedEpisode(null);
                  }}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit in Generator
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Recording Detail Dialog */}
        <Dialog
          open={!!selectedRecording}
          onOpenChange={() => {
            setSelectedRecording(null);
            setRecordingVideoUrl(null);
            setRecordingVideoLoading(false);
          }}
        >
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            {selectedRecording && (
              <>
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl">Interview Recording</DialogTitle>
                  <DialogDescription>
                    {formatDate(selectedRecording.created_at)} • {selectedRecording.session?.status || 'saved'}
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-4">
                  {selectedRecording.video_url ? (
                    recordingVideoUrl ? (
                      <video
                        className="w-full rounded-lg border"
                        src={recordingVideoUrl}
                        controls
                        playsInline
                      />
                    ) : (
                      <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
                        {recordingVideoLoading ? 'Loading video…' : 'Video not available.'}
                      </div>
                    )
                  ) : (
                    <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
                      Video not linked on this recording.
                    </div>
                  )}

                  {selectedRecording.transcript && (
                    <div>
                      <h4 className="font-medium mb-2">Transcript</h4>
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed rounded-lg border bg-muted/20 p-4">
                        {selectedRecording.transcript}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
