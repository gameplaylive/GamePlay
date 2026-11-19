# GamePlay Live

Free global gaming hub — browse live streams, go live to YouTube (mobile / OBS), Squad Finder with 1-tap join, My Gamers, tournaments, and push digests. No paid tiers.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS v4
- Supabase (Auth Google-only, Postgres, Realtime chat)
- Deployed on **Cloudflare Workers** via `@opennextjs/cloudflare`
- Firebase Cloud Messaging (HTTP v1)
- Android WebView shell + AdMob (`android-native/`)
- PWA manifest (`public/manifest.json`)

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Google sign-in falls back to **demo** when Supabase env vars are missing.

## Connect Supabase + Google login

1. Create a Supabase project and fill `.env.local` (see `.env.example`).
2. Run `supabase/schema.sql` (or migrations under `supabase/migrations/`) in the SQL Editor.
3. Google Cloud → OAuth **Web** client → Authorized redirect URI:
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
4. Supabase → **Authentication → Providers → Google** → enable → paste Client ID + Secret.
5. Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://gameplaylive.live`
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://gameplaylive.live/auth/callback`
6. Platform admin is automatic for `ADMIN_EMAIL` (`role=admin`).

## Admin

`/admin` (role = admin): Live sync, tournaments, squads overview, push blasts, analytics, ad earnings, users, games, API vault (YouTube / Twitch / AdSense / AdMob).

## Deploy (Cloudflare Workers)

**Live:** https://gameplaylive.live · Worker: https://gameplay-live.gameplaylive.workers.dev

```bash
npx wrangler login
npm run deploy
```

Secrets via `npx wrangler secret put` / bulk from `.env.local`. Crons in `wrangler.jsonc`: YouTube 20m, Twitch 3m, trending 6h, favorites + reminders 10m, push digest hourly (`5 * * * *`).

## Play Store (Android)

1. Open `android-native/` in Android Studio (`applicationId` = `app.gameplaylive`, targetSdk **36**).
2. Confirm AdMob App ID + banner unit in Manifest / `strings.xml`, and GDPR message in AdMob Privacy & messaging (UMP).
3. Upload keystore: `~/Documents/GamePlayLive-signing/` + gitignored `android-native/keystore.properties`.
4. Build signed release AAB → upload to Play Console (enable Play App Signing).
5. Copy **App signing key** SHA-256 from Play Console into `public/.well-known/assetlinks.json` (upload-key SHA is already there for local/sideload).
6. Privacy Policy: https://gameplaylive.live/privacy-policy

## Favorite limits

All signed-in users: **15** My Gamers slots (shared free cap).
