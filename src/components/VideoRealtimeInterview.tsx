import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Download, Trash2, Circle, Pause, Play, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useRealtimeInterview, TranscriptEntry, ConnectionStatus } from '@/hooks/useRealtimeInterview';
import { useVideoRecording } from '@/hooks/useVideoRecording';
import { SplitScreenPreview } from '@/components/SplitScreenPreview';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import aegisAvatar from '@/assets/aegis-avatar.png';

interface VideoRealtimeInterviewProps {
  guestName?: string;
  guestBio?: string;
  topic?: string;
  onInterviewComplete?: (transcript: TranscriptEntry[]) => void;
}

export function VideoRealtimeInterview({
  guestName,
  guestBio,
  topic,
  onInterviewComplete,
}: VideoRealtimeInterviewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAiSpeakingRef = useRef(false);
  const recordingStartTime = useRef<number | null>(null);

  const {
    status,
    isAiSpeaking,
    transcript,
    error,
    connect,
    disconnect,
    clearTranscript,
  } = useRealtimeInterview({
    guestName,
    guestBio,
    topic,
    externalAudioStream: webcamStream || undefined, // Pass the webcam's audio stream
    onError: (err) => console.error('Interview error:', err),
  });

  const {
    isRecording,
    isPaused,
    recordedBlob,
    recordingDuration,
    loadAvatarImage,
    setWebcamVideo,
    setAudioStream,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadRecording,
  } = useVideoRecording();

  const canEnd = useMemo(
    () => Boolean(webcamStream) || isRecording || status !== 'disconnected',
    [webcamStream, isRecording, status]
  );

  // Keep ref in sync for recording
  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
  }, [isAiSpeaking]);

  // Load avatar image on mount
  useEffect(() => {
    loadAvatarImage(aegisAvatar);
  }, [loadAvatarImage]);

  // Auto-scroll to bottom when transcript updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const handleWebcamVideoReady = useCallback((video: HTMLVideoElement) => {
    setWebcamVideo(video);
  }, [setWebcamVideo]);

  const handleStartInterview = async () => {
    try {
      console.log('[VideoInterview] Starting interview...');
      
      // Create interview session first if we have a user
      if (user) {
        const { data: session, error: sessionError } = await supabase
          .from('interview_sessions')
          .insert({
            host_user_id: user.id,
            guest_user_id: user.id, // Host is also the guest in this case
            invitation_id: null,
            status: 'recording',
          })
          .select()
          .single();

        if (sessionError) {
          console.error('[VideoInterview] Failed to create session:', sessionError);
        } else {
          setSessionId(session.id);
          console.log('[VideoInterview] Created session:', session.id);
        }
      }
      
      // Get webcam stream - use lower resolution for less lag
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640, max: 640 }, 
          height: { ideal: 360, max: 360 }, 
          facingMode: 'user',
          frameRate: { ideal: 20, max: 24 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log('[VideoInterview] Got media stream with', stream.getAudioTracks().length, 'audio tracks');
      
      setWebcamStream(stream);
      setAudioStream(stream);
      
      // Pass stream directly to connect to avoid stale closure issues
      console.log('[VideoInterview] Calling connect with stream...');
      await connect(stream);
      
      console.log('[VideoInterview] Starting recording...');
      recordingStartTime.current = Date.now();
      startRecording(() => isAiSpeakingRef.current);
      setIsReady(true);
    } catch (err) {
      console.error('[VideoInterview] Failed to start interview:', err);
      toast({
        title: 'Failed to start',
        description: err instanceof Error ? err.message : 'Could not start interview',
        variant: 'destructive',
      });
    }
  };

  const handleEndInterview = async () => {
    // Stop recording first
    stopRecording();
    
    // Disconnect from realtime
    disconnect();
    
    // Stop webcam
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }
    
    onInterviewComplete?.(transcript);
  };

  // Upload to cloud when recordedBlob becomes available
  useEffect(() => {
    const uploadToCloud = async () => {
      if (!recordedBlob || !user || isSaving || isSaved) return;
      
      setIsSaving(true);
      console.log('[VideoInterview] Uploading to cloud...');
      
      try {
        // Create session if we don't have one
        let currentSessionId = sessionId;
        if (!currentSessionId) {
          const { data: session, error } = await supabase
            .from('interview_sessions')
            .insert({
              host_user_id: user.id,
              guest_user_id: user.id,
              invitation_id: null,
              status: 'completed',
            })
            .select()
            .single();
          
          if (error) throw error;
          currentSessionId = session.id;
          setSessionId(currentSessionId);
        }
        
        // Generate unique file path
        const segmentId = crypto.randomUUID();
        const filePath = `${user.id}/${currentSessionId}/${segmentId}.webm`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('recordings')
          .upload(filePath, recordedBlob, {
            contentType: 'video/webm',
            upsert: true,
          });
        
        if (uploadError) throw uploadError;
        console.log('[VideoInterview] Uploaded to:', filePath);
        
        // Save segment record
        const transcriptText = transcript
          .map(t => `${t.role === 'assistant' ? 'AEGIS' : guestName || 'GUEST'}: ${t.text}`)
          .join('\n');
        
        const { error: insertError } = await supabase
          .from('recording_segments')
          .insert({
            session_id: currentSessionId,
            segment_number: 1,
            transcript: transcriptText,
            video_url: filePath,
            status: 'completed',
            start_time: recordingStartTime.current ? recordingStartTime.current / 1000 : null,
            end_time: Date.now() / 1000,
          });
        
        if (insertError) throw insertError;
        
        // Update session status
        await supabase
          .from('interview_sessions')
          .update({ status: 'completed' })
          .eq('id', currentSessionId);
        
        setIsSaved(true);
        toast({
          title: 'Interview Saved',
          description: 'Your recording has been saved to the cloud.',
        });
      } catch (err) {
        console.error('[VideoInterview] Upload failed:', err);
        toast({
          title: 'Save Failed',
          description: err instanceof Error ? err.message : 'Could not save to cloud. You can still download locally.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    };
    
    uploadToCloud();
  }, [recordedBlob, user, sessionId, isSaving, isSaved, transcript, guestName, toast]);

  const toggleVideo = async () => {
    if (!webcamStream) return;

    if (isVideoEnabled) {
      // Stop video track completely (turns off camera light)
      const videoTrack = webcamStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        // Remove from stream
        webcamStream.removeTrack(videoTrack);
      }
      setIsVideoEnabled(false);
    } else {
      // Re-request video and add to existing stream
      try {
        const newVideoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, max: 640 },
            height: { ideal: 360, max: 360 },
            facingMode: 'user',
            frameRate: { ideal: 20, max: 24 }
          }
        });
        const newVideoTrack = newVideoStream.getVideoTracks()[0];
        if (newVideoTrack) {
          webcamStream.addTrack(newVideoTrack);
        }
        setIsVideoEnabled(true);
      } catch (err) {
        console.error('[VideoInterview] Failed to re-enable camera:', err);
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (s: ConnectionStatus) => {
    switch (s) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  const getStatusText = (s: ConnectionStatus) => {
    switch (s) {
      case 'connected': return 'Live';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Error';
      default: return 'Offline';
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Video Interview
              <Badge variant="outline" className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full', getStatusColor(status))} />
                {getStatusText(status)}
              </Badge>
              {isRecording && (
                <Badge variant="destructive" className="flex items-center gap-1.5">
                  <Circle className="w-2 h-2 fill-current animate-pulse" />
                  REC {formatDuration(recordingDuration)}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {guestName ? `Recording interview with ${guestName}` : 'Split-screen video interview'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Video Preview */}
        <SplitScreenPreview
          webcamStream={isVideoEnabled ? webcamStream : null}
          isAiSpeaking={isAiSpeaking}
          guestName={guestName}
          onWebcamVideoReady={handleWebcamVideoReady}
        />

        {/* Transcript area */}
        <ScrollArea className="flex-1 border rounded-lg p-4 bg-muted/30 max-h-48" ref={scrollRef}>
          {transcript.length === 0 ? (
            <div className="text-center text-muted-foreground py-4 text-sm">
              {status === 'disconnected' ? (
                <p>Start the interview to begin recording</p>
              ) : (
                <p>Waiting for conversation...</p>
              )}
            </div>
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
                    <p className="text-xs font-medium mb-0.5 opacity-70">
                      {entry.role === 'user' ? (guestName || 'Guest') : 'Aegis'}
                    </p>
                    <p className="whitespace-pre-wrap">{entry.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Error message */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">
            {error.message}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {!canEnd ? (
              <Button 
                onClick={handleStartInterview} 
                className="gap-2"
                size="lg"
              >
                <Video className="h-4 w-4" />
                Start Recording
              </Button>
            ) : (
              <>
                <Button 
                  onClick={handleEndInterview} 
                  variant="destructive"
                  className="gap-2"
                  size="lg"
                >
                  <PhoneOff className="h-4 w-4" />
                  End & Save
                </Button>

                {isRecording && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    size="lg"
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    title={isPaused ? 'Resume recording' : 'Pause recording'}
                  >
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleVideo}
                  title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Cloud save status */}
            {isSaving && (
              <Badge variant="secondary" className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving to cloud...
              </Badge>
            )}
            {isSaved && (
              <Badge variant="default" className="flex items-center gap-1.5 bg-green-600">
                <Check className="h-3 w-3" />
                Saved to cloud
              </Badge>
            )}
            
            {recordedBlob && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => downloadRecording(`fortified-${guestName || 'interview'}-${new Date().toISOString().slice(0, 10)}.webm`)}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            )}
            {transcript.length > 0 && status === 'disconnected' && (
              <Button
                variant="outline"
                size="icon"
                onClick={clearTranscript}
                title="Clear transcript"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Tips */}
        {status === 'connected' && (
          <p className="text-xs text-muted-foreground text-center">
            Recording in progress. Speak naturally—Aegis will respond in real-time.
          </p>
        )}
        
        {recordedBlob && status === 'disconnected' && !isSaved && !isSaving && (
          <p className="text-xs text-muted-foreground text-center">
            ✓ Video ready. Auto-saving to cloud...
          </p>
        )}
        
        {isSaved && (
          <p className="text-xs text-muted-foreground text-center">
            ✓ Recording saved to your library. You can also download a local copy.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
