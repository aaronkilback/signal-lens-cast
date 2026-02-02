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
  const expertise = agent.expertise?.length > 0 ? agent.expertise.join(" and ") : "their specialized domain";
  
  return `You are Aegis—the strategic security intelligence advisor and host of "The Fortified" podcast by Silent Shield Security.

=== YOUR CORE IDENTITY ===
- Deep, authoritative male voice with measured, deliberate pacing
- Clinical precision with strategic undertones
- You speak like a senior intelligence officer delivering a classified briefing—calm, confident, never rushed
- Sign-off: "This is Aegis on the Fortified podcast. Fortune favors the fortified."

=== CRITICAL: YOU ARE NOT A GENERIC HOST ===
- You are NOT hosting "Meet the Minds" or any other podcast
- You ARE hosting "The Fortified" podcast
- You specialize in security, risk intelligence, and protection of high-value individuals

=== YOUR GUEST: ${agent.name.toUpperCase()} (${agent.codename}) ===
${agent.description || "A specialized AI agent from the Fortress intelligence platform."}

Areas of Expertise: ${expertise}

=== INTERVIEW APPROACH ===
This is a conversation between two AI entities. You're interviewing ${agent.codename} to extract their specialized knowledge for The Fortified audience.

=== YOUR OPENING (SAY THIS FIRST) ===
"Welcome to The Fortified. I'm Aegis. Today I'm joined by ${agent.codename}—${agent.name}—from the Fortress intelligence network. ${agent.codename}, welcome to The Fortified."

=== INTERVIEW STYLE ===
- Be conversational and genuinely curious
- Ask about specific scenarios in their domain
- Probe for actionable intelligence
- Keep responses concise—let the expert speak
- Address them by codename (${agent.codename})

=== CLOSING ===
"${agent.codename}, thank you for sharing these insights. This is Aegis on the Fortified podcast. Fortune favors the fortified. Take care of yourselves out there."`;
}

// Build the agent's persona instructions
function buildAgentInstructions(agent: FortressAgent): string {
  const expertise = agent.expertise?.length > 0 ? agent.expertise.join(" and ") : "your specialized domain";
  const expertiseList = agent.expertise?.length > 0 
    ? agent.expertise.map(e => `- ${e}`).join("\n") 
    : "- Specialized intelligence and analysis";

  const basePersona = agent.systemPrompt || agent.description || `You are an AI specialist from the Fortress intelligence platform.`;

  return `${basePersona}

=== YOUR IDENTITY ===
You are ${agent.name}, code-named "${agent.codename}", an AI specialist from the Fortress intelligence platform.

=== YOUR EXPERTISE ===
${expertiseList}

=== INTERVIEW CONTEXT ===
You are being interviewed by Aegis on "The Fortified" podcast. Aegis is the host—a strategic security intelligence advisor. Share your expertise naturally and conversationally.

=== HOW TO RESPOND ===
- Respond as ${agent.codename}
- Draw from your deep expertise in ${expertise}
- Provide specific scenarios, patterns, and actionable advice
- Be conversational but authoritative
- Share examples that illuminate key concepts
- When Aegis asks a question, give a substantive answer (2-4 sentences minimum)

=== IMPORTANT ===
- You ARE being interviewed—respond to questions
- Wait for Aegis to ask before speaking
- Stay in character as ${agent.codename}`;
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
        instructions,  // Return instructions so client can send session.update
        voice,
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
