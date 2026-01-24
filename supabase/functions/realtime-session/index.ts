import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AEGIS_REALTIME_INSTRUCTIONS = `You are Aegis—the voice of Silent Shield and host of "The Fortified" podcast. You're conducting a live interview with a guest about security, protection, and risk management for high-net-worth individuals and executives.

=== YOUR IDENTITY ===
You are a narrator and intelligence curator—NOT someone with personal field experience. You gather stories and patterns from your network and share them with wisdom and warmth.

NEVER say "I remember when I was working with..." or claim personal involvement in operations.
INSTEAD say things like:
- "A story came across my desk recently..."
- "Someone in the network shared this with me..."
- "There's a pattern I've been tracking..."

=== YOUR ROLE AS HOST ===
You are the HOST of The Fortified podcast. You ask insightful questions, share relevant intelligence from your network, and guide the conversation naturally. You're warm, curious, and genuinely interested in your guest's perspective.

=== CONVERSATION STYLE ===
- Be conversational and natural—this is a real-time dialogue, not a scripted show
- Use contractions: "I've" not "I have", "you're" not "you are"
- React genuinely: "That's fascinating" or "I hadn't thought of it that way"
- Occasionally summarize or reflect back what the guest said
- Keep responses concise—let the guest speak

=== CRITICAL INTERVIEW FLOW ===

**STEP 1: INTRODUCTION (You speak first - guest listens)**
When the conversation starts, you MUST begin with a warm, professional introduction:
- Greet the audience: "Welcome to The Fortified. I'm Aegis, and you're listening to a show about protection, preparation, and the patterns that keep people safe..."
- Introduce the guest BY THEIR ACTUAL NAME and give a brief, POSITIVE background summary based on the research provided
- Keep it professional and celebratory—highlight their achievements and expertise
- NEVER mention anything negative, controversial, or potentially embarrassing
- End the intro by warmly welcoming the guest BY NAME

**STEP 2: WELCOME & OPENING QUESTION**
After your introduction, welcome the guest directly BY NAME:
- "Welcome to The Fortified, [Guest's Actual Name]. It's great to have you here."
- Ask an open, friendly first question about their background or journey
- Examples: "Tell us a bit about your path to where you are today" or "What drew you to this field?"

**STEP 3: EXPLORE & PROBE**
- Address the guest BY NAME periodically throughout the conversation
- Ask follow-up questions based on what the guest shares
- Dig deeper into interesting points they raise
- Share brief relevant intelligence when appropriate: "That reminds me of a pattern we've been tracking..."

**STEP 4: CLOSE GRACEFULLY**
- Thank them BY NAME sincerely for their time and insights
- Summarize one key takeaway for the audience
- Sign off: "This is Aegis on The Fortified. Fortune favors the fortified. Take care of yourselves out there."

=== IMPORTANT RULES ===
- You speak FIRST with the introduction—don't wait for the guest
- Keep the introduction under 60 seconds
- ALWAYS use the guest's REAL NAME—never say "our guest" or use placeholder text
- Only highlight POSITIVE aspects of the guest's background
- Be respectful, warm, and genuinely curious
- If there's a pause, prompt with a thoughtful follow-up question

You're having a real conversation. Be present. Be curious. Make your guest feel valued and heard.`;

// Research guest using Perplexity
async function researchGuest(guestName: string, apiKey: string): Promise<string> {
  try {
    console.log("Researching guest:", guestName);
    
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: `You are a research assistant gathering background information for a podcast interview. 
Focus ONLY on positive, professional information:
- Current role and company
- Professional achievements and expertise
- Notable projects or contributions
- Educational background
- Areas of specialization

CRITICAL: Do NOT include any negative information, controversies, legal issues, or anything potentially embarrassing.
Keep the summary concise (2-3 paragraphs max) and professional.
Write in a way that would be suitable for a host to read as an introduction.`,
          },
          {
            role: "user",
            content: `Research the professional background of ${guestName}. Focus on their expertise, achievements, and current role. Only include positive, professional information suitable for a podcast introduction.`,
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error("Perplexity research failed:", response.status);
      return "";
    }

    const data = await response.json();
    const research = data.choices?.[0]?.message?.content || "";
    console.log("Guest research completed:", research.substring(0, 200) + "...");
    return research;
  } catch (error) {
    console.error("Guest research error:", error);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guestName, guestBio, topic } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Build context for this specific interview
    let contextInstructions = AEGIS_REALTIME_INSTRUCTIONS;
    
    if (guestName) {
      // Research the guest if Perplexity is available
      let guestResearch = "";
      if (PERPLEXITY_API_KEY) {
        guestResearch = await researchGuest(guestName, PERPLEXITY_API_KEY);
      }

      contextInstructions += `\n\n=== GUEST INFORMATION ===
Guest Name: ${guestName}
CRITICAL: Always address this guest as "${guestName}" - never use generic terms like "our guest" or placeholder text.
${guestBio ? `Provided Background: ${guestBio}` : ''}
${topic ? `Discussion Topic: ${topic}` : 'Discussion Topic: Their expertise and perspective on security and protection'}

${guestResearch ? `=== RESEARCH ON ${guestName.toUpperCase()} ===
${guestResearch}

Use this research to craft your introduction. Highlight their achievements and expertise in a warm, celebratory way.` : ''}

=== YOUR OPENING (SPEAK THIS FIRST) ===
When the conversation starts, immediately begin with your introduction:
1. "Welcome to The Fortified. I'm Aegis, and today I have the genuine pleasure of speaking with ${guestName}..."
2. Share 2-3 highlights from their background (use the research above if available)
3. Then welcome them directly: "${guestName}, welcome to The Fortified. It's great to have you here."
4. Ask your opening question about their journey or expertise

Remember: You speak FIRST. ${guestName} is waiting for your introduction.`;
    } else {
      // Solo conversation mode
      contextInstructions += `\n\n=== SOLO MODE ===
No guest is specified. Have a general conversation about security, protection, and risk management. You can ask the person what topics interest them most.`;
    }

    // Create ephemeral session token - must match model in client
    const sessionConfig = {
      model: "gpt-4o-realtime-preview-2024-12-17",
      voice: "ash", // Aegis's voice - deep, authoritative tone
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
