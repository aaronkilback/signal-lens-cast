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

  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    options.onStatusChange?.(newStatus);
  }, [options]);

  const addTranscriptEntry = useCallback((entry: TranscriptEntry) => {
    setTranscript(prev => {
      // If this is a continuation of the last entry from the same role, update it
      const lastEntry = prev[prev.length - 1];
      if (lastEntry && lastEntry.role === entry.role && !lastEntry.isFinal) {
        return [...prev.slice(0, -1), { ...entry, text: entry.text }];
      }
      return [...prev, entry];
    });
    options.onTranscript?.(entry);
  }, [options]);

  const connect = useCallback(async () => {
    try {
      updateStatus('connecting');
      setError(null);

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Get ephemeral token from our edge function
      const { data, error: fnError } = await supabase.functions.invoke('realtime-session', {
        body: {
          guestName: options.guestName,
          guestBio: options.guestBio,
          topic: options.topic,
        },
      });

      if (fnError || !data?.client_secret) {
        throw new Error(fnError?.message || 'Failed to get session token');
      }

      const EPHEMERAL_KEY = data.client_secret.value;

      // Create peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Set up audio playback
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElementRef.current = audioEl;
      
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      // Add microphone track
      pc.addTrack(stream.getTracks()[0]);

      // Set up data channel for events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log('Data channel opened');
        updateStatus('connected');
      };

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          handleRealtimeEvent(event);
        } catch (err) {
          console.error('Failed to parse realtime event:', err);
        }
      };

      dc.onerror = (e) => {
        console.error('Data channel error:', e);
      };

      // Create and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to OpenAI Realtime API
      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';
      
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
        throw new Error(`Failed to establish connection: ${sdpResponse.status} - ${errText}`);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

    } catch (err) {
      console.error('Connection error:', err);
      const error = err instanceof Error ? err : new Error('Connection failed');
      setError(error);
      updateStatus('error');
      options.onError?.(error);
      disconnect();
    }
  }, [options, updateStatus]);

  const handleRealtimeEvent = useCallback((event: any) => {
    console.log('Realtime event:', event.type);

    switch (event.type) {
      case 'session.created':
        console.log('Session created:', event.session?.id);
        break;

      case 'input_audio_buffer.speech_started':
        // User started speaking
        break;

      case 'input_audio_buffer.speech_stopped':
        // User stopped speaking
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcribed
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
        // AI is speaking - streaming transcript
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
        // AI finished speaking this response
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
        console.error('Realtime API error:', event.error);
        setError(new Error(event.error?.message || 'Realtime API error'));
        break;
    }
  }, [addTranscriptEntry]);

  const disconnect = useCallback(() => {
    // Close data channel
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Clean up audio element
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }

    updateStatus('disconnected');
    setIsAiSpeaking(false);
  }, [updateStatus]);

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
      
      // Also trigger a response
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

  // Cleanup on unmount
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
