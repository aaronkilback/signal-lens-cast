# Fortified Podcast — Production Studio

The internal production studio behind the **Fortified Podcast** by Silent Shield. Generates AEGIS-narrated scripts, episode metadata, transcripts, captions, audio, and marketing assets.

Live: https://podcast.silentshieldsecurity.com

## What it does

- **Generate Script** — produces full episode scripts from a topic, in the AEGIS narrator voice. Backed by `supabase/functions/generate-script` and the host signoff rotation.
- **Episode metadata extraction** — title, summary, chapters, and show-notes from a script or transcript.
- **Audio + captions** — TTS audio rendering and SRT/VTT caption generation.
- **Marketing assets** — short-form clips, social copy, pull-quotes.
- **Guest research + episode topics** — pre-production research and topic suggestions.
- **Library** — episode catalog with search, filter, and per-episode learning history.

## Stack

- Vite + React + TypeScript + shadcn-ui + Tailwind
- Hosted on Cloudflare Pages
- Auth, database, edge functions: Supabase (project `kpuqukppbmwebiptqmog`)

## Local development

```sh
git clone https://github.com/aaronkilback/signal-lens-cast.git
cd signal-lens-cast
npm install
npm run dev
```

Requires Node 20+.

## Deployment

Pushes to `main` auto-deploy to Cloudflare Pages (rebuilds the static bundle and uploads it as the `signal-lens-cast` Worker, which serves `podcast.silentshieldsecurity.com`).

Edge functions deploy via the Supabase CLI:

```sh
supabase functions deploy <name> --project-ref kpuqukppbmwebiptqmog
```

## Repository structure

- `src/` — React app (pages, components, hooks)
- `supabase/functions/` — edge functions (generate-script, generate-audio, etc.)
- `supabase/migrations/` — database schema migrations
- `public/` — static assets

## Notes

This codebase was originally scaffolded with Lovable. It has since been adopted into the Silent Shield production stack and now lives independently. Episodes, host signoff rotation, learnings, and marketing assets all live in the shared Silent Shield Supabase project.
