import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useRealtimeInterview, TranscriptEntry, ConnectionStatus } from '@/hooks/useRealtimeInterview';
import { cn } from '@/lib/utils';

interface RealtimeInterviewProps {
  guestName?: string;
  guestBio?: string;
  topic?: string;
  onInterviewComplete?: (transcript: TranscriptEntry[]) => void;
}

export function RealtimeInterview({
  guestName,
  guestBio,
  topic,
  onInterviewComplete,
}: RealtimeInterviewProps) {
  const [isMuted, setIsMuted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to bottom when transcript updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const handleStartInterview = async () => {
    await connect();
  };

  const handleEndInterview = () => {
    disconnect();
    onInterviewComplete?.(transcript);
  };

  const handleDownloadTranscript = () => {
    const text = transcript
      .map(entry => `[${entry.role.toUpperCase()}]: ${entry.text}`)
      .join('\n\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
              Real-Time Interview
              <Badge variant="outline" className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full', getStatusColor(status))} />
                {getStatusText(status)}
              </Badge>
            </CardTitle>
            <CardDescription>
              {guestName ? `Interview with ${guestName}` : 'Voice conversation with Aegis'}
            </CardDescription>
          </div>
          {isAiSpeaking && (
            <div className="flex items-center gap-2 text-primary">
              <Volume2 className="h-4 w-4 animate-pulse" />
              <span className="text-sm">Aegis speaking...</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Transcript area */}
        <ScrollArea className="flex-1 border rounded-lg p-4 bg-muted/30" ref={scrollRef}>
          {transcript.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {status === 'disconnected' ? (
                <>
                  <Mic className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Start the interview to begin the conversation</p>
                  <p className="text-sm mt-2">
                    {guestName 
                      ? `Aegis will welcome ${guestName} and begin the interview`
                      : 'Aegis will guide the conversation'}
                  </p>
                </>
              ) : (
                <p>Waiting for conversation to begin...</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {transcript.map((entry, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex gap-3',
                    entry.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg px-4 py-2',
                      entry.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary',
                      !entry.isFinal && 'opacity-70'
                    )}
                  >
                    <p className="text-xs font-medium mb-1 opacity-70">
                      {entry.role === 'user' ? (guestName || 'You') : 'Aegis'}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{entry.text}</p>
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
                <Phone className="h-4 w-4" />
                Start Interview
              </Button>
            ) : (
              <Button 
                onClick={handleEndInterview} 
                variant="destructive"
                className="gap-2"
                size="lg"
              >
                <PhoneOff className="h-4 w-4" />
                End Interview
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {transcript.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleDownloadTranscript}
                  title="Download transcript"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={clearTranscript}
                  title="Clear transcript"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Tips */}
        {status === 'connected' && (
          <p className="text-xs text-muted-foreground text-center">
            Speak naturally. Aegis will respond in real-time. The conversation is being transcribed.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
