import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId, storagePath } = await req.json();
    
    if (!videoId || !storagePath) {
      return new Response(
        JSON.stringify({ error: "videoId and storagePath are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get signed URL for the video
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("videos")
      .createSignedUrl(storagePath, 3600);

    if (signedUrlError || !signedUrlData) {
      throw new Error(`Failed to get signed URL: ${signedUrlError?.message}`);
    }

    // Download the video file
    const videoResponse = await fetch(signedUrlData.signedUrl);
    if (!videoResponse.ok) {
      throw new Error("Failed to download video for transcription");
    }

    const videoBlob = await videoResponse.blob();

    // Create form data for OpenAI Whisper
    const formData = new FormData();
    formData.append("file", videoBlob, "video.mp4");
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "word");
    formData.append("timestamp_granularities[]", "segment");

    // Transcribe with OpenAI Whisper
    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error("Whisper API error:", errorText);
      throw new Error(`Whisper transcription failed: ${whisperResponse.status}`);
    }

    const transcriptionData = await whisperResponse.json();

    // Format segments for captions
    const segments = transcriptionData.segments?.map((seg: any) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
      words: seg.words?.map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
      })) || [],
    })) || [];

    // Update video record with transcription
    const { error: updateError } = await supabase
      .from("video_uploads")
      .update({
        transcription: transcriptionData.text,
        transcription_segments: segments,
        status: "transcribed",
      })
      .eq("id", videoId);

    if (updateError) {
      throw new Error(`Failed to update video: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcription: transcriptionData.text,
        segments,
        duration: transcriptionData.duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
