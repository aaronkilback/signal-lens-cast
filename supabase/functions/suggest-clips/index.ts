import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcription, segments, duration, targetDuration = 60 } = await req.json();

    if (!transcription || !segments) {
      return new Response(
        JSON.stringify({ error: "transcription and segments are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert video editor who creates viral short-form content for Instagram Reels and YouTube Shorts.
Your job is to analyze video transcripts and identify the BEST moments to extract as clips.

Dan Martell style shorts have these characteristics:
- Strong hook in the first 3 seconds (surprising statement, bold claim, or question)
- Single focused idea or insight per clip
- High energy, quotable moments
- Clear actionable takeaway
- Emotional peaks (passion, conviction, humor)
- Pattern interrupts and contrarian views

For each suggested clip, provide:
1. Exact start and end timestamps
2. A punchy title (5-8 words)
3. The key insight or hook
4. A "virality score" (1-10) based on engagement potential
5. Suggested headline overlay text (bold, impactful, 3-6 words)`;

    const userPrompt = `Analyze this video transcript and suggest the TOP 5 best clips to extract as short-form content.
Target clip duration: ${targetDuration} seconds (but prioritize complete thoughts, can be 15-90 seconds)
Total video duration: ${duration} seconds

TRANSCRIPT WITH TIMESTAMPS:
${segments.map((s: any) => `[${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s]: ${s.text}`).join("\n")}

FULL TRANSCRIPT:
${transcription}

Return your response as a JSON array of clip suggestions. Each clip should have:
- start_time: number (seconds)
- end_time: number (seconds)  
- title: string (punchy 5-8 word title)
- hook: string (the opening hook or key insight)
- headline: string (3-6 word bold overlay text)
- score: number (1-10 virality score)
- reason: string (why this clip will perform well)

Return ONLY the JSON array, no other text.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI clip suggestion failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    // Parse the JSON response
    let clips;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      clips = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (e) {
      console.error("Failed to parse clip suggestions:", e);
      clips = [];
    }

    // Sort by score descending
    clips.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

    return new Response(
      JSON.stringify({ clips }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Clip suggestion error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
