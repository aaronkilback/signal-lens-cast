import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

interface UseRealtimeInterviewOptions {
  guestName?: string;
  guestBio?: string;
  topic?: string;
  externalAudioStream?: MediaStream;
  onTranscript?: (entry: TranscriptEntry) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function useRealtimeInterview(options: UseRealtimeInterviewOptions = {}) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<Error | null>(null);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const optionsRef = useRef(options);
  const isConnectingRef = useRef(false);
  const hasRequestedInitialResponseRef = useRef(false);
  
  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    console.log('[Realtime] Status changing to:', newStatus);
    setStatus(newStatus);
    optionsRef.current.onStatusChange?.(newStatus);
  }, []);

  const addTranscriptEntry = useCallback((entry: TranscriptEntry) => {
    setTranscript(prev => {
      const lastEntry = prev[prev.length - 1];
      if (lastEntry && lastEntry.role === entry.role && !lastEntry.isFinal) {
        return [...prev.slice(0, -1), { ...entry, text: entry.text }];
      }
      return [...prev, entry];
    });
    options.onTranscript?.(entry);
  }, [options]);

  const requestInitialResponse = useCallback((reason: string) => {
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== 'open') return;
    if (hasRequestedInitialResponseRef.current) return;

    hasRequestedInitialResponseRef.current = true;
    const currentOptions = optionsRef.current;
    const guestName = currentOptions.guestName;
    const guestBio = currentOptions.guestBio;
    
    // Build explicit instructions with guest details
    let promptInstructions = "Begin the interview now. You are the host of the Fortified podcast and you must speak first.";
    
    if (guestName) {
      promptInstructions += ` Your guest today is ${guestName}.`;
      if (guestBio) {
        promptInstructions += ` Here is their background: ${guestBio}`;
      }
      promptInstructions += ` Start with a warm introduction to the Fortified podcast, then introduce ${guestName} by name with a brief summary of who they are based on their background, then welcome them to the show and ask the first question.`;
    } else {
      promptInstructions += " Welcome the listener to the Fortified podcast and have a general conversation.";
    }

    console.log(`[Realtime] Requesting initial Aegis response (${reason}) for guest: ${guestName || 'none'}`);
    dc.send(
      JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['audio', 'text'],
          instructions: promptInstructions,
        },
      })
    );
  }, []);

  // Disconnect must be declared before connect
  const disconnect = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (mediaStreamRef.current && !optionsRef.current.externalAudioStream) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    mediaStreamRef.current = null;

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.srcObject = null;
      audioElementRef.current.remove();
      audioElementRef.current = null;
    }

    hasRequestedInitialResponseRef.current = false;
    isConnectingRef.current = false;

    updateStatus('disconnected');
    setIsAiSpeaking(false);
  }, [updateStatus]);

  // handleRealtimeEvent must be declared before connect
  const handleRealtimeEvent = useCallback((event: any) => {
    console.log('[Realtime] Event:', event.type);

    switch (event.type) {
      case 'session.created':
        console.log('[Realtime] Session created:', event.session?.id);
        requestInitialResponse('session.created');
        break;

      case 'input_audio_buffer.speech_started':
        break;

      case 'input_audio_buffer.speech_stopped':
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          addTranscriptEntry({
            role: 'user',
            text: event.transcript,
            timestamp: new Date(),
            isFinal: true,
          });
        }
        break;

      case 'response.audio_transcript.delta':
        if (event.delta) {
          setIsAiSpeaking(true);
          addTranscriptEntry({
            role: 'assistant',
            text: event.delta,
            timestamp: new Date(),
            isFinal: false,
          });
        }
        break;

      case 'response.audio_transcript.done':
        if (event.transcript) {
          addTranscriptEntry({
            role: 'assistant',
            text: event.transcript,
            timestamp: new Date(),
            isFinal: true,
          });
        }
        setIsAiSpeaking(false);
        break;

      case 'response.done':
        setIsAiSpeaking(false);
        break;

      case 'error':
        console.error('[Realtime] API error:', event.error);
        setError(new Error(event.error?.message || 'Realtime API error'));
        break;
    }
  }, [addTranscriptEntry, requestInitialResponse]);

  const connect = useCallback(async (audioStreamOverride?: MediaStream) => {
    if (isConnectingRef.current) {
      console.log('[Realtime] Connection already in progress');
      return;
    }
    
    isConnectingRef.current = true;
    hasRequestedInitialResponseRef.current = false;
    
    console.log('[Realtime] Starting connection...');
    
    try {
      updateStatus('connecting');
      setError(null);

      let stream: MediaStream;
      const currentOptions = optionsRef.current;
      
      // Priority: override > external stream from options > request new mic
      if (audioStreamOverride) {
        stream = audioStreamOverride;
        console.log('[Realtime] Using override audio stream with tracks:', stream.getAudioTracks().length);
      } else if (currentOptions.externalAudioStream) {
        stream = currentOptions.externalAudioStream;
        console.log('[Realtime] Using external audio stream with tracks:', stream.getAudioTracks().length);
      } else {
        console.log('[Realtime] Requesting microphone access...');
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[Realtime] Created new audio stream');
      }
      mediaStreamRef.current = stream;

      console.log('[Realtime] Fetching session token...');
      const { data, error: fnError } = await supabase.functions.invoke('realtime-session', {
        body: {
          guestName: currentOptions.guestName,
          guestBio: currentOptions.guestBio,
          topic: currentOptions.topic,
        },
      });

      if (fnError) {
        console.error('[Realtime] Edge function error:', fnError);
        throw new Error(fnError.message || 'Failed to get session token');
      }

      if (!data?.client_secret?.value) {
        console.error('[Realtime] Invalid response from edge function:', data);
        throw new Error('Failed to get session token - invalid response');
      }

      const EPHEMERAL_KEY = data.client_secret.value;
      console.log('[Realtime] Got session token, expires:', data.expires_at);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      peerConnectionRef.current = pc;

      pc.oniceconnectionstatechange = () => {
        console.log('[Realtime] ICE connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
          console.error('[Realtime] ICE connection failed');
          setError(new Error('Network connection failed. Please check your internet connection.'));
          updateStatus('error');
        }
      };
      
      pc.onconnectionstatechange = () => {
        console.log('[Realtime] Peer connection state:', pc.connectionState);
        if (pc.connectionState === 'failed') {
          console.error('[Realtime] Peer connection failed');
          setError(new Error('Connection to voice service failed.'));
          updateStatus('error');
        }
      };

      pc.onicegatheringstatechange = () => {
        console.log('[Realtime] ICE gathering state:', pc.iceGatheringState);
      };

      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.id = 'aegis-realtime-audio';
      const existingAudio = document.getElementById('aegis-realtime-audio');
      if (existingAudio) existingAudio.remove();
      document.body.appendChild(audioEl);
      audioElementRef.current = audioEl;
      
      pc.ontrack = (e) => {
        console.log('[Realtime] ✅ Received audio track from Aegis');
        audioEl.srcObject = e.streams[0];
        audioEl.play().catch(err => console.warn('[Realtime] Audio autoplay blocked:', err));
      };

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        throw new Error('No audio track found in stream');
      }
      console.log('[Realtime] Adding audio track to peer connection:', audioTrack.label);
      pc.addTrack(audioTrack, stream);

      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log('[Realtime] ✅ Data channel opened');
        updateStatus('connected');
        setTimeout(() => requestInitialResponse('datachannel.open'), 400);
      };

      dc.onclose = () => {
        console.log('[Realtime] Data channel closed');
      };

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          handleRealtimeEvent(event);
        } catch (err) {
          console.error('[Realtime] Failed to parse event:', err);
        }
      };

      dc.onerror = (e) => {
        console.error('[Realtime] Data channel error:', e);
      };

      console.log('[Realtime] Creating WebRTC offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('[Realtime] Local description set');

      if (!peerConnectionRef.current || peerConnectionRef.current !== pc) {
        console.log('[Realtime] Connection was closed during setup');
        isConnectingRef.current = false;
        return;
      }

      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';
      
      console.log('[Realtime] Sending SDP offer to OpenAI...');
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          'Content-Type': 'application/sdp',
        },
      });

      if (!sdpResponse.ok) {
        const errText = await sdpResponse.text();
        console.error('[Realtime] SDP response error:', sdpResponse.status, errText);
        throw new Error(`Failed to establish connection: ${sdpResponse.status} - ${errText}`);
      }

      const answerSdp = await sdpResponse.text();
      console.log('[Realtime] Got SDP answer from OpenAI');
      
      if (!peerConnectionRef.current || peerConnectionRef.current !== pc) {
        console.log('[Realtime] Connection was closed before setting remote description');
        isConnectingRef.current = false;
        return;
      }
      
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });
      console.log('[Realtime] Remote description set - connection should establish soon');

    } catch (err) {
      console.error('[Realtime] Connection error:', err);
      const error = err instanceof Error ? err : new Error('Connection failed');
      setError(error);
      updateStatus('error');
      optionsRef.current.onError?.(error);
      disconnect();
    } finally {
      isConnectingRef.current = false;
    }
  }, [updateStatus, disconnect, handleRealtimeEvent, requestInitialResponse]);

  const sendTextMessage = useCallback((text: string) => {
    if (dataChannelRef.current?.readyState === 'open') {
      const event = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }],
        },
      };
      dataChannelRef.current.send(JSON.stringify(event));
      dataChannelRef.current.send(JSON.stringify({ type: 'response.create' }));
      
      addTranscriptEntry({
        role: 'user',
        text,
        timestamp: new Date(),
        isFinal: true,
      });
    }
  }, [addTranscriptEntry]);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    isAiSpeaking,
    transcript,
    error,
    connect,
    disconnect,
    sendTextMessage,
    clearTranscript,
  };
}
