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

// Split text into TTS-friendly chunks
function splitTextIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }
  
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/).filter((p: string) => p.trim());
  let currentChunk = "";
  
  for (const paragraph of paragraphs) {
    const sentences = paragraph.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim());
    const units = sentences.length > 0 ? sentences : [paragraph];
    
    for (const unit of units) {
      const unitWithSpace = unit + " ";
      
      if ((currentChunk + unitWithSpace).length > maxChars) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = unitWithSpace;
      } else {
        currentChunk += unitWithSpace;
      }
    }
    currentChunk += " ";
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Generate audio for a single text chunk
async function generateAudioChunk(text: string, voice: string, apiKey: string): Promise<ArrayBuffer> {
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI TTS error:", response.status, errorText);
    throw new Error(`OpenAI TTS failed: ${response.status}`);
  }

  return await response.arrayBuffer();
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

    const MAX_CHARS = 4000;
    const audioChunks: ArrayBuffer[] = [];
    
    // Check if this is a dialogue script (has guest info)
    const isDialogue = guestVoice && guestName;
    
    if (isDialogue) {
      console.log(`Processing dialogue script with guest: ${guestName}`);
      
      // Parse script into voice segments
      const segments = parseDialogueScript(text, voice, guestVoice, guestName);
      console.log(`Found ${segments.length} voice segments`);
      
      for (const segment of segments) {
        // Split each segment into TTS-friendly chunks
        const chunks = splitTextIntoChunks(segment.text, MAX_CHARS);
        
        for (const chunk of chunks) {
          console.log(`Processing ${segment.voice} chunk: ${chunk.length} chars`);
          const audioBuffer = await generateAudioChunk(chunk, segment.voice, OPENAI_API_KEY);
          audioChunks.push(audioBuffer);
        }
      }
    } else {
      // Solo episode - single voice
      console.log("Processing solo episode");
      
      if (text.length <= MAX_CHARS) {
        const audioBuffer = await generateAudioChunk(text, voice, OPENAI_API_KEY);
        return new Response(audioBuffer, {
          headers: {
            ...corsHeaders,
            "Content-Type": "audio/mpeg",
          },
        });
      }
      
      // Split and process long solo content
      const paragraphs = text.split(/\n\n+/).filter((p: string) => p.trim());
      let currentChunk = "";
      
      for (const paragraph of paragraphs) {
        const sentences = paragraph.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim());
        const units = sentences.length > 0 ? sentences : [paragraph];
        
        for (const unit of units) {
          const unitWithSpace = unit + " ";
          
          if ((currentChunk + unitWithSpace).length > MAX_CHARS) {
            if (currentChunk.trim()) {
              console.log(`Processing chunk: ${currentChunk.length} chars`);
              const audioBuffer = await generateAudioChunk(currentChunk.trim(), voice, OPENAI_API_KEY);
              audioChunks.push(audioBuffer);
            }
            currentChunk = unitWithSpace;
          } else {
            currentChunk += unitWithSpace;
          }
        }
        currentChunk += " ";
      }

      if (currentChunk.trim()) {
        const audioBuffer = await generateAudioChunk(currentChunk.trim(), voice, OPENAI_API_KEY);
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

    console.log(`Generated ${audioChunks.length} audio chunks, total size: ${totalLength} bytes`);

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