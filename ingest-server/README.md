# GamePlay Live RTMP ingest (OBS / Streamlabs)

When a Pro creator pastes their key into OBS and goes live, nginx-rtmp:

1. Accepts the RTMP publish on `rtmp://live.gameplaylive.com/app/<stream_key>`
2. Calls `POST /api/streams/ingest` with `call=publish&name=<stream_key>`
3. Next.js flips `community_live_streams.is_live = true` → homepage spotlight
4. Serves HLS at `https://live.gameplaylive.com/hls/<stream_key>/index.m3u8`
5. On disconnect → `publish_done` → `is_live = false`

## Quick start

```bash
export WEBHOOK_URL=https://YOUR_APP_DOMAIN/api/streams/ingest
export INGEST_WEBHOOK_SECRET=same-as-nextjs-env
docker compose up -d
```

Edit `nginx.conf` `on_publish` / `on_publish_done` URLs to match `WEBHOOK_URL` (include `?secret=...` if you cannot set Authorization headers from nginx-rtmp).

Example with secret query:

```
on_publish http://your-app/api/streams/ingest?secret=YOUR_SECRET;
on_publish_done http://your-app/api/streams/ingest?secret=YOUR_SECRET;
```

## Next.js env

```
NEXT_PUBLIC_RTMP_INGEST_URL=rtmp://live.gameplaylive.com/app
NEXT_PUBLIC_HLS_PLAYBACK_BASE=https://live.gameplaylive.com/hls
INGEST_WEBHOOK_SECRET=YOUR_SECRET
```
