import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASSET_PROMPTS: Record<string, string> = {
  show_notes: `Generate professional podcast show notes for the following episode script. Include:
- A compelling 2-3 sentence episode description
- 5-7 key takeaways as bullet points
- Links placeholder for resources mentioned
- Guest info placeholder if applicable

Format as clean, readable text ready to paste into Buzzsprout or podcast hosting.
Keep it concise—no fluff. Every word earns its place.`,

  chapter_markers: `Create chapter markers with timestamps for the following podcast script. Estimate timestamps based on a natural speaking pace of 150 words per minute.

Format each chapter as:
00:00 - Chapter Title

Include:
- Opening/Introduction
- 4-8 major topic transitions
- The offer/CTA section
- Closing

Output ONLY the timestamp list, ready to paste into podcast hosting platforms.`,

  transcript: `Create a clean, formatted transcript from the following podcast script. Include:
- Speaker attribution (Aegis:)
- Natural paragraph breaks every 3-4 sentences
- Proper punctuation for readability

Output a clean transcript ready for accessibility/SEO purposes.`,

  social_posts: `Create 5 social media posts to promote this podcast episode. Include:

1. LINKEDIN POST (professional, thought-leadership, 150-200 words)
2. TWITTER/X THREAD (5 tweets, punchy, quotable insights)
3. INSTAGRAM CAPTION (engaging, with emoji, include CTA)
4. FACEBOOK POST (conversational, community-focused)
5. SHORT TEASER (1-2 sentences for Stories/Reels/TikTok caption)

Use the episode's best quotes and insights. Each post should work standalone.
Include hashtag suggestions where appropriate.`,

  blog_post: `Transform this podcast episode into a compelling 800-1200 word blog post. Include:

- SEO-friendly title (under 60 chars)
- Meta description (under 160 chars)
- Opening hook paragraph
- 3-5 subheadings (H2) organizing the content
- Key takeaways section
- CTA that matches the episode's call to action
- "Listen to the full episode" embed placeholder

Write for someone who prefers reading to listening. Make it scannable with short paragraphs.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { script, topic, assetType } = await req.json();
    
    if (!script || !assetType) {
      return new Response(
        JSON.stringify({ error: "Script and assetType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const assetPrompt = ASSET_PROMPTS[assetType];
    if (!assetPrompt) {
      return new Response(
        JSON.stringify({ error: `Unknown asset type: ${assetType}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userPrompt = `${assetPrompt}

EPISODE TOPIC: ${topic || "Podcast Episode"}

FULL SCRIPT:
${script}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a professional podcast marketing specialist. Generate clean, ready-to-use content for podcast distribution. No explanations or meta-commentary—just the requested asset.",
          },
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
      return new Response(JSON.stringify({ error: "Asset generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ content, assetType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating asset:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
