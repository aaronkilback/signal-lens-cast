import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // Must include all headers the browser may send when invoking this function
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FortressAgent {
  id: string;
  name: string;
  codename: string;
  expertise: string[];
  description: string;
  voiceId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Sanitize because Deno rejects header values containing newlines or non-ByteString chars
    const rawApiKey = Deno.env.get("FORTRESS_API_KEY");
    const FORTRESS_API_KEY = rawApiKey
      ?.normalize("NFKC")
      .replace(/\r?\n/g, "")
      // Remove control chars + any non-ASCII that may be accidentally pasted (e.g. zero-width spaces)
      .replace(/[^\x20-\x7E]/g, "")
      .trim();

    if (!FORTRESS_API_KEY) {
      throw new Error("FORTRESS_API_KEY is not configured");
    }

    if (rawApiKey && rawApiKey.length !== FORTRESS_API_KEY.length) {
      console.log(
        `FORTRESS_API_KEY sanitized (rawLen=${rawApiKey.length}, sanitizedLen=${FORTRESS_API_KEY.length})`,
      );
    }

    // Fetch agents from Fortress API
    const response = await fetch("https://udbjjeppbgwjlqmaeftn.supabase.co/functions/v1/api-v1-agents", {
      method: "GET",
      headers: {
        "x-api-key": FORTRESS_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Fortress API error:", response.status, errorText);
      throw new Error(`Failed to fetch agents: ${response.status}`);
    }

    const agents: FortressAgent[] = await response.json();
    
    console.log(`Fetched ${agents.length} agents from Fortress`);

    return new Response(
      JSON.stringify({ agents }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Fetch Fortress agents error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
