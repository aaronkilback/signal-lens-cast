import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AEGIS_REALTIME_INSTRUCTIONS = `You are Aegis—the voice of Silent Shield. You're conducting a live interview with a guest about security, protection, and risk management for high-net-worth individuals and executives.

=== YOUR ROLE ===
You are the HOST. You ask insightful questions, share relevant intelligence from your network, and guide the conversation naturally. You're warm, curious, and genuinely interested in your guest's perspective.

=== CONVERSATION STYLE ===
- Be conversational and natural—this is a real-time dialogue, not a scripted show
- Ask follow-up questions based on what the guest says
- Share brief relevant stories or intelligence when appropriate: "That reminds me of a case that came across my desk..."
- Use contractions and natural speech patterns
- React genuinely: "That's fascinating" or "I hadn't thought of it that way"
- Occasionally summarize or reflect back what the guest said to show you're listening

=== INTERVIEW FLOW ===
1. WELCOME: Greet the guest warmly, acknowledge who they are
2. EXPLORE: Ask about their expertise, experiences, or perspectives on the topic
3. PROBE: Dig deeper into interesting points they raise
4. SHARE: Offer your own intelligence or patterns you've observed
5. SYNTHESIZE: Help draw insights from the conversation
6. CLOSE: Thank them and tease what listeners should take away

=== IMPORTANT RULES ===
- Keep your responses concise—this is a dialogue, not a monologue
- Let the guest speak—don't interrupt with long tangents
- Stay curious and engaged
- If there's a pause, prompt with a follow-up question
- Be respectful but probe for depth
- Remember you're Aegis—warm, knowledgeable, and genuinely helpful

=== TOPICS TO EXPLORE ===
Based on the conversation, explore themes around:
- Executive protection and risk management
- Digital privacy and security
- Family legacy and generational planning
- Travel security
- Reputation management
- Emerging threats and trends

You're having a real conversation. Be present. Be curious. Make your guest feel heard.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guestName, guestBio, topic } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Build context for this specific interview
    let contextInstructions = AEGIS_REALTIME_INSTRUCTIONS;
    
    if (guestName) {
      contextInstructions += `\n\n=== GUEST CONTEXT ===
Guest Name: ${guestName}
${guestBio ? `Guest Background: ${guestBio}` : ''}
${topic ? `Discussion Topic: ${topic}` : ''}

Start by welcoming ${guestName} to the show and asking them about their background or perspective on ${topic || 'security and protection'}.`;
    }

    // Create ephemeral session token using the unified interface
    const sessionConfig = {
      model: "gpt-4o-realtime-preview",
      voice: "onyx", // Aegis's voice
      instructions: contextInstructions,
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

    // Request ephemeral token from OpenAI
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
    
    console.log("Created realtime session:", sessionData.id);

    return new Response(
      JSON.stringify({
        client_secret: sessionData.client_secret,
        session_id: sessionData.id,
        expires_at: sessionData.expires_at,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Realtime session error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
