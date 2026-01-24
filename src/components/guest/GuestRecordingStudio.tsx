import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeInterview, TranscriptEntry } from '@/hooks/useRealtimeInterview';
import { useVideoRecording } from '@/hooks/useVideoRecording';
import { SplitScreenPreview } from '@/components/SplitScreenPreview';
import { cn } from '@/lib/utils';
import aegisAvatar from '@/assets/aegis-avatar.png';
import { 
  Play, Pause, Square, RotateCcw, Check, 
  ChevronRight, Video, Mic, AlertCircle,
  Trash2, RefreshCw, Circle, Download
} from 'lucide-react';

interface Segment {
  id: string;
  number: number;
  status: 'recording' | 'completed' | 'discarded' | 'selected';
  transcript: string;
  blob?: Blob;
  startTime?: number;
  endTime?: number;
}

interface GuestRecordingStudioProps {
  sessionId: string;
  guestName: string;
  topic?: string;
  onComplete: () => void;
}

export function GuestRecordingStudio({
  sessionId,
  guestName,
  topic,
  onComplete,
}: GuestRecordingStudioProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [phase, setPhase] = useState<'setup' | 'recording' | 'review'>('setup');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(new Set());
  
  const isAiSpeakingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    status: connectionStatus,
    isAiSpeaking,
    transcript,
    error: connectionError,
    connect,
    disconnect,
    clearTranscript,
  } = useRealtimeInterview({
    guestName,
    topic,
    onError: (err) => console.error('Interview error:', err),
  });

  const {
    isRecording,
    recordedBlob,
    recordingDuration,
    loadAvatarImage,
    setWebcamVideo,
    setAudioStream,
    startRecording,
    stopRecording,
    downloadRecording,
  } = useVideoRecording();

  // Keep ref in sync
  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
  }, [isAiSpeaking]);

  // Load avatar on mount
  useEffect(() => {
    loadAvatarImage(aegisAvatar);
  }, [loadAvatarImage]);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // Save segment when recording stops
  useEffect(() => {
    if (recordedBlob && phase === 'recording') {
      const newSegment: Segment = {
        id: crypto.randomUUID(),
        number: segments.length + 1,
        status: 'completed',
        transcript: transcript.map(t => `${t.role}: ${t.text}`).join('\n'),
        blob: recordedBlob,
        endTime: Date.now(),
      };
      setSegments(prev => [...prev, newSegment]);
      setSelectedSegments(prev => new Set([...prev, newSegment.id]));
    }
  }, [recordedBlob]);

  const handleWebcamVideoReady = useCallback((video: HTMLVideoElement) => {
    setWebcamVideo(video);
  }, [setWebcamVideo]);

  const setupMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: true,
      });
      setWebcamStream(stream);
      setAudioStream(stream);
      setPhase('recording');
    } catch (err) {
      console.error('Media access error:', err);
      toast({
        title: 'Camera/Microphone Required',
        description: 'Please allow access to your camera and microphone to continue.',
        variant: 'destructive',
      });
    }
  };

  const startSegmentRecording = async () => {
    try {
      clearTranscript();
      await connect();
      startRecording(() => isAiSpeakingRef.current);
    } catch (err) {
      console.error('Failed to start recording:', err);
      toast({
        title: 'Recording Error',
        description: 'Failed to start recording. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const stopSegmentRecording = () => {
    stopRecording();
    disconnect();
  };

  const discardLastSegment = () => {
    if (segments.length === 0) return;
    
    const lastSegment = segments[segments.length - 1];
    setSegments(prev => prev.slice(0, -1));
    setSelectedSegments(prev => {
      const newSet = new Set(prev);
      newSet.delete(lastSegment.id);
      return newSet;
    });
    toast({
      title: 'Segment Discarded',
      description: 'The last segment has been removed. You can re-record.',
    });
  };

  const toggleSegmentSelection = (segmentId: string) => {
    setSelectedSegments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(segmentId)) {
        newSet.delete(segmentId);
      } else {
        newSet.add(segmentId);
      }
      return newSet;
    });
  };

  const goToReview = () => {
    if (segments.length === 0) {
      toast({
        title: 'No Recordings',
        description: 'Please record at least one segment before reviewing.',
        variant: 'destructive',
      });
      return;
    }
    setPhase('review');
  };

  const handleFinalize = async () => {
    // Save selected segments to database
    const selectedSegmentsList = segments.filter(s => selectedSegments.has(s.id));
    
    if (selectedSegmentsList.length === 0) {
      toast({
        title: 'No Segments Selected',
        description: 'Please select at least one segment to keep.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Update session status
      await supabase
        .from('interview_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);

      // Stop webcam
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }

      toast({
        title: 'Interview Saved',
        description: 'Your interview has been submitted for processing.',
      });

      onComplete();
    } catch (err) {
      console.error('Error finalizing:', err);
      toast({
        title: 'Error',
        description: 'Failed to save interview. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Setup phase
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="text-4xl mb-2">🎬</div>
            <CardTitle>Ready to Record</CardTitle>
            <CardDescription>
              We'll need access to your camera and microphone
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Video className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Camera</p>
                  <p className="text-xs text-muted-foreground">For your side of the split-screen</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mic className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Microphone</p>
                  <p className="text-xs text-muted-foreground">For your voice during the interview</p>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-600">Tips for best results:</p>
                <ul className="text-muted-foreground mt-1 space-y-1">
                  <li>• Use headphones to prevent echo</li>
                  <li>• Find a quiet, well-lit space</li>
                  <li>• Position yourself centered in frame</li>
                </ul>
              </div>
            </div>

            <Button onClick={setupMedia} className="w-full" size="lg">
              Enable Camera & Microphone
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Recording phase
  if (phase === 'recording') {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-5xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Recording Studio</h1>
              <p className="text-sm text-muted-foreground">
                Interview with {guestName}
                {topic && <span> • {topic}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isRecording && (
                <Badge variant="destructive" className="flex items-center gap-1.5">
                  <Circle className="w-2 h-2 fill-current animate-pulse" />
                  REC {formatDuration(recordingDuration)}
                </Badge>
              )}
              <Badge variant="outline">
                Segment {segments.length + (isRecording ? 1 : 0)}
              </Badge>
            </div>
          </div>

          {/* Video Preview */}
          <SplitScreenPreview
            webcamStream={isVideoEnabled ? webcamStream : null}
            isAiSpeaking={isAiSpeaking}
            guestName={guestName}
            onWebcamVideoReady={handleWebcamVideoReady}
          />

          {/* Transcript */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Live Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-32" ref={scrollRef}>
                {transcript.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {isRecording ? 'Waiting for conversation...' : 'Start recording to begin'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {transcript.map((entry, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex gap-2',
                          entry.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[80%] rounded-lg px-3 py-1.5 text-sm',
                            entry.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary',
                            !entry.isFinal && 'opacity-70'
                          )}
                        >
                          <p className="whitespace-pre-wrap">{entry.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Error */}
          {connectionError && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">
              {connectionError.message}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {!isRecording ? (
                <Button onClick={startSegmentRecording} size="lg" className="gap-2">
                  <Play className="h-4 w-4" />
                  {segments.length === 0 ? 'Start Interview' : 'Record New Segment'}
                </Button>
              ) : (
                <Button onClick={stopSegmentRecording} variant="destructive" size="lg" className="gap-2">
                  <Square className="h-4 w-4" />
                  Stop Recording
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {segments.length > 0 && !isRecording && (
                <>
                  <Button variant="outline" onClick={discardLastSegment} className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Discard Last
                  </Button>
                  <Button onClick={goToReview} className="gap-2">
                    Review & Finish
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Segment list */}
          {segments.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Recorded Segments ({segments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {segments.map((segment, idx) => (
                    <Badge
                      key={segment.id}
                      variant={selectedSegments.has(segment.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleSegmentSelection(segment.id)}
                    >
                      Segment {idx + 1}
                      {selectedSegments.has(segment.id) && <Check className="h-3 w-3 ml-1" />}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Review phase
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Review Your Interview</h1>
          <p className="text-muted-foreground">
            Select the segments you want to keep. Unselected segments will be discarded.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Segments ({segments.length} recorded)</CardTitle>
            <CardDescription>
              {selectedSegments.size} segment(s) selected for the final video
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {segments.map((segment, idx) => (
              <div
                key={segment.id}
                className={cn(
                  'border rounded-lg p-4 cursor-pointer transition-colors',
                  selectedSegments.has(segment.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/50'
                )}
                onClick={() => toggleSegmentSelection(segment.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedSegments.has(segment.id) ? 'default' : 'outline'}>
                      Segment {idx + 1}
                    </Badge>
                    {selectedSegments.has(segment.id) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  {segment.blob && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = URL.createObjectURL(segment.blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `segment-${idx + 1}.webm`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {segment.transcript || 'No transcript available'}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setPhase('recording')}
            className="flex-1 gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Record More
          </Button>
          <Button
            onClick={handleFinalize}
            className="flex-1 gap-2"
            disabled={selectedSegments.size === 0}
          >
            <Check className="h-4 w-4" />
            Finish Interview
          </Button>
        </div>
      </div>
    </div>
  );
}
