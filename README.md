# GamePlay Live

Creator-first gaming hub — browse live streams, go live to YouTube (mobile / OBS), run tournament ops, and unlock **Creator Pro** (₹99/mo via Cashfree) for Go Live Studio, 15 Favorite slots, Squad Finder unlimited posts, and Discord alerts.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS v4
- Supabase (Auth Google-only, Postgres, Realtime chat)
- Cashfree subscriptions (India, ₹99/mo)
- PWA manifest (`public/manifest.json`)

## Quick start (UI works before Supabase)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Continue with Google** falls back to **demo** when env vars are missing.

## Connect Supabase + Google login

1. Create a Supabase project and fill `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, anon key, service role).
2. Run `supabase/schema.sql` (or later migrations) in the SQL Editor.
3. Google Cloud → OAuth **Web** client → Authorized redirect URI:
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
4. Supabase → **Authentication → Providers → Google** → enable → paste **Client ID** + **Client Secret** from that Web client.
5. Supabase → **Authentication → URL Configuration**:
   - Site URL: your live domain (or `http://localhost:3000`)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://YOUR_DOMAIN/auth/callback`
6. Platform admin is automatic for `gameliveapp@gmail.com` (`role=admin`). Every other Google account signs in as a normal `user`.

## Admin vault

`/admin` (role = admin): Overview KPIs, pricing (INR), user management, game directory, API vault (YouTube / Twitch / **Cashfree** / AdSense / **AdMob**).

Pro checkout uses **Cashfree** (`/api/cashfree/checkout` + `/api/cashfree/webhook`). Point Cashfree webhooks at `https://YOUR_DOMAIN/api/cashfree/webhook`.

Cron (**Netlify**, production host): scheduled functions in `netlify/functions/` call the app routes on a timer (YouTube live every **20m**, Twitch every 3m, trending every 6h). Set `CRON_SECRET` in Netlify env. `vercel.json` is optional leftover and is **not** used on Netlify.

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
