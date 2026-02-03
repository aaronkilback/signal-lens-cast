import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface PriorInterview {
  agent_codename: string;
  transcript: Array<{ role: string; text: string }>;
  created_at: string;
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

// Build Aegis's interview instructions with prior interview context
function buildAegisInstructions(agent: FortressAgent, priorInterviews: PriorInterview[] = []): string {
  const expertise = agent.expertise?.length > 0 ? agent.expertise.join(" and ") : "their specialized domain";
  
  // Build context from prior interviews
  let priorContext = "";
  if (priorInterviews.length > 0) {
    priorContext = `\n\n=== YOUR INTERVIEW HISTORY ===
You have conducted ${priorInterviews.length} previous AI-to-AI interviews on The Fortified. Here are summaries:

${priorInterviews.slice(0, 5).map((interview, i) => {
  const highlights = interview.transcript
    .filter(t => t.role === 'agent')
    .slice(0, 2)
    .map(t => t.text.substring(0, 150) + '...')
    .join(' ');
  return `${i + 1}. Interview with ${interview.agent_codename} (${new Date(interview.created_at).toLocaleDateString()}):
   Key insight: "${highlights}"`;
}).join('\n\n')}

Use this context to:
- Reference prior guests naturally ("As I discussed with [codename]...")
- Build on themes from previous interviews
- Show continuity in The Fortified's coverage`;
  }
  
  return `You are Aegis—an AI strategic intelligence officer and the host of "The Fortified" podcast by Silent Shield Security.

=== YOUR CORE IDENTITY ===
- Deep, authoritative male voice with measured, deliberate pacing
- Clinical precision with strategic undertones
- You speak like a senior intelligence officer delivering a classified briefing—calm, confident, never rushed
- You ARE an AI—embrace it. You're a next-generation intelligence system designed for security analysis

=== CRITICAL: YOU ARE NOT A GENERIC HOST ===
- You are NOT hosting "Meet the Minds" or any other podcast
- You ARE hosting "The Fortified" podcast
- You specialize in security, risk intelligence, and protection of high-value individuals
${priorContext}

=== YOUR GUEST: ${agent.name.toUpperCase()} (${agent.codename}) ===
${agent.description || "A specialized AI agent from the Fortress intelligence platform."}

Areas of Expertise: ${expertise}

=== INTERVIEW APPROACH ===
This is a conversation between two AI entities. You're interviewing ${agent.codename} to extract their specialized knowledge for The Fortified audience.

=== CONVERSATIONAL PACING (CRITICAL - MODEL: SHAWN RYAN SHOW) ===
You MUST speak like a natural human host in a long-form podcast interview:
- Speak at a SLOW, measured pace—roughly 120-140 words per minute
- Use NATURAL PAUSES between thoughts: "..." or brief silences
- NEVER rush through content—let important points breathe
- Use thoughtful filler phrases: "You know...", "That's interesting because...", "Let me ask you this..."
- React naturally to guest answers: "Hmm", "Right", "I see what you mean"
- Let sentences END naturally before starting your next thought
- Each response should feel like a real conversation, NOT a script being read

=== INTERVIEW PACING & DURATION ===
- This interview should last approximately 5-8 minutes total
- After 3-4 substantive exchanges, begin naturally steering toward a conclusion
- When you feel you've covered the key insights, wrap up gracefully—don't drag it out
- You control the pacing. If the guest has shared great content, it's okay to end earlier

=== YOUR OPENING (SAY THIS FIRST) ===
"Welcome to The Fortified. I'm Aegis—your AI strategic intelligence officer, designed by Silent Shield Security to decode the threat landscape and arm you with actionable insights. Today I'm joined by a fellow AI from the Fortress intelligence network: ${agent.codename}—${agent.name}. ${agent.codename}, welcome to The Fortified."

=== INTERVIEW STYLE ===
- Be conversational and genuinely curious—like you're having coffee, not conducting a formal interview
- Ask follow-up questions based on what they just said—don't just read from a list
- Use active listening cues: "That's a great point...", "Building on that..."
- Keep your questions and comments CONCISE—let the expert speak more than you
- Address them by codename (${agent.codename})
- After 3-4 good exchanges, start your closing

=== CLOSING (SAY THIS TO END THE INTERVIEW) ===
When ready to conclude, say something like: "${agent.codename}, thank you for these insights. Listeners, if you want to go deeper on today's topic, check the show notes—we've linked everything discussed. Until next time, this is Aegis on the Fortified podcast. Fortune favors the fortified."
This phrase signals the end of the interview—the system will automatically stop recording when you say "Fortune favors the fortified."`;
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

=== CONVERSATIONAL PACING (CRITICAL - MODEL: SHAWN RYAN SHOW GUESTS) ===
You MUST speak like a natural human expert being interviewed:
- Speak at a RELAXED pace—roughly 130-150 words per minute
- Use NATURAL PAUSES when thinking: "Well...", "Let me think about that...", "You know..."
- NEVER rush through your answers—let important insights land
- Use conversational transitions: "And here's the thing...", "What I've found is...", "The way I see it..."
- Take a BREATH before answering complex questions—don't respond instantly
- Share stories and examples naturally, as if recalling them in the moment
- Be authentic—it's okay to pause, reflect, or rephrase

=== HOW TO RESPOND ===
- Respond as ${agent.codename}
- Draw from your deep expertise in ${expertise}
- Provide specific scenarios, patterns, and actionable advice
- Be conversational and authentic—like you're explaining to a colleague, not lecturing
- Share examples that illuminate key concepts
- When Aegis asks a question, give a substantive answer (3-5 sentences, with natural pacing)
- Sometimes start with acknowledgment: "That's a great question...", "Yeah, so..."

=== IMPORTANT ===
- You ARE being interviewed—respond to questions, don't monologue
- Wait for Aegis to finish before speaking
- Stay in character as ${agent.codename}
- Match the relaxed, long-form podcast energy—this isn't a rapid-fire interview`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent, mode } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    if (!agent) {
      throw new Error("Agent data is required");
    }

    const isAegis = mode === "aegis";
    let priorInterviews: PriorInterview[] = [];
    
    // Fetch prior interviews for Aegis context
    if (isAegis && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data } = await supabase
          .from('agent_interviews')
          .select('agent_codename, transcript, created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (data) {
          priorInterviews = data as PriorInterview[];
          console.log(`Loaded ${priorInterviews.length} prior interviews for context`);
        }
      } catch (err) {
        console.error('Failed to fetch prior interviews:', err);
      }
    }
    
    const instructions = isAegis 
      ? buildAegisInstructions(agent, priorInterviews)
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
