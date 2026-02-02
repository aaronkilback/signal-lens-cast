import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FortressAgent } from '@/hooks/useFortressAgents';
import { Bot, Mic, MicOff, Radio, Square, Volume2 } from 'lucide-react';
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
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<'aegis' | 'agent' | null>(null);
  const [aegisText, setAegisText] = useState('');
  const [agentText, setAgentText] = useState('');
  
  const aegisWsRef = useRef<WebSocket | null>(null);
  const agentWsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

      // Initialize audio context
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });

      // Connect both WebSocket sessions
      await Promise.all([
        connectSession(aegisResult.data.client_secret.value, 'aegis'),
        connectSession(agentResult.data.client_secret.value, 'agent')
      ]);

      setStatus('live');

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
        resolve();
      };

      ws.onerror = (event) => {
        console.error(`${persona} WebSocket error:`, event);
        reject(new Error(`${persona} connection failed`));
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleMessage(message, persona);
      };

      ws.onclose = () => {
        console.log(`${persona} session closed`);
      };
    });
  };

  const handleMessage = (message: any, persona: 'aegis' | 'agent') => {
    switch (message.type) {
      case 'response.audio_transcript.delta':
        if (persona === 'aegis') {
          setAegisText(prev => prev + message.delta);
          setCurrentSpeaker('aegis');
        } else {
          setAgentText(prev => prev + message.delta);
          setCurrentSpeaker('agent');
        }
        break;

      case 'response.audio_transcript.done':
        const text = persona === 'aegis' ? aegisText + (message.transcript || '') : agentText + (message.transcript || '');
        if (text.trim()) {
          setTranscript(prev => [...prev, {
            role: persona,
            text: text.trim(),
            timestamp: new Date()
          }]);
        }
        if (persona === 'aegis') {
          setAegisText('');
          // After Aegis speaks, trigger agent response
          setTimeout(() => sendToAgent(text), 500);
        } else {
          setAgentText('');
          // After agent speaks, trigger Aegis follow-up
          setTimeout(() => sendToAegis(text), 500);
        }
        setCurrentSpeaker(null);
        break;

      case 'response.audio.delta':
        // Play audio
        if (audioContextRef.current && message.delta) {
          playAudio(message.delta);
        }
        break;
    }
  };

  const playAudio = async (base64Audio: string) => {
    if (!audioContextRef.current) return;
    
    try {
      const audioData = atob(base64Audio);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }
      
      // Decode and play (simplified - actual implementation would need proper PCM handling)
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
    } catch (e) {
      // Silently handle audio decode errors
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
    if (!agentWsRef.current || status !== 'live') return;

    agentWsRef.current.send(JSON.stringify({
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

    agentWsRef.current.send(JSON.stringify({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio']
      }
    }));
  };

  const sendToAegis = (agentMessage: string) => {
    if (!aegisWsRef.current || status !== 'live') return;

    aegisWsRef.current.send(JSON.stringify({
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

    aegisWsRef.current.send(JSON.stringify({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio']
      }
    }));
  };

  const stopInterview = useCallback(() => {
    aegisWsRef.current?.close();
    agentWsRef.current?.close();
    audioContextRef.current?.close();
    setStatus('idle');
    onComplete(transcript);
  }, [transcript, onComplete]);

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
            <Badge variant="destructive" className="animate-pulse gap-1">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              LIVE
            </Badge>
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
        <div className="flex gap-3">
          {status === 'idle' && (
            <Button onClick={startInterview} className="flex-1 gap-2">
              <Mic className="h-4 w-4" />
              Start Interview
            </Button>
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
