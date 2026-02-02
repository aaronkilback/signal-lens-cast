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
  voiceId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FORTRESS_API_KEY = Deno.env.get("FORTRESS_API_KEY");

    if (!FORTRESS_API_KEY) {
      throw new Error("FORTRESS_API_KEY is not configured");
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
