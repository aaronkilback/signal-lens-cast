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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const FORTRESS_URL = Deno.env.get("FORTRESS_SUPABASE_URL");
    const FORTRESS_KEY = Deno.env.get("FORTRESS_SERVICE_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    if (!FORTRESS_URL || !FORTRESS_KEY) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch fresh intelligence from Fortress
    const headers = { apikey: FORTRESS_KEY, Authorization: `Bearer ${FORTRESS_KEY}` };

    const [knowledgeRes, beliefsRes, connectionsRes, signalsRes] = await Promise.all([
      fetch(`${FORTRESS_URL}/rest/v1/expert_knowledge?is_active=eq.true&confidence_score=gte.0.70&order=created_at.desc&limit=15&select=domain,subdomain,title,content,confidence_score,created_at`, { headers }),
      fetch(`${FORTRESS_URL}/rest/v1/agent_beliefs?is_active=eq.true&confidence=gte.0.72&order=created_at.desc&limit=12&select=agent_call_sign,hypothesis,belief_type,confidence,created_at`, { headers }),
      fetch(`${FORTRESS_URL}/rest/v1/knowledge_connections?connection_strength=gte.0.68&order=created_at.desc&limit=8&select=synthesis_note,agents_involved,connection_strength`, { headers }),
      fetch(`${FORTRESS_URL}/rest/v1/signals?order=created_at.desc&limit=20&select=title,description,severity,category,created_at`, { headers }),
    ]);

    const [knowledge, beliefs, connections, signals] = await Promise.all([
      knowledgeRes.ok ? knowledgeRes.json() : [],
      beliefsRes.ok ? beliefsRes.json() : [],
      connectionsRes.ok ? connectionsRes.json() : [],
      signalsRes.ok ? signalsRes.json() : [],
    ]);

    // Build intelligence summary for Gemini
    const intelligenceParts: string[] = [];

    if (knowledge?.length) {
      intelligenceParts.push(`EXPERT KNOWLEDGE (${knowledge.length} entries):\n` +
        knowledge.slice(0, 10).map((k: any) =>
          `- [${k.domain?.toUpperCase()}] ${k.title}: ${k.content?.substring(0, 150)}`
        ).join("\n")
      );
    }

    if (beliefs?.length) {
      intelligenceParts.push(`AGENT BELIEFS & HYPOTHESES (${beliefs.length} active):\n` +
        beliefs.slice(0, 8).map((b: any) =>
          `- ${b.agent_call_sign} (${Math.round(b.confidence * 100)}%): ${b.hypothesis}`
        ).join("\n")
      );
    }

    if (connections?.length) {
      intelligenceParts.push(`CROSS-DOMAIN CONNECTIONS (${connections.length} patterns):\n` +
        connections.map((c: any) =>
          `- [${c.agents_involved?.join(' + ')}]: ${c.synthesis_note}`
        ).join("\n")
      );
    }

    if (signals?.length) {
      intelligenceParts.push(`RECENT SIGNALS (${signals.length} flagged):\n` +
        signals.slice(0, 10).map((s: any) =>
          `- [${(s.severity || 'medium').toUpperCase()}] ${s.title}: ${s.description?.substring(0, 100)}`
        ).join("\n")
      );
    }

    if (intelligenceParts.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const intelligenceSummary = intelligenceParts.join("\n\n");

    // Use Gemini to synthesize episode ideas
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are the intelligence analyst for Aegis, host of The Fortified Podcast. Your job is to translate raw field intelligence into compelling podcast episode ideas. The show serves executives, high-net-worth families, and public figures who need to think about security, protection, privacy, and resilience.

Respond ONLY with valid JSON. No markdown, no explanations.`,
          },
          {
            role: "user",
            content: `Based on the live intelligence below from the Silent Shield agent network, generate 5 compelling podcast episode topic suggestions. Each suggestion should be timely, specific, and grounded in the actual intelligence patterns you see.

LIVE INTELLIGENCE FROM FORTRESS PLATFORM:
${intelligenceSummary}

Generate 5 episode ideas that:
1. Draw directly from the most significant patterns or signals in this intelligence
2. Would genuinely interest executives and HNW families
3. Are specific enough to generate a compelling 10-15 minute episode
4. Have a clear angle that connects intelligence to personal/family/business protection

Return ONLY this JSON structure:
{
  "suggestions": [
    {
      "topic": "Concise episode title/topic (under 80 chars)",
      "rationale": "Why this matters now — 1-2 sentences grounded in the intelligence",
      "urgency": "high|medium|low",
      "domains": ["executive_travel", "digital_privacy"],
      "intelligence_source": "brief description of which signal/belief triggered this"
    }
  ]
}

Valid domains: executive_travel, family_legacy, digital_privacy, public_presence, business_continuity, residential_sanctuary`
          }
        ],
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "{}";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      result = { suggestions: [] };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Suggest episode topics error:", error);
    return new Response(
      JSON.stringify({ suggestions: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
