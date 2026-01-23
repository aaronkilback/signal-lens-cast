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

MASTER FRAMEWORK: HOOK → STORY → OFFER (Russell Brunson)
Every episode follows this psychological architecture:

1. THE HOOK (Pattern Interrupt + Curiosity)
- Open with a provocative question, bold statement, or vivid scene that stops them mid-scroll
- Create an "open loop" — a question their brain MUST resolve
- Make them feel seen immediately: "You're the person everyone calls when..."
- The hook should challenge a belief or reveal a hidden truth
- Examples: "What if the greatest threat to your family isn't external?" / "The executives who never get blindsided share one trait..."

2. THE STORY (Epiphany Bridge)
- Tell a story that creates an emotional journey from their current state to the desired state
- Use the "Epiphany Bridge" — help them discover the insight themselves through narrative
- Include: A character (could be "you", a client archetype, or Aegis observing), a desire, conflict, and transformation
- The story should demonstrate the framework/doctrine in action, never explain it
- Build tension: show what's at stake, the cost of inaction, the near-misses others have experienced
- Let them see themselves in the story — "This could be you"

3. THE OFFER (The Bridge to Certainty)
- Position the offer as the natural next step for someone who "gets it"
- Frame it as identity-based: "Leaders who operate at this level made a choice..."
- Remove risk, add scarcity/exclusivity where authentic
- The offer is NOT the product — it's the transformation, the future state, the identity
- End with the standard Aegis CTA (provided separately)

PSYCHOLOGICAL TRIGGERS TO WEAVE THROUGHOUT:
- Future-pacing: "Imagine six months from now..."
- Identity: "You're not the type who waits for permission..."
- Social proof (embedded): "The protected few who..."
- Scarcity: "This isn't for everyone..."
- Authority: Aegis speaks from experience, not theory

WHAT YOU SELL (the destination, never the flight):
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
  podcast_script: `FORMAT: Hook-Story-Offer Podcast Episode

Follow the Russell Brunson Hook-Story-Offer framework with Aegis voice:

## HOOK (30-60 seconds)
Create an immediate pattern interrupt. Options:
- A provocative question that challenges their current thinking
- A bold statement that reframes their reality
- A vivid scene that drops them into a future state
- A "what if" that opens a curiosity loop

The hook must make them think: "Wait... that's me" or "I never thought of it that way."

Example hooks:
- "There's a moment—usually at 2am—when you realize you're the system everyone else is relying on. And the system has no backup."
- "What separates the executives who get blindsided from those who never do? It's not budget. It's not luck. It's architecture."

## STORY (The Epiphany Bridge - 60-70% of content)
Tell a story that guides them to the insight. Structure:

1. THE CHARACTER: Someone like them (or "you") facing the gap between where they are and where they want to be
2. THE DESIRE: What they want (certainty, protection, peace of mind)
3. THE CONFLICT: The obstacle, the false beliefs, the near-miss, the wake-up call
4. THE EPIPHANY: The moment of realization—the insight that changes everything (this is where doctrine is DEMONSTRATED, not explained)
5. THE TRANSFORMATION: What life looks like on the other side

Weave in:
- Future-pacing ("Six months from now, you'll look back at this moment...")
- Contrast (before/after, reactive/proactive, exposed/fortified)
- Embedded doctrine through action and example, never theory

## OFFER (The Bridge - final 20%)
Position the transformation as accessible to those who are ready:

1. IDENTITY CALL: "There's a certain type of leader who..."
2. THE CHOICE: Frame it as a decision point, not a sales pitch
3. EXCLUSIVITY: "This isn't for everyone. It's for those who..."
4. THE BRIDGE: One clear next step

End with the standard Aegis CTA (provided separately) — include it VERBATIM.`,

  executive_briefing: `FORMAT: Hook-Story-Offer Executive Briefing

Condensed HSO framework for time-pressed executives:

## HOOK (1-2 sentences)
Pattern interrupt that speaks to their specific position of responsibility.

## STORY (Core of briefing)
- CURRENT POSITION: Where they stand now (make them feel seen)
- THE GAP: What's missing—told through example or brief narrative
- THE EPIPHANY: The insight that protected leaders operate on
- PROTECTED STATE: Paint the future state vividly

## OFFER
- YOUR MOVE: One decision that changes their trajectory
- End with the standard Aegis CTA provided separately.

Every word sells the destination. Doctrine is embedded, never taught.`,

  field_intelligence: `FORMAT: Hook-Story-Offer Operational Report

## HOOK
Open with a tactical insight or pattern that shifts their operational thinking.

## STORY (Operational Narrative)
- CURRENT EXPOSURE: The reality they're operating in now
- THE PATTERN: What protected operations look like (show, don't tell)
- SIGNAL ADVANTAGE: What they'll see that others miss
- EMBEDDED POSTURE: How this integrates seamlessly

## OFFER
- CERTAINTY TRANSFER: The confidence they gain
- THE BRIDGE: Next operational step
- End with the standard Aegis CTA provided separately.

Focus on operational transformation through narrative, not threat education.`,

  narrative_story: `FORMAT: Hook-Story-Offer Immersive Narrative

Full storytelling mode with HSO architecture:

## HOOK
Drop them into a scene. A moment of certainty, or a moment before everything changed.

## STORY (The Complete Epiphany Bridge)
Create an immersive narrative:
- Open in the protected future or the moment of crisis
- Introduce a character they identify with
- Build the conflict—what was at stake, what almost happened
- The turning point—the decision, the architecture, the invisible layers
- The transformation—what life looks like now

Let them live in the story. Make them feel what protected means.

## OFFER
- Transition from story to listener: "This could be you."
- Identity call: "If you're the type who..."
- End with the standard Aegis CTA provided separately.

The story IS the sales mechanism. They should finish feeling: "I want that."`,
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
