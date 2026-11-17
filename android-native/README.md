# Gameplay Live — Android screen streamer

Native shell that hosts the Next.js `/go-live` UI and encodes the phone screen → **YouTube RTMPS** with RootEncoder (zero server relay).

## Bridge (JS → Kotlin)

Injected as `window.AndroidStreamBridge`:

```js
AndroidStreamBridge.startStream(rtmpFullUrl, gamePackageName, resolution, micEnabled)
AndroidStreamBridge.stopStream()
AndroidStreamBridge.muteMic()
AndroidStreamBridge.unmuteMic()
AndroidStreamBridge.isNativeApp()
```

Game packages (auto-launch after MediaProjection consent):

| Game | Package |
|------|---------|
| BGMI | `com.pubg.imobile` |
| Free Fire MAX | `com.dts.freefiremax` |
| Minecraft | `com.mojang.minecraftpe` |
| Roblox | `com.roblox.client` |

## Flow

1. Web `/go-live` connects YouTube (Google OAuth) → gets RTMPS URL (keys never shown).
2. `startStream` opens `StreamPermissionActivity` (MediaProjection consent).
3. `ScreenStreamService` starts as `FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION`.
4. Floating **LIVE** bubble (overlay) + notification **Stop / Mute Mic**.
5. Selected game launches via `getLaunchIntentForPackage`.
6. Stop → `POST /api/streams/stop` + cleanup.

## Permissions

- `FOREGROUND_SERVICE_MEDIA_PROJECTION`
- `RECORD_AUDIO`
- `SYSTEM_ALERT_WINDOW` (floating bubble)
- `POST_NOTIFICATIONS` (Android 13+)

## Setup

1. Open `android-native/` in Android Studio.
2. Set `MainActivity.WEB_URL` / `API_BASE` to your deployed host.
3. Sync Gradle (JitPack for RootEncoder).
4. Build a debug APK and set `NEXT_PUBLIC_ANDROID_APK_URL` on the web app.
