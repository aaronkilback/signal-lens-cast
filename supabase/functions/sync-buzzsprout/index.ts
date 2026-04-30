/**
 * sync-buzzsprout
 *
 * Pulls the canonical episode list from Buzzsprout's PUBLIC RSS feed and
 * upserts into the episodes table by episode_number. RSS is preferred over
 * the API because it works on every plan including free tier — no API token
 * required.
 *
 * Required Supabase function secrets:
 *   - BUZZSPROUT_PODCAST_ID    — the numeric ID (e.g. 2524334).
 *                                  Feed URL: feeds.buzzsprout.com/{ID}.rss
 *   - BUZZSPROUT_OWNER_USER_ID — UUID of the auth.users row that "owns" the
 *                                  podcast (episodes.user_id is NOT NULL).
 *
 * Idempotent. Re-running just refreshes audio_url and updated_at; never
 * overwrites a non-null script_content (so locally-generated drafts are safe).
 *
 * Episodes that have been deleted from Buzzsprout's free-tier hosting (older
 * than 90 days) won't appear in the feed — those rows stay as-is in the DB.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_AUDIENCE = "Executives and HNW individuals concerned with personal security";

function inferEpisodeNumberFromTitle(title: string): number | null {
  const m = title.match(/\b(?:Ep(?:isode)?\.?\s*)(\d{1,4})\b/i);
  return m ? parseInt(m[1], 10) : null;
}

function cleanTitle(title: string): string {
  return title.replace(/^\s*Ep(?:isode)?\.?\s*\d{1,4}\s*[-—:]\s*/i, "").trim();
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripCdata(s: string): string {
  const m = s.match(/^\s*<!\[CDATA\[(.*)\]\]>\s*$/s);
  return m ? m[1] : s;
}

type ParsedEp = {
  title: string;
  episode_number: number | null;
  duration_seconds: number | null;
  audio_url: string | null;
  pub_date: string | null;
  summary: string | null;
};

function parseRssEpisodes(xml: string): ParsedEp[] {
  const out: ParsedEp[] = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of itemBlocks) {
    const titleM = block.match(/<itunes:title>([\s\S]*?)<\/itunes:title>/) || block.match(/<title>([\s\S]*?)<\/title>/);
    const epM = block.match(/<itunes:episode>(\d+)<\/itunes:episode>/);
    const durM = block.match(/<itunes:duration>(\d+)<\/itunes:duration>/);
    const audioM = block.match(/<enclosure[^>]*\burl="([^"]+)"/);
    const pubM = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sumM = block.match(/<itunes:summary>([\s\S]*?)<\/itunes:summary>/) || block.match(/<description>([\s\S]*?)<\/description>/);

    const rawTitle = titleM ? decodeXmlEntities(stripCdata(titleM[1]).trim()) : "";
    if (!rawTitle) continue;

    out.push({
      title: rawTitle,
      episode_number: epM ? parseInt(epM[1], 10) : inferEpisodeNumberFromTitle(rawTitle),
      duration_seconds: durM ? parseInt(durM[1], 10) : null,
      audio_url: audioM ? audioM[1] : null,
      pub_date: pubM ? pubM[1].trim() : null,
      summary: sumM ? decodeXmlEntities(stripCdata(sumM[1]).trim()).slice(0, 4000) : null,
    });
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const podcastId = Deno.env.get("BUZZSPROUT_PODCAST_ID");
  const ownerId = Deno.env.get("BUZZSPROUT_OWNER_USER_ID");
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!podcastId || !ownerId) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "Missing BUZZSPROUT_PODCAST_ID or BUZZSPROUT_OWNER_USER_ID" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!supaUrl || !supaKey) {
    return new Response(
      JSON.stringify({ error: "Function env missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(supaUrl, supaKey);

    const feedUrl = `https://feeds.buzzsprout.com/${podcastId}.rss`;
    const resp = await fetch(feedUrl, { headers: { "User-Agent": "fortified-podcast-sync/1.0" } });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "<unreadable>");
      return new Response(
        JSON.stringify({ error: `Buzzsprout RSS ${resp.status}: ${txt.slice(0, 400)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const xml = await resp.text();
    const eps = parseRssEpisodes(xml);

    let inserted = 0, updated = 0, skipped = 0;
    const errors: string[] = [];

    for (const ep of eps) {
      if (!ep.episode_number) { skipped++; continue; }
      const cleanedTitle = cleanTitle(ep.title);
      const minutes = ep.duration_seconds ? Math.max(1, Math.round(ep.duration_seconds / 60)) : 5;
      const publishedAt = ep.pub_date ? new Date(ep.pub_date).toISOString() : new Date().toISOString();

      const { data: existing } = await supabase
        .from("episodes")
        .select("id, script_content, audio_url, episode_summary, title")
        .eq("episode_number", ep.episode_number)
        .eq("user_id", ownerId)
        .maybeSingle();

      if (existing) {
        // Patch only fields where Buzzsprout has new info; never clobber script_content.
        const patch: Record<string, unknown> = {
          status: "completed",
          updated_at: new Date().toISOString(),
        };
        if (ep.audio_url) patch.audio_url = ep.audio_url;
        if (ep.summary && (!existing.episode_summary || existing.episode_summary.length < 50)) {
          patch.episode_summary = ep.summary;
        }
        const { error: updErr } = await supabase
          .from("episodes")
          .update(patch)
          .eq("id", existing.id);
        if (updErr) errors.push(`Ep ${ep.episode_number}: update: ${updErr.message}`);
        else updated++;
      } else {
        const { error: insErr } = await supabase
          .from("episodes")
          .insert({
            user_id: ownerId,
            episode_number: ep.episode_number,
            title: cleanedTitle,
            topic: cleanedTitle,
            target_audience: DEFAULT_AUDIENCE,
            status: "completed",
            content_length: minutes,
            output_mode: "podcast_script",
            audio_url: ep.audio_url,
            episode_summary: ep.summary,
            created_at: publishedAt,
          });
        if (insErr) errors.push(`Ep ${ep.episode_number}: insert: ${insErr.message}`);
        else inserted++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        feed_url: feedUrl,
        rss_episodes: eps.length,
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
