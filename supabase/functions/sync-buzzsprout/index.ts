/**
 * sync-buzzsprout
 *
 * Pulls the canonical episode list from Buzzsprout and upserts into the
 * episodes table by episode_number. Run on a cron (e.g. daily) or manually.
 * Idempotent — re-running just touches updated_at on rows whose Buzzsprout
 * metadata didn't change.
 *
 * Required Supabase function secrets:
 *   - BUZZSPROUT_API_TOKEN  — from buzzsprout.com → My Podcasts → API
 *   - BUZZSPROUT_PODCAST_ID — numeric ID from the same page
 *   - BUZZSPROUT_OWNER_USER_ID — UUID of the auth.users row that "owns"
 *                                 the podcast (episodes.user_id is NOT NULL).
 *
 * Off by default. Returns skipped=true unless all three secrets are set.
 *
 * Buzzsprout API: https://github.com/Buzzsprout/buzzsprout-api
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_AUDIENCE = "Executives and HNW individuals concerned with personal security";

type BuzzsproutEpisode = {
  id: number;
  title: string;
  audio_url?: string;
  artwork_url?: string;
  description?: string;
  summary?: string;
  episode_number?: number;
  published_at?: string;
  duration?: number;
};

function inferEpisodeNumberFromTitle(title: string): number | null {
  const m = title.match(/\b(?:Ep(?:isode)?\.?\s*)(\d{1,4})\b/i);
  return m ? parseInt(m[1], 10) : null;
}

function cleanTitle(title: string): string {
  return title.replace(/^\s*Ep(?:isode)?\.?\s*\d{1,4}\s*[-—:]\s*/i, "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiToken = Deno.env.get("BUZZSPROUT_API_TOKEN");
  const podcastId = Deno.env.get("BUZZSPROUT_PODCAST_ID");
  const ownerId = Deno.env.get("BUZZSPROUT_OWNER_USER_ID");
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!apiToken || !podcastId || !ownerId) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "Missing one or more secrets: BUZZSPROUT_API_TOKEN, BUZZSPROUT_PODCAST_ID, BUZZSPROUT_OWNER_USER_ID" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!supaUrl || !supaKey) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not available in function env" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(supaUrl, supaKey);

    const url = `https://www.buzzsprout.com/api/${podcastId}/episodes.json?api_token=${apiToken}`;
    const resp = await fetch(url, { headers: { "User-Agent": "fortified-podcast-sync/1.0" } });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "<unreadable>");
      return new Response(
        JSON.stringify({ error: `Buzzsprout API ${resp.status}: ${txt.slice(0, 400)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eps = (await resp.json()) as BuzzsproutEpisode[];
    if (!Array.isArray(eps)) {
      return new Response(
        JSON.stringify({ error: "Buzzsprout returned non-array payload" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let inserted = 0, updated = 0, skipped = 0;
    const errors: string[] = [];

    for (const ep of eps) {
      const epNum = ep.episode_number ?? inferEpisodeNumberFromTitle(ep.title);
      if (!epNum) { skipped++; continue; }
      const title = cleanTitle(ep.title);
      const minutes = ep.duration ? Math.max(1, Math.round(ep.duration / 60)) : 5;
      const publishedAt = ep.published_at ?? new Date().toISOString();

      const { data: existing } = await supabase
        .from("episodes")
        .select("id, script_content, audio_url, title")
        .eq("episode_number", epNum)
        .eq("user_id", ownerId)
        .maybeSingle();

      if (existing) {
        const patch: Record<string, unknown> = {
          audio_url: ep.audio_url ?? existing.audio_url ?? null,
          status: "published",
          updated_at: new Date().toISOString(),
        };
        if (!existing.title || existing.title.length < 5) patch.title = title;
        const { error: updErr } = await supabase
          .from("episodes")
          .update(patch)
          .eq("id", existing.id);
        if (updErr) errors.push(`Ep ${epNum}: update: ${updErr.message}`);
        else updated++;
      } else {
        const { error: insErr } = await supabase
          .from("episodes")
          .insert({
            user_id: ownerId,
            episode_number: epNum,
            title,
            topic: title,
            target_audience: DEFAULT_AUDIENCE,
            status: "published",
            content_length: minutes,
            output_mode: "podcast_script",
            audio_url: ep.audio_url ?? null,
            episode_summary: ep.summary ?? ep.description ?? null,
            created_at: publishedAt,
          });
        if (insErr) errors.push(`Ep ${epNum}: insert: ${insErr.message}`);
        else inserted++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        buzzsprout_episodes_seen: eps.length,
        inserted,
        updated,
        skipped,
        errors_count: errors.length,
        errors_sample: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
