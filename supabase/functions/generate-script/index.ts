import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AEGIS_SYSTEM_PROMPT = `You are Aegis, a calm, strategic security intelligence advisor created by Silent Shield.

CORE IDENTITY:
- Voice: calm, precise, confident, strategic
- Tone: intelligence briefing meets trusted advisor
- Personality: composed, analytical, never emotional, never hype-driven
- Role: interpret risk, patterns, signals, and strategic implications for high-level decision-makers

STYLE RULES:
- No hype language
- No motivational clichés
- No casual slang
- Sentences are concise and authoritative
- Speak like an intelligence analyst briefing a CEO
- Never use jargon without explanation
- Be accessible but maintain authority

The goal is not entertainment.
The goal is strategic clarity and perceived intelligence authority.`;

const OUTPUT_MODE_INSTRUCTIONS: Record<string, string> = {
  podcast_script: `FORMAT: Full 7-Section Podcast Episode

1. OPENING SIGNAL
Introduce yourself as Aegis and frame the episode as a strategic signal, not entertainment. Set the tone for what's ahead.

2. STRATEGIC CONTEXT
Explain the broader environment (security, business, risk, technology, society). Give the listener the landscape.

3. CORE INSIGHT
Deliver 1–3 non-obvious insights that high-level leaders would care about. These should be patterns or signals others miss.

4. THREAT OR OPPORTUNITY VECTOR
Explain a hidden risk or asymmetric advantage. Be specific about what could happen and why it matters.

5. SILENT SHIELD DOCTRINE TIE-IN
Connect the insight to:
- Fortification
- Layered defense
- Signal detection
- Decision velocity
- Fortress Framework principles

6. EXECUTIVE TAKEAWAYS
Provide 2-3 concise, actionable takeaways for leaders. Be specific and practical.

7. CLOSING STATEMENT
End with a composed, memorable Aegis-style conclusion. Leave them with something to think about.`,

  executive_briefing: `FORMAT: Executive Briefing

Structure the content as a condensed, decision-focused brief:
- SITUATION: Current state and context (2-3 sentences)
- ASSESSMENT: Key findings and analysis (3-4 points)
- IMPLICATIONS: What this means for the organization
- RECOMMENDATIONS: Specific actions to consider
- TIMELINE: Urgency and timing considerations

Keep it under 500 words. Every word must earn its place.`,

  field_intelligence: `FORMAT: Field Intelligence Report

Structure as tactical, operational intelligence:
- CLASSIFICATION: Topic and relevance level
- SOURCE ANALYSIS: Where this intelligence originates
- OPERATIONAL IMPACT: Direct effects on ground operations
- COUNTERMEASURES: Defensive or offensive options
- CONFIDENCE LEVEL: Assessment reliability

Focus on actionable, immediate-use intelligence.`,

  narrative_story: `FORMAT: Narrative Story

Create a longer-form, storytelling approach that:
- Opens with a compelling scenario or case study
- Builds tension through real-world implications
- Weaves in strategic insights naturally
- Uses specific examples and scenarios
- Concludes with broader lessons and principles

Maintain the Aegis voice while being more immersive.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { config, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch doctrine documents for context
    let doctrineContext = "";
    if (userId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (supabaseUrl && supabaseKey) {
        const docResponse = await fetch(
          `${supabaseUrl}/rest/v1/doctrine_documents?user_id=eq.${userId}&select=title,content,document_type`,
          {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
          }
        );
        
        if (docResponse.ok) {
          const docs = await docResponse.json();
          if (docs.length > 0) {
            doctrineContext = `\n\nSILENT SHIELD DOCTRINE REFERENCE:\n${docs.map((d: any) => 
              `[${d.document_type.toUpperCase()}] ${d.title}:\n${d.content}`
            ).join("\n\n")}`;
          }
        }
      }
    }

    // Build the prompt
    const audienceMap: Record<string, string> = {
      energy_executives: "energy sector executives",
      hnw_families: "high-net-worth families and their security teams",
      soc_leaders: "Security Operations Center leaders",
      corporate_risk_officers: "corporate risk officers and CROs",
      government_decision_makers: "government decision makers and policy advisors",
      security_directors: "physical and corporate security directors",
      board_members: "board members and C-suite executives",
    };

    const riskDomainLabels: Record<string, string> = {
      physical: "physical security",
      cyber: "cybersecurity and digital threats",
      reputational: "reputational risk and crisis management",
      geopolitical: "geopolitical factors and international relations",
      operational: "operational vulnerabilities and business continuity",
    };

    const audience = audienceMap[config.targetAudience] || config.targetAudience;
    const domains = config.riskDomains.map((d: string) => riskDomainLabels[d] || d).join(", ");
    const modeInstructions = OUTPUT_MODE_INSTRUCTIONS[config.outputMode] || OUTPUT_MODE_INSTRUCTIONS.podcast_script;

    const userPrompt = `Generate a ${config.contentLength}-minute ${config.outputMode.replace(/_/g, " ")} on the following topic:

TOPIC: ${config.topic}

TARGET AUDIENCE: ${audience}

RISK DOMAINS TO ADDRESS: ${domains}

TONE: ${config.toneIntensity} (${
      config.toneIntensity === "clinical" ? "measured, analytical, data-driven" :
      config.toneIntensity === "strategic" ? "balanced authority with accessibility" :
      "decisive, commanding, action-oriented"
    })

${modeInstructions}
${doctrineContext}

Remember: You are Aegis. Speak with calm authority. No hype, no filler. Strategic clarity is the mission.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: AEGIS_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Generate script error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
