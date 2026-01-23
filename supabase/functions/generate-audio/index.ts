import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = "onyx" } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    if (!text || text.length === 0) {
      throw new Error("No text provided for audio generation");
    }

    // OpenAI TTS has a 4096 character limit per request
    // For longer texts, we need to split and concatenate
    const MAX_CHARS = 4000;
    let audioChunks: Uint8Array[] = [];

    if (text.length <= MAX_CHARS) {
      // Single request for short texts
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
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

      const audioBuffer = await response.arrayBuffer();
      return new Response(audioBuffer, {
        headers: {
          ...corsHeaders,
          "Content-Type": "audio/mpeg",
        },
      });
    }

    // For longer texts, split by paragraphs first, then by sentences
    // This preserves text that doesn't end with punctuation
    const paragraphs = text.split(/\n\n+/).filter((p: string) => p.trim());
    let currentChunk = "";
    
    for (const paragraph of paragraphs) {
      // Split paragraph into sentences, but keep the delimiters
      const sentences = paragraph.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim());
      
      // If no sentences found (no punctuation), treat whole paragraph as one unit
      const units = sentences.length > 0 ? sentences : [paragraph];
      
      for (const unit of units) {
        const unitWithSpace = unit + " ";
        
        if ((currentChunk + unitWithSpace).length > MAX_CHARS) {
          // Process current chunk before adding new unit
          if (currentChunk.trim()) {
            console.log(`Processing chunk: ${currentChunk.length} chars`);
            const response = await fetch("https://api.openai.com/v1/audio/speech", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "tts-1-hd",
                voice: voice,
                input: currentChunk.trim(),
                response_format: "mp3",
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error("OpenAI TTS chunk error:", response.status, errorText);
              throw new Error(`OpenAI TTS failed: ${response.status}`);
            }

            const buffer = await response.arrayBuffer();
            audioChunks.push(new Uint8Array(buffer));
          }
          currentChunk = unitWithSpace;
        } else {
          currentChunk += unitWithSpace;
        }
      }
      
      // Add paragraph break pause (extra space for natural pacing)
      currentChunk += " ";
    }

    // Process remaining text
    if (currentChunk.trim()) {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1-hd",
          voice: voice,
          input: currentChunk.trim(),
          response_format: "mp3",
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI TTS failed: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      audioChunks.push(new Uint8Array(buffer));
    }

    // Concatenate all audio chunks
    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedAudio = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }

    return new Response(combinedAudio, {
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
