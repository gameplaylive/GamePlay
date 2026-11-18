# Gameplay Live — Android screen streamer

Native shell that hosts the Next.js UI, encodes the phone screen → **YouTube RTMPS** with RootEncoder, and shows **AdMob** banners for free users.

## Ads: AdSense (web) vs AdMob (this APK)

| Surface | Network |
|---------|---------|
| Chrome / laptop / mobile browser / PWA | **AdSense** (`AdBanner.tsx`) |
| This Android WebView app | **AdMob** sticky banner under the WebView |

AdSense is **not** loaded inside the WebView (policy). The web app calls `AndroidStreamBridge.setBannerAdsEnabled(true|false)` so Pro users and “ads off” hide the AdMob banner.

### AdMob setup (before Play Store)

1. Create an app + **Banner** ad unit in [AdMob](https://admob.google.com/).
2. Paste the same IDs into **Admin → API Vault** (`ADMOB_APP_ID`, `ADMOB_BANNER_UNIT_ID`) for ops tracking.
3. Replace the **sample** App ID in `AndroidManifest.xml`:
   - `com.google.android.gms.ads.APPLICATION_ID` → `ca-app-pub-xxxxxxxx~yyyyyyyyyy`
4. Replace the **sample** banner unit in `res/values/strings.xml`:
   - `admob_banner_unit_id` → `ca-app-pub-xxxxxxxx/yyyyyyyyyy`
5. Keep Google’s sample IDs while developing (they always fill with test ads).

## Bridge (JS → Kotlin)

Injected as `window.AndroidStreamBridge`:

```js
AndroidStreamBridge.startStream(rtmpFullUrl, gamePackageName, resolution, micEnabled)
AndroidStreamBridge.stopStream()
AndroidStreamBridge.muteMic()
AndroidStreamBridge.unmuteMic()
AndroidStreamBridge.isNativeApp()
AndroidStreamBridge.setBannerAdsEnabled(true) // free users; false for Pro
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
- `AD_ID` (AdMob)

## Setup

1. Open `android-native/` in Android Studio.
2. Set `MainActivity.WEB_URL` / `API_BASE` to your deployed host.
3. Sync Gradle (JitPack for RootEncoder + Google Play services ads).
4. Build a debug APK and set `NEXT_PUBLIC_ANDROID_APK_URL` on the web app.
