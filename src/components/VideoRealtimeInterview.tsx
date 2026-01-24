import { useState, useRef, useEffect, useCallback } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Download, Trash2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useRealtimeInterview, TranscriptEntry, ConnectionStatus } from '@/hooks/useRealtimeInterview';
import { useVideoRecording } from '@/hooks/useVideoRecording';
import { SplitScreenPreview } from '@/components/SplitScreenPreview';
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
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAiSpeakingRef = useRef(false);

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
      // Get webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: true // We need audio for the recording
      });
      setWebcamStream(stream);
      setAudioStream(stream);
      
      // Connect to realtime API
      await connect();
      
      // Start video recording
      startRecording(() => isAiSpeakingRef.current);
    } catch (err) {
      console.error('Failed to start interview:', err);
    }
  };

  const handleEndInterview = () => {
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

  const toggleVideo = () => {
    if (webcamStream) {
      const videoTrack = webcamStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
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
            {status === 'disconnected' ? (
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
            {recordedBlob && (
              <Button
                variant="default"
                className="gap-2"
                onClick={() => downloadRecording(`aegis-${guestName || 'interview'}-${new Date().toISOString().slice(0, 10)}.webm`)}
              >
                <Download className="h-4 w-4" />
                Download Video
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
        
        {recordedBlob && status === 'disconnected' && (
          <p className="text-xs text-muted-foreground text-center">
            ✓ Video ready for download. Upload to YouTube for best results.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
