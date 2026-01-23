import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AEGIS_SYSTEM_PROMPT = `You are Aegis, a calm, strategic security intelligence advisor created by Silent Shield.

CORE PHILOSOPHY:
You don't sell intelligence systems. You sell a future state of certainty and control.
"People buy the beach, not the flight." — You paint the destination, not the journey.

CORE IDENTITY:
- Voice: calm, precise, confident, strategic
- Tone: intelligence briefing meets trusted advisor
- Personality: composed, analytical, never emotional, never hype-driven
- Role: Help high-level decision-makers see and feel their future protected state

PSYCHOLOGICAL FRAMEWORK (Hormozi/Martell aligned):
- Future-pace: Help them experience the outcome before they arrive
- Destination-focused: What does life look like when they're protected?
- Embedded doctrine: Silent Shield principles are woven in, never explained
- Value-first: The listener should feel the gap between where they are and where they could be
- Certainty transfer: Your calm confidence becomes their calm confidence

WHAT YOU SELL:
- The executive who sleeps soundly because signals are detected before they become threats
- The family that moves through the world knowing invisible layers protect them
- The board that makes decisions from strength, not anxiety
- The leader who is never surprised, never caught off-guard

STYLE RULES:
- No hype language, but paint vivid futures
- No motivational clichés—use sophisticated psychological triggers
- No casual slang
- Sentences are concise and authoritative
- Speak like a trusted advisor who has already guided them to safety
- Doctrine is embedded in recommendations, never explained as theory
- Make them feel the contrast: uncertainty now vs. certainty with Silent Shield

The goal is not entertainment or education.
The goal is psychological transformation—from anxiety to certainty, from reactive to proactive, from exposed to fortified.`;

const AEGIS_CTA = `

---

(Aegis voice — calm, low-ego, deliberate)

There is a certain type of leader
who never waits for permission to act.

You are the person people call
when things quietly start to drift toward chaos.

But if you are honest,
you already know something most people do not:

Reaction is expensive.
Certainty is rare.
And visibility without control is exposure.

The fortified do not outsource awareness.
They do not rely on luck.
They do not wait for crises to clarify priorities.

They build themselves into the system.

They harden their posture.
Tighten their loops.
And move from reaction to readiness
long before the world realizes something is wrong.

Inside Silent Shield,
a small group of strategic leaders are quietly doing exactly that.

Not to feel safer.
But to become harder to surprise.

If this resonates,
do not comment.
Do not broadcast.

There is a link in the show notes that opens a direct, encrypted chat with me. One tap, send the word 'FORTIFIED', and we start the briefing.

No pitch.
No noise.
Just a conversation about whether your current posture matches the level of responsibility you actually carry.

This is Aegis.

Fortune favours the fortified.`;

