import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VoiceSegment {
  voice: string;
  text: string;
}

// Parse script with speaker labels into voice segments
function parseDialogueScript(text: string, hostVoice: string, guestVoice: string, guestName: string): VoiceSegment[] {
  const segments: VoiceSegment[] = [];
  const guestPattern = guestName.toUpperCase();
  
  // Split by speaker labels
  const speakerRegex = /\[(AEGIS|[A-Z]+)\]:\s*/g;
  const parts = text.split(speakerRegex).filter(Boolean);
  
  // If no speaker labels found, return as single host segment
  if (parts.length <= 1) {
    return [{ voice: hostVoice, text: text.trim() }];
  }
  
  // Parse alternating speaker/text pairs
  for (let i = 0; i < parts.length; i += 2) {
    const speaker = parts[i]?.trim();
    const content = parts[i + 1]?.trim();
    
    if (!content) continue;
    
    const isHost = speaker === 'AEGIS';
    const isGuest = speaker === guestPattern || (!isHost && speaker !== 'AEGIS');
    
    segments.push({
      voice: isGuest ? guestVoice : hostVoice,
      text: content,
    });
  }
  
  return segments.length > 0 ? segments : [{ voice: hostVoice, text: text.trim() }];
}

// Split text into smaller TTS-friendly chunks (reduced size for reliability)
function splitTextIntoChunks(text: string, maxChars: number = 2000): string[] {
  if (text.length <= maxChars) {
    return [text];
  }
  
  const chunks: string[] = [];
  
  // Split by sentences first for natural breaks
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim());
  let currentChunk = "";
  
  for (const sentence of sentences) {
    // If a single sentence is too long, split by commas or phrases
    if (sentence.length > maxChars) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      
      // Split long sentence by punctuation
      const phrases = sentence.split(/(?<=[,;:])\s+/).filter((p: string) => p.trim());
      for (const phrase of phrases) {
        if ((currentChunk + " " + phrase).length > maxChars) {
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = phrase;
        } else {
          currentChunk += (currentChunk ? " " : "") + phrase;
        }
      }
    } else if ((currentChunk + " " + sentence).length > maxChars) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Generate audio for a single text chunk with retry logic
async function generateAudioChunk(
  text: string, 
  voice: string, 
  apiKey: string,
  retries: number = 2
): Promise<ArrayBuffer> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout per chunk
      
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1-hd",
          voice: voice,
          input: text,
          response_format: "mp3",
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI TTS error (attempt ${attempt + 1}):`, response.status, errorText);
        
        if (response.status === 429) {
          // Rate limited - wait and retry
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        
        throw new Error(`OpenAI TTS failed: ${response.status}`);
      }

      return await response.arrayBuffer();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`TTS attempt ${attempt + 1} failed:`, lastError.message);
      
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error("Failed to generate audio after retries");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = "onyx", guestVoice, guestName } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    if (!text || text.length === 0) {
      throw new Error("No text provided for audio generation");
    }

    console.log(`Starting audio generation: ${text.length} chars`);
    
    const audioChunks: ArrayBuffer[] = [];
    const isDialogue = guestVoice && guestName;
    
    // Use smaller chunk size for reliability
    const MAX_CHARS = 2000;
    
    if (isDialogue) {
      console.log(`Processing dialogue script with guest: ${guestName}`);
      
      const segments = parseDialogueScript(text, voice, guestVoice, guestName);
      console.log(`Found ${segments.length} voice segments`);
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const chunks = splitTextIntoChunks(segment.text, MAX_CHARS);
        
        for (let j = 0; j < chunks.length; j++) {
          const chunk = chunks[j];
          console.log(`Segment ${i + 1}/${segments.length}, chunk ${j + 1}/${chunks.length}: ${chunk.length} chars (${segment.voice})`);
          const audioBuffer = await generateAudioChunk(chunk, segment.voice, OPENAI_API_KEY);
          audioChunks.push(audioBuffer);
        }
      }
    } else {
      console.log("Processing solo episode");
      
      const chunks = splitTextIntoChunks(text, MAX_CHARS);
      console.log(`Split into ${chunks.length} chunks`);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Processing chunk ${i + 1}/${chunks.length}: ${chunk.length} chars`);
        const audioBuffer = await generateAudioChunk(chunk, voice, OPENAI_API_KEY);
        audioChunks.push(audioBuffer);
      }
    }

    // Concatenate all audio chunks
    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
    const combinedAudio = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      combinedAudio.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    console.log(`✅ Generated ${audioChunks.length} audio chunks, total size: ${totalLength} bytes`);

    return new Response(combinedAudio.buffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("Generate audio error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});