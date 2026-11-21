# Gameplay Live — Android screen streamer

Native shell that hosts the Next.js UI, encodes the phone screen → **YouTube RTMPS** with RootEncoder, and shows **AdMob** banners for free users.

## Ads: AdSense (web) vs AdMob (this APK)

| Surface | Network |
|---------|---------|
| Chrome / laptop / mobile browser / PWA | **AdSense** (`AdBanner.tsx`) |
| This Android WebView app | **AdMob** sticky banner under the WebView |

AdSense is **not** loaded inside the WebView (policy). The native shell enables the sticky AdMob banner on launch; the web app can still call `AndroidStreamBridge.setBannerAdsEnabled(true|false)` from ads settings. AdMob banners stay outside the player (under the WebView).

### AdMob setup (before Play Store)

1. Create an app + **Banner** ad unit in [AdMob](https://admob.google.com/).
2. Paste the same IDs into **Admin → API Vault** (`ADMOB_APP_ID`, `ADMOB_BANNER_UNIT_ID`) for ops tracking.
3. Replace the **sample** App ID in `AndroidManifest.xml`:
   - `com.google.android.gms.ads.APPLICATION_ID` → `ca-app-pub-xxxxxxxx~yyyyyyyyyy`
4. Replace the **sample** banner unit in `res/values/strings.xml`:
   - `admob_banner_unit_id` → `ca-app-pub-xxxxxxxx/yyyyyyyyyy`
5. Keep Google’s sample IDs while developing (they always fill with test ads).
6. **UMP / Privacy & messaging:** in AdMob → Privacy & messaging, create a GDPR message linked to this app. The app gathers consent via `user-messaging-platform` before `MobileAds.initialize` / `loadAd`.
7. Play targets **API 36** (`compileSdk` / `targetSdk`).

## Bridge (JS → Kotlin)

Injected as `window.AndroidStreamBridge`:

```js
AndroidStreamBridge.startStream(rtmpFullUrl, gamePackageName, resolution, micEnabled)
AndroidStreamBridge.stopStream()
AndroidStreamBridge.muteMic()
AndroidStreamBridge.unmuteMic()
AndroidStreamBridge.isNativeApp()
AndroidStreamBridge.setBannerAdsEnabled(true) // when admob/adsense enabled in settings
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

## Release signing (upload keystore)

Upload keystore lives **outside** this repo (do not commit):

- `~/Documents/GamePlayLive-signing/gameplay-live-upload.jks`
- `~/Documents/GamePlayLive-signing/keystore.properties` (passwords + alias)
- Local Gradle copy: `android-native/keystore.properties` (gitignored)

Alias: `gameplay-upload`. Release builds pick this up automatically via `signingConfigs.release`.

After the first Play Console AAB upload, copy **Play App Signing → App signing key → SHA-256** into `public/.well-known/assetlinks.json` (that fingerprint is Google’s, not the upload key).
