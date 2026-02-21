import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawApiKey = Deno.env.get("FORTRESS_API_KEY") || "";

    // Keep only printable ASCII (0x21-0x7E)
    const FORTRESS_API_KEY = [...rawApiKey]
      .filter(c => {
        const code = c.charCodeAt(0);
        return code >= 0x21 && code <= 0x7E;
      })
      .join("");

    if (!FORTRESS_API_KEY) {
      throw new Error("FORTRESS_API_KEY is not configured");
    }

    // Parse optional query params from the request body
    let params: Record<string, string> = {};
    try {
      const body = await req.json();
      if (body) params = body;
    } catch {
      // No body is fine — defaults to recent feed
    }

    // Build query string; default to limit=50 (recent feed)
    const queryParams = new URLSearchParams();
    queryParams.set("limit", params.limit || "50");
    if (params.severity) queryParams.set("severity", params.severity);
    if (params.category) queryParams.set("category", params.category);
    if (params.status) queryParams.set("status", params.status);
    if (params.keyword_search) queryParams.set("keyword_search", params.keyword_search);

    const url = `https://udbjjeppbgwjlqmaeftn.supabase.co/functions/v1/api-v1-signals?${queryParams.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": FORTRESS_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Fortress Signals API error:", response.status, errorText);
      throw new Error(`Failed to fetch signals: ${response.status}`);
    }

    const apiResponse = await response.json();
    const signals = apiResponse.data || apiResponse;

    console.log(`Fetched ${Array.isArray(signals) ? signals.length : 0} signals from Fortress`);

    return new Response(
      JSON.stringify({ signals }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fetch Fortress signals error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
