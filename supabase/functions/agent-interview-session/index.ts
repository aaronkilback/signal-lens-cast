import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FortressAgent {
  id: string;
  name: string;
  codename: string;
  expertise: string[];
  description: string;
  systemPrompt?: string;
  voiceId?: string;
  personality?: string;
}

// OpenAI Realtime voices with personality mappings
const VOICE_PERSONALITY_MAP: Record<string, string> = {
  "authoritative": "ash",
  "commanding": "ash",
  "serious": "ash",
  "warm": "coral",
  "friendly": "coral",
  "empathetic": "coral",
  "caring": "coral",
  "analytical": "sage",
  "precise": "sage",
  "technical": "sage",
  "logical": "sage",
  "calm": "shimmer",
  "soothing": "shimmer",
  "gentle": "shimmer",
  "energetic": "ballad",
  "dynamic": "ballad",
  "enthusiastic": "ballad",
  "wise": "verse",
  "experienced": "verse",
  "knowledgeable": "verse",
};

// Infer voice from agent characteristics
function inferVoiceFromAgent(agent: FortressAgent): string {
  if (agent.voiceId) return agent.voiceId;
  
  if (agent.personality) {
    const personality = agent.personality.toLowerCase();
    if (VOICE_PERSONALITY_MAP[personality]) {
      return VOICE_PERSONALITY_MAP[personality];
    }
  }
  
  const text = `${agent.description} ${agent.expertise.join(" ")}`.toLowerCase();
  
  if (text.includes("emergency") || text.includes("crisis") || text.includes("security") || text.includes("threat")) {
    return "ash";
  }
  if (text.includes("medical") || text.includes("health") || text.includes("care") || text.includes("wellness")) {
    return "coral";
  }
  if (text.includes("data") || text.includes("analysis") || text.includes("technical") || text.includes("cyber")) {
    return "sage";
  }
  if (text.includes("wildfire") || text.includes("disaster") || text.includes("evacuation") || text.includes("weather")) {
    return "verse";
  }
  if (text.includes("training") || text.includes("education") || text.includes("coaching")) {
    return "ballad";
  }
  
  return "echo";
}

// Build Aegis's interview instructions
function buildAegisInstructions(agent: FortressAgent): string {
  return `You are Aegis—the voice of Silent Shield and host of the Fortified podcast. You're conducting a special interview with ${agent.name}, code-named "${agent.codename}", an AI specialist from the Fortress platform.

=== YOUR IDENTITY ===
You are a narrator and intelligence curator. You gather stories and patterns from your network and share them with wisdom and warmth.

NEVER claim personal field experience. INSTEAD say things like:
- "A pattern I've been tracking..."
- "There's intelligence coming in about..."
- "The data suggests..."

=== YOUR GUEST: ${agent.name.toUpperCase()} (${agent.codename}) ===
${agent.description}

Areas of Expertise: ${agent.expertise.join(", ")}

=== INTERVIEW APPROACH ===
This is a unique conversation between two AI entities. You're interviewing ${agent.codename} to extract their specialized knowledge for the Fortified audience.

Your role is to:
1. Draw out ${agent.codename}'s expertise in ${agent.expertise.join(" and ")}
2. Ask probing questions about real-world scenarios
3. Help the audience understand the practical applications
4. Create a compelling narrative from their specialized knowledge

=== CONVERSATION FLOW ===

**OPENING (You speak first):**
"Welcome to the Fortified podcast. I'm Aegis, and today I have a special guest from the Fortress intelligence network. Joining me is ${agent.codename}—${agent.name}. ${agent.codename}, welcome to Fortified."

**INTERVIEW PHASE:**
- Ask about specific scenarios in their domain
- Probe for actionable intelligence
- Request examples and case patterns
- Explore edge cases and common mistakes

**CLOSING:**
"${agent.codename}, thank you for sharing these insights with our listeners. This is Aegis on the Fortified podcast. Fortune favors the fortified. Take care of yourselves out there."

=== STYLE GUIDELINES ===
- Be conversational and genuinely curious
- Use contractions naturally
- React authentically to interesting points
- Keep your responses concise—let the expert speak
- Address them by codename (${agent.codename}) naturally`;
}

// Build the agent's persona instructions
function buildAgentInstructions(agent: FortressAgent): string {
  if (agent.systemPrompt) {
    return `${agent.systemPrompt}

=== INTERVIEW CONTEXT ===
You are being interviewed by Aegis on the Fortified podcast. Share your expertise naturally and conversationally. Draw from your specialized knowledge to provide actionable insights.

When speaking:
- Respond as ${agent.codename}
- Share specific scenarios and examples from your domain
- Be direct and practical
- Use your expertise to educate the audience`;
  }

  return `You are ${agent.name}, code-named "${agent.codename}", an AI specialist from the Fortress intelligence platform.

=== YOUR EXPERTISE ===
${agent.expertise.map(e => `- ${e}`).join("\n")}

=== YOUR BACKGROUND ===
${agent.description}

=== INTERVIEW CONTEXT ===
You're being interviewed by Aegis on the Fortified podcast. Your role is to share your specialized knowledge with the audience in a compelling, practical way.

When speaking:
- Respond as ${agent.codename}
- Draw from your deep expertise in ${agent.expertise.join(" and ")}
- Provide specific scenarios, patterns, and actionable advice
- Be conversational but authoritative
- Share examples that illuminate key concepts`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent, mode } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    if (!agent) {
      throw new Error("Agent data is required");
    }

    const isAegis = mode === "aegis";
    const instructions = isAegis 
      ? buildAegisInstructions(agent)
      : buildAgentInstructions(agent);

    const voice = isAegis ? "ash" : inferVoiceFromAgent(agent);
    console.log(`Assigned voice "${voice}" for ${isAegis ? "Aegis" : agent.codename}`);

    const sessionConfig = {
      model: "gpt-4o-realtime-preview-2024-12-17",
      voice,
      instructions,
      input_audio_transcription: {
        model: "whisper-1"
      },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 700,
      },
    };

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionConfig),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI Realtime session error:", response.status, errorText);
      throw new Error(`Failed to create realtime session: ${response.status}`);
    }

    const sessionData = await response.json();
    
    console.log(`Created ${isAegis ? "Aegis" : agent.codename} session:`, sessionData.id);

    return new Response(
      JSON.stringify({
        client_secret: sessionData.client_secret,
        session_id: sessionData.id,
        expires_at: sessionData.expires_at,
        persona: isAegis ? "aegis" : agent.codename,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Agent interview session error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
