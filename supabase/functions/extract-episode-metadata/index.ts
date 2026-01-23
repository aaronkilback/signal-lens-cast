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
    const { script, topic } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You extract metadata from podcast episode scripts for continuity purposes. Always respond with valid JSON only, no other text.`,
          },
          {
            role: "user",
            content: `Analyze this podcast episode script and extract:
1. key_stories: Array of 2-4 memorable story elements or anecdotes (brief descriptions, 5-10 words each)
2. people_mentioned: Array of character names/roles mentioned (e.g., "Marcus the CEO", "the CFO's daughter", "a hedge fund manager")
3. themes: Array of 2-4 main themes or frameworks introduced (e.g., "The Invisible Architecture", "Fortification Principle")
4. episode_summary: One paragraph (2-3 sentences) summarizing the key insight and story

Topic: ${topic}

Script:
${script.slice(0, 8000)}

Respond ONLY with valid JSON in this exact format:
{
  "key_stories": ["story 1", "story 2"],
  "people_mentioned": ["person 1", "person 2"],
  "themes": ["theme 1", "theme 2"],
  "episode_summary": "Brief summary..."
}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ 
        key_stories: [],
        people_mentioned: [],
        themes: [],
        episode_summary: topic
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse the JSON response
    try {
      // Clean up potential markdown code blocks
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      const metadata = JSON.parse(cleanedContent);
      
      return new Response(JSON.stringify({
        key_stories: metadata.key_stories || [],
        people_mentioned: metadata.people_mentioned || [],
        themes: metadata.themes || [],
        episode_summary: metadata.episode_summary || topic,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (parseError) {
      console.error("Failed to parse metadata:", parseError, content);
      return new Response(JSON.stringify({
        key_stories: [],
        people_mentioned: [],
        themes: [],
        episode_summary: topic,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Extract metadata error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
