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
    const { name } = await req.json();
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!name) {
      return new Response(
        JSON.stringify({ error: "Name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Research API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Researching: ${name}`);

    // Step 1: Use Perplexity to research the person
    const researchResponse = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are a research assistant. Provide factual, verified information about public figures. Focus on their professional background, communication style, and notable work. Be concise but comprehensive."
          },
          {
            role: "user",
            content: `Research ${name}. I need:
1. A brief professional bio (2-3 sentences)
2. Their main areas of expertise (3-5 topics)
3. Their speaking/interview style (how they communicate - direct, analytical, emotional, etc.)
4. 2-3 notable quotes or catchphrases they commonly use
5. What they're known for professionally

Focus on factual, verifiable information. This is for a podcast interview simulation.`
          }
        ],
        max_tokens: 800,
      }),
    });

    if (!researchResponse.ok) {
      const errorText = await researchResponse.text();
      console.error("Perplexity error:", errorText);
      throw new Error("Failed to research person");
    }

    const researchData = await researchResponse.json();
    const researchContent = researchData.choices?.[0]?.message?.content || "";
    const citations = researchData.citations || [];

    console.log("Research complete, structuring data...");

    // Step 2: Use AI to structure the research into a profile
    if (!LOVABLE_API_KEY) {
      // Return raw research if no structuring API available
      return new Response(
        JSON.stringify({
          success: true,
          profile: {
            name: name,
            displayName: name.split(" ")[0],
            bio: researchContent.substring(0, 500),
            expertise: [],
            speakingStyle: "",
            notableQuotes: [],
          },
          rawResearch: researchContent,
          citations,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const structureResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          {
            role: "system",
            content: `You are a data extraction assistant. Extract structured information from research text and return ONLY valid JSON. No markdown, no explanations.`
          },
          {
            role: "user",
            content: `Extract a guest profile from this research about ${name}:

${researchContent}

Return ONLY this JSON structure (no other text):
{
  "displayName": "first name or nickname they go by",
  "bio": "2-3 sentence professional bio",
  "expertise": ["area 1", "area 2", "area 3"],
  "speakingStyle": "description of how they communicate in interviews",
  "notableQuotes": ["quote 1", "quote 2"]
}`
          }
        ],
        max_tokens: 500,
      }),
    });

    if (!structureResponse.ok) {
      console.error("Structure API error");
      // Fall back to raw research
      return new Response(
        JSON.stringify({
          success: true,
          profile: {
            name: name,
            displayName: name.split(" ")[0],
            bio: researchContent.substring(0, 500),
            expertise: [],
            speakingStyle: "",
            notableQuotes: [],
          },
          rawResearch: researchContent,
          citations,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const structureData = await structureResponse.json();
    let structuredContent = structureData.choices?.[0]?.message?.content || "{}";
    
    // Clean up potential markdown wrapping
    structuredContent = structuredContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let profile;
    try {
      profile = JSON.parse(structuredContent);
    } catch (parseError) {
      console.error("Failed to parse structured content:", structuredContent);
      profile = {
        displayName: name.split(" ")[0],
        bio: researchContent.substring(0, 500),
        expertise: [],
        speakingStyle: "",
        notableQuotes: [],
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile: {
          name: name,
          displayName: profile.displayName || name.split(" ")[0],
          bio: profile.bio || "",
          expertise: profile.expertise || [],
          speakingStyle: profile.speakingStyle || "",
          notableQuotes: profile.notableQuotes || [],
        },
        citations,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Research error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Research failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});