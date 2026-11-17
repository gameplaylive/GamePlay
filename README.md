# GamePlay Live

Mobile-first gaming streams PWA — browse **Live Now**, **Trending & Popular**, and **My Favorites** from YouTube & Twitch, watch in official embeds, share in one tap, and upgrade to Pro for ad-free + 2×2 multi-view + **direct-to-YouTube mobile screen streaming** (`/go-live`).

## Stack

- Next.js App Router + TypeScript + Tailwind CSS v4
- Supabase (Auth Google-only, Postgres, Realtime chat)
- Stripe subscriptions
- PWA manifest (`public/manifest.json`)

## Quick start (UI works before Supabase)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Continue with Google** falls back to **demo** when env vars are missing.

## Connect Supabase later

1. Create a Supabase project.
2. Copy `.env.example` → `.env.local` and fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Run `supabase/schema.sql` in the SQL Editor.
4. Enable **Google** provider in Authentication → Providers.
5. Add redirect URL: `https://YOUR_DOMAIN/auth/callback` (and `http://localhost:3000/auth/callback`).
6. Promote yourself: `update profiles set role = 'admin' where email = 'you@gmail.com';`

## Admin vault

`/admin` (role = admin): Overview KPIs, pricing → Stripe Price, user management, game directory, API keys (YouTube / Twitch / Stripe / AdSense).

Cron (Vercel): `vercel.json` hits `/api/sync-streams` every 15m and `/api/sync-trending` every 20m. Set `CRON_SECRET` and pass `Authorization: Bearer …`.

## Discovery quota (Top 10 + Favorites)

Default games only: **BGMI, Free Fire, Valorant, GTA V, Minecraft, Roblox, CS2, Dota 2, Fortnite, Call of Duty**.

| Job | Schedule | Cost |
|-----|----------|------|
| YouTube live `search.list` (1 broad query, classify into 10 locally) | every 20m (~72/day) | 100 units/call |
| Twitch `/helix/streams` batched top-10 `game_id`s (COD includes Warzone/CODM) | every 3m | free |
| Pinned YT `playlistItems` + `videos.list` | every 10m | ~1–2 units/chunk |
| Pinned Twitch `/helix/streams` batch | every 3m | free |

Favorite search: cache → `@handle`/`channels.list` (1u) → `search.list` only if `search_calls_today < 95`. Limits: Free **5**, Pro **15**.

Migration: `supabase/migrations/20261117_quota_favorites_discovery.sql`

## Go Live (Pro · Mobile + PC/OBS)

- Web studio: `/go-live` — toggle **Mobile Phone** vs **PC (OBS Studio)**
- Mobile: Android native encoder → YouTube RTMPS (`android-native/`)
- PC: unique RTMP ingest + stream key → `ingest-server/` (nginx-rtmp) → webhook `/api/streams/ingest` sets `community_live_streams.is_live`
- Migrations: `20261117_community_live_streams.sql`, `20261117_pc_obs_ingest.sql`
- Homepage row: **Live Gameplay Live Creators**

Env: `NEXT_PUBLIC_RTMP_INGEST_URL`, `NEXT_PUBLIC_HLS_PLAYBACK_BASE`, `INGEST_WEBHOOK_SECRET`

In Google Cloud / Supabase Auth, add OAuth scope `https://www.googleapis.com/auth/youtube` for one-tap mobile broadcast creation.

## Legal / App Store

- `/privacy` · `/terms` · `/refunds` · `/contact`
- Footer links on every page

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run start` — serve build
