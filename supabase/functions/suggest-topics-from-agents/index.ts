/**
 * suggest-topics-from-agents
 *
 * Surfaces podcast-episode topic ideas from the Fortress agent fleet's
 * accumulated beliefs (~2,600 high-confidence hypotheses across 47 agents).
 *
 * For the Fortified Podcast this means: instead of "what should I cover this
 * week?", you get a ranked list of evidence-backed topics, each tagged with
 * the security specialty agent whose belief seeded it.
 *
 * How it works:
 *   1. Pulls high-confidence beliefs from podcast-relevant Fortress agents
 *      (protective intel, behavioral, cyber, financial, supply chain,
 *       counterterrorism, executive protection, OSINT, behavioral analysis).
 *   2. Asks an LLM to cluster, dedupe near-duplicates, and propose 10
 *      distinct podcast topics each citing the supporting beliefs.
 *   3. Returns structured JSON the UI can render as a "topics inbox".
 *
 * Body params (optional):
 *   - n: number of topics to return (default 10, max 20)
 *   - min_confidence: belief confidence floor (default 0.70)
 *   - days_back: only include beliefs updated in this window (default 30)
 *
 * Idempotent + read-only against agent_beliefs.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Agents whose specialty maps to "Fortified Podcast" subject matter.
// (Curated against the fleet audit on 2026-04-29 — these are the ~10 agents
// producing genuinely on-domain beliefs.)
const PODCAST_RELEVANT_AGENTS = [
  "GUARDIAN",        // protective intelligence, executive protection
  "MCGRAW",          // behavioral psychology, threat actor profiling
  "AUREUS-GUARD",    // UHNW asset protection
  "VECTOR",          // attack-vector analysis, cyber
  "ECHO-WATCH",      // influence operations, social engineering
  "INSIDE-EYE",      // counterintelligence, insider threat
  "CHAIN-WATCH",     // supply chain
  "WRAITH",          // red team, physical penetration testing
  "CERBERUS",        // financial crime, AML
  "FININT",          // financial intelligence
  "SHERLOCK",        // investigative deduction
  "MCM-ICS",         // mass casualty / incident command
  "VERIDIAN-TANGO",  // counterterrorism, energy infra
  "ORACLE",          // predictive forecasting
  "JOCKO",           // leadership doctrine
  "LEX-MAGNA",       // legal intelligence (BC/AB)
  "AEGIS-CMD",       // commander synthesis
];

const SUGGESTER_PROMPT = `You are a podcast development editor for "The Fortified Podcast" — a security and protective intelligence show for executives, founders, and HNW individuals.

You're being given a list of analytical beliefs from a fleet of specialty intelligence agents. Each belief is a concrete pattern an agent has identified from sustained observation. Your job: turn these into 10 distinct, compelling podcast topic angles.

For each topic:
- Title: punchy, episode-ready (e.g. "When Outliers Start Forming a Pattern", "The Death of Privacy and the Rise of Digital Sovereignty")
- One-sentence angle: what's the listener walking away with?
- Why-now: what makes this timely vs. evergreen?
- Primary agent: the specialty agent whose belief most underpins this topic
- Supporting belief indices: cite 1-3 beliefs from the list (by their bracket numbers)

CRITICAL:
- DEDUPE near-duplicate beliefs before clustering (e.g. multiple agents saying similar things about social engineering becomes ONE topic, not several).
- Each of the 10 topics must be SUBSTANTIVELY DISTINCT — no thinly-rephrased variations.
- Avoid generic topics ("the importance of preparation"). Anchor on the specific phenomenon the belief describes.
- Skip beliefs that are too narrow or too operational to make a 6-10 minute episode.

Respond with strict JSON:
{
  "topics": [
    {
      "title": "...",
      "angle": "...",
      "why_now": "...",
      "primary_agent": "GUARDIAN",
      "supporting_belief_indices": [3, 17],
      "estimated_minutes": 7
    }
    // ... 10 total
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!supaUrl || !supaKey) {
    return new Response(JSON.stringify({ error: "Supabase env not available" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const n = Math.min(Math.max(parseInt(String(body.n || 10), 10), 1), 20);
    const minConfidence = Math.max(0, Math.min(1, parseFloat(String(body.min_confidence || 0.70))));
    const daysBack = Math.max(1, Math.min(365, parseInt(String(body.days_back || 30), 10)));

    const supabase = createClient(supaUrl, supaKey);
    const sinceISO = new Date(Date.now() - daysBack * 86400000).toISOString();

    const { data: beliefs, error: bErr } = await supabase
      .from("agent_beliefs")
      .select("hypothesis, confidence, agent_call_sign, last_updated_at, belief_type")
      .in("agent_call_sign", PODCAST_RELEVANT_AGENTS)
      .gte("confidence", minConfidence)
      .gte("last_updated_at", sinceISO)
      .eq("is_active", true)
      .order("confidence", { ascending: false })
      .order("last_updated_at", { ascending: false })
      .limit(80);

    if (bErr) {
      return new Response(JSON.stringify({ error: `belief query failed: ${bErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!beliefs || beliefs.length === 0) {
      return new Response(JSON.stringify({
        topics: [],
        diagnostic: { beliefs_found: 0, min_confidence: minConfidence, days_back: daysBack, agents_polled: PODCAST_RELEVANT_AGENTS.length },
        message: "No beliefs found above the confidence floor in the requested window. Try lowering min_confidence or expanding days_back.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Format beliefs as a numbered list for the LLM to cite back.
    const beliefList = beliefs.map((b, i) => {
      const agent = b.agent_call_sign;
      const conf = Math.round((b.confidence ?? 0) * 100);
      return `[${i + 1}] [${agent} | ${conf}% conf] ${b.hypothesis}`;
    }).join("\n");

    const userMessage = `Here are ${beliefs.length} active beliefs from the security agent fleet (last ${daysBack} days, confidence ≥ ${Math.round(minConfidence * 100)}%):

${beliefList}

Produce ${n} distinct podcast topic suggestions per the JSON schema in the system prompt.`;

    const llmResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: SUGGESTER_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!llmResp.ok) {
      const txt = await llmResp.text().catch(() => "<unreadable>");
      return new Response(JSON.stringify({ error: `LLM ${llmResp.status}: ${txt.slice(0, 400)}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const llmJson = await llmResp.json();
    const content = llmJson?.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      // try to extract JSON block if wrapped in markdown fence
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { topics: [] };
    }

    // Resolve supporting_belief_indices to actual hypothesis text for the UI.
    const topics = (parsed.topics || []).map((t: any) => {
      const idxs: number[] = Array.isArray(t.supporting_belief_indices) ? t.supporting_belief_indices : [];
      const supporting = idxs
        .filter(i => i >= 1 && i <= beliefs.length)
        .map(i => ({
          index: i,
          agent: beliefs[i - 1].agent_call_sign,
          confidence: beliefs[i - 1].confidence,
          hypothesis: beliefs[i - 1].hypothesis,
        }));
      return { ...t, supporting };
    });

    return new Response(JSON.stringify({
      topics,
      diagnostic: {
        beliefs_considered: beliefs.length,
        min_confidence: minConfidence,
        days_back: daysBack,
        agents_polled: PODCAST_RELEVANT_AGENTS.length,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
