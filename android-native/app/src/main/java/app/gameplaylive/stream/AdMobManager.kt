package app.gameplaylive.stream

import android.app.Activity
import android.util.Log
import android.view.View
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration

/**
 * Owns the sticky AdMob banner under the WebView.
 * Web JS toggles visibility via [setBannerAdsEnabled] (Pro / ads off → hide).
 */
class AdMobManager(
  private val activity: Activity,
  private val adView: AdView
) {
  private var adsWanted = false
  private var sdkReady = false
  private var loadedOnce = false

  fun initialize() {
    // Always use Google's test devices in debug; swap unit IDs in strings.xml for production.
    MobileAds.setRequestConfiguration(
      RequestConfiguration.Builder()
        .setTestDeviceIds(listOf(AdRequest.DEVICE_ID_EMULATOR))
        .build()
    )
    MobileAds.initialize(activity) {
      sdkReady = true
      activity.runOnUiThread { maybeLoad() }
    }
  }

  fun setBannerAdsEnabled(enabled: Boolean) {
    adsWanted = enabled
    activity.runOnUiThread {
      if (!enabled) {
        adView.visibility = View.GONE
        adView.pause()
        return@runOnUiThread
      }
      maybeLoad()
    }
  }

  fun resume() {
    if (adsWanted && adView.visibility == View.VISIBLE) adView.resume()
  }

  fun pause() {
    adView.pause()
  }

  fun destroy() {
    adView.destroy()
  }

  private fun maybeLoad() {
    if (!adsWanted || !sdkReady) return
    adView.visibility = View.VISIBLE
    adView.resume()
    if (loadedOnce) return
    try {
      adView.loadAd(AdRequest.Builder().build())
      loadedOnce = true
    } catch (e: Exception) {
      Log.w(TAG, "AdMob load failed", e)
      adView.visibility = View.GONE
    }
  }

  companion object {
    private const val TAG = "AdMobManager"
  }
}
