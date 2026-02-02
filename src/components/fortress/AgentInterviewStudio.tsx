import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FortressAgent } from '@/hooks/useFortressAgents';
import { useAuth } from '@/hooks/useAuth';
import { Bot, Mic, Radio, Square, Volume2, Download, Loader2 } from 'lucide-react';
import aegisAvatar from '@/assets/aegis-avatar.png';

interface TranscriptEntry {
  role: 'aegis' | 'agent';
  text: string;
  timestamp: Date;
}

interface AgentInterviewStudioProps {
  agent: FortressAgent;
  onComplete: (transcript: TranscriptEntry[]) => void;
}

export function AgentInterviewStudio({ agent, onComplete }: AgentInterviewStudioProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<'aegis' | 'agent' | null>(null);
  const [aegisText, setAegisText] = useState('');
  const [agentText, setAgentText] = useState('');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [savedInterviewId, setSavedInterviewId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // IMPORTANT: WebSocket handlers capture values at connection time.
  // Use refs for anything that needs the latest value (e.g. status gating).
  const statusRef = useRef<typeof status>('idle');
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  
  const aegisWsRef = useRef<WebSocket | null>(null);
  const agentWsRef = useRef<WebSocket | null>(null);
  const aegisInstructionsRef = useRef<string>('');
  const agentInstructionsRef = useRef<string>('');
  const aegisVoiceRef = useRef<string>('ash');
  const agentVoiceRef = useRef<string>('echo');
  const audioContextRef = useRef<AudioContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const interviewTimerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  
  // Use refs for accumulated text to avoid stale closure issues
  const aegisTextRef = useRef<string>('');
  const agentTextRef = useRef<string>('');

  // Max interview duration: 10 minutes
  const MAX_DURATION_MS = 10 * 60 * 1000;

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, aegisText, agentText]);

  const startInterview = async () => {
    try {
      setStatus('connecting');

      // Create sessions for both Aegis and the agent
      const [aegisResult, agentResult] = await Promise.all([
        supabase.functions.invoke('agent-interview-session', {
          body: { agent, mode: 'aegis' }
        }),
        supabase.functions.invoke('agent-interview-session', {
          body: { agent, mode: 'agent' }
        })
      ]);

      if (aegisResult.error || agentResult.error) {
        throw new Error(aegisResult.error?.message || agentResult.error?.message);
      }

      // Store instructions for session.update after WebSocket connects
      aegisInstructionsRef.current = aegisResult.data.instructions;
      agentInstructionsRef.current = agentResult.data.instructions;
      aegisVoiceRef.current = aegisResult.data.voice || 'ash';
      agentVoiceRef.current = agentResult.data.voice || 'echo';

      // Initialize audio context
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });

      // Connect both WebSocket sessions
      await Promise.all([
        connectSession(aegisResult.data.client_secret.value, 'aegis'),
        connectSession(agentResult.data.client_secret.value, 'agent')
      ]);

      setStatus('live');
      setElapsedTime(0);

      // Start elapsed time counter
      const startTime = Date.now();
      elapsedTimerRef.current = window.setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Auto-end after 10 minutes
      interviewTimerRef.current = window.setTimeout(() => {
        console.log('Interview reached 10-minute limit, auto-ending');
        stopInterview();
      }, MAX_DURATION_MS);

      // Aegis speaks first - trigger initial response
      setTimeout(() => {
        triggerAegisOpening();
      }, 1000);

    } catch (error) {
      console.error('Failed to start interview:', error);
      setStatus('error');
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to start interview',
        variant: 'destructive',
      });
    }
  };

  const connectSession = (clientSecret: string, persona: 'aegis' | 'agent'): Promise<void> => {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const safeResolve = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };

      const timeoutId = window.setTimeout(() => {
        if (!resolved) {
          console.warn(`${persona} session.update not confirmed within timeout; continuing anyway`);
          safeResolve();
        }
      }, 5000);

      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
        ['realtime', `openai-insecure-api-key.${clientSecret}`, 'openai-beta.realtime-v1']
      );

      if (persona === 'aegis') {
        aegisWsRef.current = ws;
      } else {
        agentWsRef.current = ws;
      }

      ws.onopen = () => {
        console.log(`${persona} session connected`);
        
        // Send session.update with instructions immediately after connection
        const instructions = persona === 'aegis' ? aegisInstructionsRef.current : agentInstructionsRef.current;
        const voice = persona === 'aegis' ? aegisVoiceRef.current : agentVoiceRef.current;
        
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions,
            voice,
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 700,
            },
          }
        }));
        
        console.log(`${persona} session configured with instructions`);
      };

      ws.onerror = (event) => {
        console.error(`${persona} WebSocket error:`, event);
        window.clearTimeout(timeoutId);
        reject(new Error(`${persona} connection failed`));
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        // Confirm session.update applied before we proceed (helps ensure persona consistency)
        if (message?.type === 'session.updated') {
          console.log(`${persona} session.update confirmed`);
          window.clearTimeout(timeoutId);
          safeResolve();
        }

        handleMessage(message, persona);
      };

      ws.onclose = () => {
        console.log(`${persona} session closed`);
        window.clearTimeout(timeoutId);
      };
    });
  };

  const handleMessage = (message: any, persona: 'aegis' | 'agent') => {
    switch (message.type) {
      case 'session.updated':
        console.log(`${persona} session updated successfully`);
        break;
        
      case 'response.audio_transcript.delta':
        if (persona === 'aegis') {
          aegisTextRef.current += message.delta;
          setAegisText(aegisTextRef.current);
          setCurrentSpeaker('aegis');
        } else {
          agentTextRef.current += message.delta;
          setAgentText(agentTextRef.current);
          setCurrentSpeaker('agent');
        }
        break;

      case 'response.audio_transcript.done':
        const finalText = message.transcript || (persona === 'aegis' ? aegisTextRef.current : agentTextRef.current);
        console.log(`${persona} finished speaking:`, finalText.substring(0, 50) + '...');
        
        if (finalText.trim()) {
          setTranscript(prev => [...prev, {
            role: persona,
            text: finalText.trim(),
            timestamp: new Date()
          }]);
        }
        
        // Check if Aegis said the closing phrase - end interview naturally
        if (persona === 'aegis' && finalText.toLowerCase().includes('fortune favors the fortified')) {
          console.log('Aegis delivered closing - ending interview naturally');
          setTimeout(() => stopInterview(), 1500);
          setCurrentSpeaker(null);
          return;
        }
        
        if (persona === 'aegis') {
          aegisTextRef.current = '';
          setAegisText('');
          // After Aegis speaks, trigger agent response
          if (finalText.trim()) {
            setTimeout(() => sendToAgent(finalText), 500);
          }
        } else {
          agentTextRef.current = '';
          setAgentText('');
          // After agent speaks, trigger Aegis follow-up
          if (finalText.trim()) {
            setTimeout(() => sendToAegis(finalText), 500);
          }
        }
        setCurrentSpeaker(null);
        break;

      case 'response.audio.delta':
        // Play audio (PCM16 format from OpenAI Realtime)
        if (audioContextRef.current && message.delta) {
          playPCMAudio(message.delta);
        }
        break;
        
      case 'error':
        console.error(`${persona} error:`, message.error);
        break;
    }
  };

  const playPCMAudio = async (base64Audio: string) => {
    if (!audioContextRef.current) return;
    
    try {
      // Decode base64 to binary
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Convert PCM16 LE to Float32 for Web Audio API
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }
      
      // Create audio buffer and play
      const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
    } catch (e) {
      console.error('Audio playback error:', e);
    }
  };

  const triggerAegisOpening = () => {
    if (!aegisWsRef.current) return;
    
    aegisWsRef.current.send(JSON.stringify({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
        instructions: 'Begin the interview with your opening introduction. Welcome the audience and introduce the guest agent.'
      }
    }));
  };

  const sendToAgent = (aegisMessage: string) => {
    const ws = agentWsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (statusRef.current !== 'live') return;

    ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: aegisMessage
        }]
      }
    }));

    ws.send(JSON.stringify({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio']
      }
    }));
  };

  const sendToAegis = (agentMessage: string) => {
    const ws = aegisWsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (statusRef.current !== 'live') return;

    ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: agentMessage
        }]
      }
    }));

    ws.send(JSON.stringify({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio']
      }
    }));
  };

  const stopInterview = useCallback(async () => {
    // Clear timers
    if (interviewTimerRef.current) {
      clearTimeout(interviewTimerRef.current);
      interviewTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    
    aegisWsRef.current?.close();
    agentWsRef.current?.close();
    audioContextRef.current?.close();
    setStatus('idle');
    
    // Save interview to database
    if (user && transcript.length > 0) {
      try {
        const { data, error } = await supabase
          .from('agent_interviews')
          .insert({
            user_id: user.id,
            agent_id: agent.id,
            agent_codename: agent.codename,
            agent_name: agent.name,
            transcript: transcript.map(t => ({ role: t.role, text: t.text })),
          })
          .select('id')
          .single();
        
        if (error) throw error;
        setSavedInterviewId(data.id);
        
        toast({
          title: 'Interview Saved',
          description: 'Transcript saved. You can now generate the audio.',
        });
      } catch (err) {
        console.error('Failed to save interview:', err);
      }
    }
    
    onComplete(transcript);
  }, [transcript, onComplete, user, agent, toast]);

  const generateAudio = async () => {
    if (transcript.length === 0) return;
    
    setIsGeneratingAudio(true);
    try {
      // Format transcript as dialogue script
      const scriptText = transcript
        .map(entry => {
          const label = entry.role === 'aegis' ? '[AEGIS]' : `[${agent.codename.toUpperCase()}]`;
          return `${label}: ${entry.text}`;
        })
        .join('\n\n');
      
      // Generate audio via edge function (same as episode generator)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-audio`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: scriptText,
            voice: 'onyx', // Aegis voice
            guestVoice: 'echo', // Default agent voice
            guestName: agent.codename,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Audio generation failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
      // Upload to storage if we have a saved interview
      if (savedInterviewId && user) {
        const fileName = `agent-interview-${savedInterviewId}.mp3`;
        const storagePath = `${user.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('recordings')
          .upload(storagePath, audioBlob, { 
            contentType: 'audio/mpeg',
            upsert: true 
          });
        
        if (!uploadError) {
          // Update interview record with audio URL
          await supabase
            .from('agent_interviews')
            .update({ audio_url: storagePath })
            .eq('id', savedInterviewId);
        }
      }
      
      toast({
        title: 'Audio Generated',
        description: 'Your interview audio is ready for download.',
      });
    } catch (err) {
      console.error('Audio generation error:', err);
      toast({
        title: 'Audio Generation Failed',
        description: err instanceof Error ? err.message : 'Failed to generate audio',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `fortified-${agent.codename.toLowerCase()}-interview.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              AI-to-AI Interview
            </CardTitle>
            <CardDescription>
              Aegis interviewing {agent.codename}
            </CardDescription>
          </div>
          {status === 'live' && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-muted-foreground">
                {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')} / 10:00
              </span>
              <Badge variant="destructive" className="animate-pulse gap-1">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                LIVE
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Participants */}
        <div className="grid grid-cols-2 gap-4">
          {/* Aegis */}
          <div className={`p-4 rounded-lg border transition-all ${currentSpeaker === 'aegis' ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={aegisAvatar} alt="Aegis" className="h-12 w-12 rounded-full object-cover" />
                {currentSpeaker === 'aegis' && (
                  <Volume2 className="absolute -bottom-1 -right-1 h-4 w-4 text-primary animate-pulse" />
                )}
              </div>
              <div>
                <h4 className="font-semibold">Aegis</h4>
                <p className="text-xs text-muted-foreground">Host</p>
              </div>
            </div>
            {aegisText && (
              <p className="mt-3 text-sm text-muted-foreground italic">"{aegisText}"</p>
            )}
          </div>

          {/* Agent */}
          <div className={`p-4 rounded-lg border transition-all ${currentSpeaker === 'agent' ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                {currentSpeaker === 'agent' && (
                  <Volume2 className="absolute -bottom-1 -right-1 h-4 w-4 text-primary animate-pulse" />
                )}
              </div>
              <div>
                <h4 className="font-semibold">{agent.codename}</h4>
                <p className="text-xs text-muted-foreground">{agent.name}</p>
              </div>
            </div>
            {agentText && (
              <p className="mt-3 text-sm text-muted-foreground italic">"{agentText}"</p>
            )}
          </div>
        </div>

        {/* Transcript */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full" ref={scrollRef}>
            <div className="space-y-3 pr-4">
              {transcript.map((entry, idx) => (
                <div key={idx} className={`flex gap-3 ${entry.role === 'aegis' ? '' : 'flex-row-reverse'}`}>
                  <div className={`flex-1 p-3 rounded-lg ${entry.role === 'aegis' ? 'bg-muted' : 'bg-primary/10'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {entry.role === 'aegis' ? 'Aegis' : agent.codename}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm">{entry.text}</p>
                  </div>
                </div>
              ))}
              {transcript.length === 0 && status === 'idle' && (
                <div className="text-center py-12 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Start the interview to hear Aegis and {agent.codename} discuss {agent.expertise[0]}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Controls */}
        <div className="flex gap-3 flex-wrap">
          {status === 'idle' && transcript.length === 0 && (
            <Button onClick={startInterview} className="flex-1 gap-2">
              <Mic className="h-4 w-4" />
              Start Interview
            </Button>
          )}
          {status === 'idle' && transcript.length > 0 && (
            <div className="flex flex-col gap-2 w-full">
              <div className="flex gap-2">
                <Button onClick={startInterview} variant="outline" className="flex-1 gap-2">
                  <Mic className="h-4 w-4" />
                  New Interview
                </Button>
                <Button 
                  onClick={generateAudio} 
                  disabled={isGeneratingAudio || !!audioUrl}
                  className="flex-1 gap-2"
                  variant={audioUrl ? "outline" : "default"}
                >
                  {isGeneratingAudio ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : audioUrl ? (
                    <>
                      <Volume2 className="h-4 w-4 text-green-500" />
                      Audio Ready
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4" />
                      Generate Audio
                    </>
                  )}
                </Button>
              </div>
              {audioUrl && (
                <Button onClick={downloadAudio} className="w-full gap-2">
                  <Download className="h-4 w-4" />
                  Download MP3
                </Button>
              )}
            </div>
          )}
          {status === 'connecting' && (
            <Button disabled className="flex-1 gap-2">
              <Radio className="h-4 w-4 animate-pulse" />
              Connecting...
            </Button>
          )}
          {status === 'live' && (
            <Button onClick={stopInterview} variant="destructive" className="flex-1 gap-2">
              <Square className="h-4 w-4" />
              End Interview
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
