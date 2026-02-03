import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FortressAgent } from '@/hooks/useFortressAgents';
import { useAuth } from '@/hooks/useAuth';
import { Bot, Mic, Radio, Square, Volume2, Download, Loader2, Edit3, Check, Save, FileText } from 'lucide-react';
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
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [savedEpisodeId, setSavedEpisodeId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Script editing state (like Generate page)
  const [editableScript, setEditableScript] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const editableScriptRef = useRef('');
  
  // Keep ref in sync
  useEffect(() => {
    editableScriptRef.current = editableScript;
  }, [editableScript]);

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
          // After Aegis speaks, give the guest time to "think" - natural conversation pause
          if (finalText.trim()) {
            // 1.5-3 second pause for natural pacing (like Shawn Ryan Show)
            const thinkingDelay = 1500 + Math.random() * 1500;
            setTimeout(() => sendToAgent(finalText), thinkingDelay);
          }
        } else {
          agentTextRef.current = '';
          setAgentText('');
          // After agent speaks, Aegis takes a moment to process - thoughtful host pause
          if (finalText.trim()) {
            // 2-4 second pause for Aegis to "consider" the response
            const thinkingDelay = 2000 + Math.random() * 2000;
            setTimeout(() => sendToAegis(finalText), thinkingDelay);
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
    
    // Convert transcript to script format
    if (transcript.length > 0) {
      const script = transcript
        .map(entry => {
          const label = entry.role === 'aegis' ? '[AEGIS]' : `[${agent.codename.toUpperCase()}]`;
          return `${label}: ${entry.text}`;
        })
        .join('\n\n');
      setEditableScript(script);
      
      toast({
        title: 'Interview Complete',
        description: 'Review and edit the script, then save as an episode.',
      });
    }
    
    onComplete(transcript);
  }, [transcript, onComplete, agent, toast]);

  // Format transcript to script
  const getScriptFromTranscript = useCallback(() => {
    return transcript
      .map(entry => {
        const label = entry.role === 'aegis' ? '[AEGIS]' : `[${agent.codename.toUpperCase()}]`;
        return `${label}: ${entry.text}`;
      })
      .join('\n\n');
  }, [transcript, agent.codename]);

  // Save as episode (like Generate page)
  const handleSaveEpisode = async () => {
    const scriptToSave = editableScriptRef.current || getScriptFromTranscript();
    if (!scriptToSave || !user) return;

    try {
      // Extract metadata
      let metadata = {
        key_stories: [] as string[],
        people_mentioned: [agent.name, agent.codename] as string[],
        themes: agent.expertise || [],
        episode_summary: `AI-to-AI interview with ${agent.codename} (${agent.name}) discussing ${agent.expertise[0] || 'specialized intelligence'}.`,
      };

      try {
        const metadataResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-episode-metadata`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              script: scriptToSave,
              topic: `Fortress Interview: ${agent.codename}`,
            }),
          }
        );

        if (metadataResponse.ok) {
          metadata = await metadataResponse.json();
        }
      } catch (metaError) {
        console.warn('Could not extract metadata:', metaError);
      }

      const episodeTitle = `Fortress Interview: ${agent.codename} - ${agent.name}`;
      
      const episodeData = {
        user_id: user.id,
        title: episodeTitle,
        topic: `AI-to-AI interview with ${agent.codename} on ${agent.expertise[0] || 'specialized intelligence'}`,
        target_audience: 'executives',
        risk_domains: agent.expertise.slice(0, 3),
        content_length: Math.ceil(elapsedTime / 60),
        tone_intensity: 'strategic',
        output_mode: 'podcast_script',
        script_content: scriptToSave,
        status: 'completed',
        key_stories: metadata.key_stories,
        people_mentioned: metadata.people_mentioned,
        themes: metadata.themes,
        episode_summary: metadata.episode_summary,
        updated_at: new Date().toISOString(),
      };

      if (savedEpisodeId) {
        // Update existing episode
        const { error } = await supabase
          .from('episodes')
          .update(episodeData)
          .eq('id', savedEpisodeId)
          .eq('user_id', user.id);

        if (error) throw error;

        toast({
          title: 'Episode Updated',
          description: `Saved at ${new Date().toLocaleTimeString()}`,
        });
      } else {
        // Create new episode
        const { data, error } = await supabase
          .from('episodes')
          .insert(episodeData)
          .select('id')
          .single();

        if (error) throw error;

        if (data?.id) {
          setSavedEpisodeId(data.id);
        }

        toast({
          title: 'Episode Saved',
          description: 'Added to your intelligence library.',
        });
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Save Failed',
        description: 'Could not save the episode.',
        variant: 'destructive',
      });
    }
  };

  // Toggle editing mode
  const handleToggleEdit = async () => {
    if (isEditing) {
      // Save edits
      setIsEditing(false);
      toast({
        title: 'Script Updated',
        description: 'Changes saved. Generate audio when ready.',
      });
    } else {
      setIsEditing(true);
    }
  };

  const generateAudio = async () => {
    const scriptToUse = editableScriptRef.current || getScriptFromTranscript();
    if (!scriptToUse) return;
    
    setIsGeneratingAudio(true);
    try {
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
            text: scriptToUse,
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

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioBlob(blob);
      setAudioUrl(url);
      
      // Upload to storage if we have a saved episode
      if (savedEpisodeId && user) {
        const fileName = `episode-${savedEpisodeId}.mp3`;
        const storagePath = `${user.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('recordings')
          .upload(storagePath, blob, { 
            contentType: 'audio/mpeg',
            upsert: true 
          });
        
        if (!uploadError) {
          // Update episode record with audio URL
          await supabase
            .from('episodes')
            .update({ audio_url: storagePath })
            .eq('id', savedEpisodeId);
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
    if (!audioBlob) return;

    const filename = `fortified-${agent.codename.toLowerCase()}-interview-${new Date().toISOString().split('T')[0]}.mp3`;
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Audio Downloaded',
      description: `Saved as ${filename} — Ready for Buzzsprout upload.`,
    });
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

        {/* Transcript OR Script Editor */}
        <div className="flex-1 min-h-0">
          {status === 'idle' && editableScript ? (
            // Script Editor (post-interview)
            <div className="h-full flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Episode Script
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleEdit}
                    className="gap-1"
                  >
                    {isEditing ? (
                      <>
                        <Check className="h-3 w-3" />
                        Done Editing
                      </>
                    ) : (
                      <>
                        <Edit3 className="h-3 w-3" />
                        Edit Script
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {isEditing ? (
                <Textarea
                  value={editableScript}
                  onChange={(e) => setEditableScript(e.target.value)}
                  className="flex-1 min-h-[300px] font-mono text-sm resize-none"
                  placeholder="Edit the script..."
                />
              ) : (
                <ScrollArea className="flex-1 border rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {editableScript}
                  </pre>
                </ScrollArea>
              )}
            </div>
          ) : (
            // Live Transcript (during interview)
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
                {transcript.length === 0 && status === 'idle' && !editableScript && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Start the interview to hear Aegis and {agent.codename} discuss {agent.expertise[0]}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-3 flex-wrap">
          {status === 'idle' && !editableScript && transcript.length === 0 && (
            <Button onClick={startInterview} className="flex-1 gap-2">
              <Mic className="h-4 w-4" />
              Start Interview
            </Button>
          )}
          {status === 'idle' && editableScript && (
            <div className="flex flex-col gap-2 w-full">
              {/* Top row: Save + Generate Audio */}
              <div className="flex gap-2">
                <Button onClick={handleSaveEpisode} variant="outline" className="flex-1 gap-2">
                  <Save className="h-4 w-4" />
                  {savedEpisodeId ? 'Update Episode' : 'Save as Episode'}
                </Button>
                <Button 
                  onClick={generateAudio} 
                  disabled={isGeneratingAudio}
                  className="flex-1 gap-2"
                >
                  {isGeneratingAudio ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4" />
                      Generate Audio
                    </>
                  )}
                </Button>
              </div>
              
              {/* Audio player and download */}
              {audioUrl && (
                <div className="flex flex-col gap-3 p-4 border rounded-lg bg-muted/30">
                  <audio 
                    ref={audioRef} 
                    controls 
                    src={audioUrl} 
                    className="w-full" 
                    onLoadedMetadata={() => {
                      if (audioRef.current) {
                        audioRef.current.playbackRate = playbackRate;
                      }
                    }}
                  />
                  
                  {/* Playback Speed Control */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Speed:</span>
                    <Slider
                      value={[playbackRate]}
                      min={0.5}
                      max={2}
                      step={0.1}
                      onValueChange={(values) => {
                        const rate = values[0];
                        setPlaybackRate(rate);
                        if (audioRef.current) {
                          audioRef.current.playbackRate = rate;
                        }
                      }}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-12 text-right">{playbackRate.toFixed(1)}x</span>
                  </div>
                  
                  <Button onClick={downloadAudio} className="w-full gap-2">
                    <Download className="h-4 w-4" />
                    Download MP3
                  </Button>
                </div>
              )}
              
              {/* New Interview button */}
              <Button 
                onClick={() => {
                  setTranscript([]);
                  setEditableScript('');
                  setAudioUrl(null);
                  setAudioBlob(null);
                  setSavedEpisodeId(null);
                  setElapsedTime(0);
                  startInterview();
                }} 
                variant="ghost" 
                className="w-full gap-2"
              >
                <Mic className="h-4 w-4" />
                Start New Interview
              </Button>
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
