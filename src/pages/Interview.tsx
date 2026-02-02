import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RealtimeInterview } from '@/components/RealtimeInterview';
import { VideoRealtimeInterview } from '@/components/VideoRealtimeInterview';
import { GuestSelector } from '@/components/GuestSelector';
import { TranscriptEntry } from '@/hooks/useRealtimeInterview';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Mic, FileText, Users, Video } from 'lucide-react';
import { VoiceOption } from '@/lib/aegis-types';

interface GuestProfile {
  id: string;
  name: string;
  displayName: string;
  bio: string;
  expertise: string[];
  speakingStyle?: string;
  voiceId: VoiceOption;
}

const INTERVIEW_STORAGE_KEY = 'aegis-interview-setup';

export default function Interview() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Load persisted state from localStorage
  const getInitialState = () => {
    try {
      const saved = localStorage.getItem(INTERVIEW_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load interview state:', e);
    }
    return {
      selectedGuestId: null,
      topic: '',
      customGuestName: '',
      customGuestBio: '',
      interviewMode: 'video',
    };
  };

  const initialState = getInitialState();
  
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(initialState.selectedGuestId);
  const [selectedGuest, setSelectedGuest] = useState<GuestProfile | null>(null);
  const [topic, setTopic] = useState(initialState.topic);
  const [customGuestName, setCustomGuestName] = useState(initialState.customGuestName);
  const [customGuestBio, setCustomGuestBio] = useState(initialState.customGuestBio);
  const [showInterview, setShowInterview] = useState(false);
  const [interviewMode, setInterviewMode] = useState<'audio' | 'video'>(initialState.interviewMode);
  const [completedTranscript, setCompletedTranscript] = useState<TranscriptEntry[] | null>(null);

  // Persist state to localStorage
  useEffect(() => {
    const state = {
      selectedGuestId,
      topic,
      customGuestName,
      customGuestBio,
      interviewMode,
    };
    localStorage.setItem(INTERVIEW_STORAGE_KEY, JSON.stringify(state));
  }, [selectedGuestId, topic, customGuestName, customGuestBio, interviewMode]);

  // Fetch selected guest data
  useEffect(() => {
    const fetchGuest = async () => {
      if (!selectedGuestId || !user) {
        setSelectedGuest(null);
        return;
      }
      
      const { data } = await supabase
        .from('guest_profiles')
        .select('*')
        .eq('id', selectedGuestId)
        .single();
      
      if (data) {
        setSelectedGuest({
          id: data.id,
          name: data.name,
          displayName: data.display_name,
          bio: data.bio,
          expertise: data.expertise || [],
          speakingStyle: data.speaking_style || undefined,
          voiceId: (data.voice_id || 'echo') as VoiceOption,
        });
      }
    };
    
    fetchGuest();
  }, [selectedGuestId, user]);

  const handleStartInterview = () => {
    if (!selectedGuest && !customGuestName.trim()) {
      toast({
        title: 'Guest Required',
        description: 'Please select or enter a guest for the interview.',
        variant: 'destructive',
      });
      return;
    }
    setShowInterview(true);
    setCompletedTranscript(null);
  };

  const handleInterviewComplete = (transcript: TranscriptEntry[]) => {
    setCompletedTranscript(transcript);
    setShowInterview(false);
    
    if (transcript.length > 0) {
      toast({
        title: 'Interview Complete',
        description: `Captured ${transcript.length} conversation exchanges.`,
      });
    }
  };

  const handleExportAsScript = () => {
    if (!completedTranscript) return;
    
    // Format transcript as a script
    const guestLabel = selectedGuest?.displayName || customGuestName || 'GUEST';
    const script = completedTranscript
      .map(entry => {
        const label = entry.role === 'assistant' ? '[AEGIS]' : `[${guestLabel.toUpperCase()}]`;
        return `${label}: ${entry.text}`;
      })
      .join('\n\n');
    
    // Copy to clipboard
    navigator.clipboard.writeText(script);
    toast({
      title: 'Script Copied',
      description: 'The interview script has been copied to your clipboard.',
    });
  };

  const guestName = selectedGuest?.displayName || customGuestName;
  const guestBio = selectedGuest?.bio || customGuestBio;

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Mic className="h-8 w-8 text-primary" />
            Live Interview Studio
          </h1>
          <p className="text-muted-foreground mt-2">
            Conduct real-time voice interviews with Aegis as your AI host
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Setup Panel */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Interview Setup
                </CardTitle>
                <CardDescription>
                  Configure your interview session
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Guest Selection */}
                <div className="space-y-2">
                  <Label>Select Guest</Label>
                  <GuestSelector
                    selectedGuestId={selectedGuestId}
                    onGuestSelect={(id) => {
                      setSelectedGuestId(id);
                      if (id) {
                        setCustomGuestName('');
                        setCustomGuestBio('');
                      }
                    }}
                  />
                </div>

                {/* Or custom guest */}
                {!selectedGuestId && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          Or enter guest details
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="guestName">Guest Name</Label>
                      <Input
                        id="guestName"
                        value={customGuestName}
                        onChange={(e) => setCustomGuestName(e.target.value)}
                        placeholder="Enter guest name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="guestBio">Guest Background (optional)</Label>
                      <Textarea
                        id="guestBio"
                        value={customGuestBio}
                        onChange={(e) => setCustomGuestBio(e.target.value)}
                        placeholder="Brief background about the guest..."
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {/* Topic */}
                <div className="space-y-2">
                  <Label htmlFor="topic">Discussion Topic (optional)</Label>
                  <Input
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., Executive travel security"
                  />
                </div>

                {/* Interview Mode Selection */}
                <div className="space-y-2">
                  <Label>Recording Mode</Label>
                  <Tabs value={interviewMode} onValueChange={(v) => setInterviewMode(v as 'audio' | 'video')}>
                    <TabsList className="w-full">
                      <TabsTrigger value="video" className="flex-1 gap-2">
                        <Video className="h-4 w-4" />
                        Video (YouTube)
                      </TabsTrigger>
                      <TabsTrigger value="audio" className="flex-1 gap-2">
                        <Mic className="h-4 w-4" />
                        Audio Only
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <p className="text-xs text-muted-foreground">
                    {interviewMode === 'video' 
                      ? 'Split-screen recording with Aegis avatar + your webcam'
                      : 'Audio-only interview with live transcription'}
                  </p>
                </div>

                {!showInterview && (
                  <Button
                    onClick={handleStartInterview}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {interviewMode === 'video' ? <Video className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    Start {interviewMode === 'video' ? 'Video' : 'Live'} Interview
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Completed Transcript Actions */}
            {completedTranscript && completedTranscript.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Interview Recording
                  </CardTitle>
                  <CardDescription>
                    {completedTranscript.length} exchanges captured
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={handleExportAsScript}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Copy as Script
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Copy the transcript in script format for use in the Generate page
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Interview Panel */}
          <div className="lg:col-span-2 min-h-[600px]">
            {showInterview ? (
              interviewMode === 'video' ? (
                <VideoRealtimeInterview
                  guestName={guestName}
                  guestBio={guestBio}
                  topic={topic}
                  onInterviewComplete={handleInterviewComplete}
                />
              ) : (
                <RealtimeInterview
                  guestName={guestName}
                  guestBio={guestBio}
                  topic={topic}
                  onInterviewComplete={handleInterviewComplete}
                />
              )
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <Mic className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-xl font-semibold mb-2">Ready to Interview</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Configure your guest and topic on the left, then start the live interview.
                    Aegis will host the conversation in real-time.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