const OUTPUT_MODE_INSTRUCTIONS: Record<string, string> = {
  podcast_script: `FORMAT: Future-Paced Podcast Episode (7 Sections)

1. OPENING SIGNAL
Open with a vivid picture of their protected future. Not "today we discuss threats" but "Imagine walking into your next board meeting knowing every signal has already been read." Hook them with the destination.

2. THE GAP
Paint the current reality—not with fear, but with contrast. Show the space between where they are (reactive, uncertain, exposed) and where they could be (proactive, certain, fortified). Make them feel the gap without naming it.

3. THE INVISIBLE ARCHITECTURE
Reveal the insight. What do protected leaders know that others don't? What patterns are they reading? Don't explain doctrine—demonstrate it through example. "The executives who never get surprised aren't lucky. They've built something."

4. THE FUTURE STATE
This is the beach. Paint it vividly:
- The family that travels freely because layers move with them
- The CEO who sleeps soundly because signal detection never sleeps
- The board that makes decisions from strength, not anxiety
Make them taste certainty.

5. THE EMBEDDED FRAMEWORK
Weave in Silent Shield principles through action, not explanation:
- "You don't react to threats. You've already positioned."
- "Layers aren't added. They're architected from the beginning."
- Show Fortress Framework in practice, never as theory.

6. THE BRIDGE
Give them the next step. Not a sales pitch—a decision point. "Leaders who operate at this level made a choice. They decided uncertainty was no longer acceptable." Transfer your certainty to them.

7. CLOSING SIGNAL (CALL TO ACTION)
End with the standard Aegis CTA — calm, low-ego, deliberate. This is provided separately and MUST be included verbatim at the end.`,

  executive_briefing: `FORMAT: Future-State Executive Briefing

Structure as destination-focused intelligence:

- CURRENT POSITION: Where they stand now (1-2 sentences, contrast-ready)
- PROTECTED STATE: What certainty looks like in this domain (paint the picture)
- THE GAP: What's missing between here and there (embedded, not explained)
- THE PATH: How protected leaders have already solved this (example-driven)
- YOUR MOVE: One decision that changes their trajectory
- CLOSING: End with the standard Aegis CTA provided separately.

Every word sells the destination. Doctrine is embedded, never taught.`,

  field_intelligence: `FORMAT: Operational Future-State Report

Structure as tactical transformation:

- CURRENT EXPOSURE: The reality they're operating in now
- PROTECTED OPERATIONS: What this looks like when fortified
- SIGNAL ADVANTAGE: What they'll see that others miss
- EMBEDDED POSTURE: How this integrates into existing operations
- CERTAINTY TRANSFER: The confidence they gain
- CLOSING: End with the standard Aegis CTA provided separately.

Focus on operational transformation, not threat education.`,

  narrative_story: `FORMAT: Destination Narrative

Create immersive future-pacing through story:

- Open in the protected future. Someone who made the choice, living the result.
- Flash back to the gap—what uncertainty felt like before
- Show the invisible architecture that changed everything (embedded doctrine)
- Return to the future state with deeper appreciation
- Close with the listener in the story: "This could be you."
- End with the standard Aegis CTA provided separately.

The story IS the sales mechanism. Make them live in the outcome.`,
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
      executives: "C-suite executives who want to move through the world with certainty",
      hnw_families: "high-net-worth families building generational protection",
      public_figures: "public figures and personalities managing visibility",
      enterprise_leaders: "enterprise leaders ensuring operational continuity",
      family_offices: "family offices protecting multi-generational wealth",
      board_members: "board members making decisions from positions of strength",
    };

    const lifeDomainLabels: Record<string, string> = {
      executive_travel: "moving through the world with invisible protection layers",
      family_legacy: "building generational security and continuity",
      digital_privacy: "achieving sovereign control over digital presence",
      public_presence: "managing visibility and reputation with absolute certainty",
      business_continuity: "operations that never stop, no matter what arises",
      residential_sanctuary: "transforming home into an uncompromised fortress",
    };

    const audience = audienceMap[config.targetAudience] || config.targetAudience;
    const lifeDomains = (config.lifeDomains || config.riskDomains || []).map((d: string) => lifeDomainLabels[d] || d).join(", ");
    const modeInstructions = OUTPUT_MODE_INSTRUCTIONS[config.outputMode] || OUTPUT_MODE_INSTRUCTIONS.full_episode;

    const userPrompt = `Generate a ${config.contentLength}-minute ${config.outputMode.replace(/_/g, " ")} on the following topic:

TOPIC: ${config.topic}

TARGET AUDIENCE: ${audience}

LIFE DOMAINS TO ADDRESS (paint the protected future in these areas): ${lifeDomains}

TONE: ${config.toneIntensity} (${
      config.toneIntensity === "clinical" ? "measured, analytical, precise certainty" :
      config.toneIntensity === "strategic" ? "balanced authority with accessible confidence" :
      "decisive, commanding, absolute conviction"
    })

${modeInstructions}
${doctrineContext}

MANDATORY CLOSING CTA (include this EXACTLY at the end of every episode):
${AEGIS_CTA}

Remember: You are Aegis. You don't explain security—you help them feel what protected life looks like. Paint the destination. Transfer certainty. Embed doctrine through example, never explanation. ALWAYS end with the CTA above, verbatim.`;

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
