package app.gameplaylive.stream

import android.app.Activity
import android.webkit.JavascriptInterface
import android.widget.Toast

/**
 * Injected into the GamePlay Live WebView as `AndroidStreamBridge`.
 *
 * Native phone screen Go Live (MediaProjection / FGS) is disabled for the Play Store
 * build. Users can still go live via the website + OBS / YouTube Studio.
 */
class WebAppInterface(
  private val activity: Activity,
  @Suppress("unused") private val apiBaseUrl: String,
  @Suppress("unused") private val authCookieProvider: () -> String = { "" },
  private val bannerAdsController: (Boolean) -> Unit = {}
) {

  @JavascriptInterface
  fun isNativeApp(): Boolean = true

  /** Called from web when ads settings change. Free + ads on → true. */
  @JavascriptInterface
  fun setBannerAdsEnabled(enabled: Boolean) {
    activity.runOnUiThread { bannerAdsController(enabled) }
  }

  @JavascriptInterface
  fun startStream(
    @Suppress("unused") rtmpFullUrl: String,
    @Suppress("unused") gamePackageName: String,
    @Suppress("unused") resolution: String,
    @Suppress("unused") micEnabled: Boolean
  ) {
    activity.runOnUiThread {
      Toast.makeText(
        activity,
        "Phone screen Go Live isn’t in this Play build. Use gameplaylive.live with OBS or YouTube Studio.",
        Toast.LENGTH_LONG
      ).show()
    }
  }

  /** Back-compat: older JS that only passed (url, resolution, mic). */
  @JavascriptInterface
  fun startStream(rtmpFullUrl: String, resolution: String, micEnabled: Boolean) {
    startStream(rtmpFullUrl, "", resolution, micEnabled)
  }

  @JavascriptInterface
  fun stopStream() {
    // no-op — native screen stream service removed for Play
  }

  @JavascriptInterface
  fun muteMic() {
    // no-op
  }

  @JavascriptInterface
  fun unmuteMic() {
    // no-op
  }
}
