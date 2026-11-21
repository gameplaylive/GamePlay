package app.gameplaylive.stream

import android.app.Activity
import android.util.Log
import android.view.View
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform

/**
 * Owns the sticky AdMob banner under the WebView.
 * Gathers UMP consent before initializing the Mobile Ads SDK / loading ads.
 * Defaults to wanting ads; web JS can still toggle via [setBannerAdsEnabled].
 */
class AdMobManager(
  private val activity: Activity,
  private val adView: AdView
) {
  private var adsWanted = true
  private var sdkReady = false
  private var loadedOnce = false
  private var loadAttempts = 0
  private lateinit var consentInformation: ConsentInformation

  fun initialize() {
    consentInformation = UserMessagingPlatform.getConsentInformation(activity)
    adView.adListener = object : AdListener() {
      override fun onAdLoaded() {
        Log.i(TAG, "Banner loaded")
        activity.runOnUiThread {
          if (adsWanted) adView.visibility = View.VISIBLE
        }
      }

      override fun onAdFailedToLoad(error: LoadAdError) {
        Log.w(TAG, "Banner failed: code=${error.code} domain=${error.domain} msg=${error.message}")
        loadedOnce = false
        activity.runOnUiThread {
          // Keep slot reserved only while we still want ads; retry a few times.
          if (!adsWanted) {
            adView.visibility = View.GONE
            return@runOnUiThread
          }
          if (loadAttempts < 4) {
            adView.postDelayed({ maybeLoad(force = true) }, 4_000L * loadAttempts.coerceAtLeast(1))
          }
        }
      }
    }

    val params = ConsentRequestParameters.Builder().build()
    consentInformation.requestConsentInfoUpdate(
      activity,
      params,
      {
        UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { formError ->
          if (formError != null) {
            Log.w(TAG, "UMP form: ${formError.message}")
          }
          maybeInitAdsSdk()
        }
      },
      { formError ->
        Log.w(TAG, "UMP update failed: ${formError.message}")
        // Still attempt ads if the SDK allows (e.g. non-EEA / prior consent).
        maybeInitAdsSdk()
      }
    )
  }

  fun setBannerAdsEnabled(enabled: Boolean) {
    adsWanted = enabled
    activity.runOnUiThread {
      if (!enabled) {
        adView.visibility = View.GONE
        adView.pause()
        return@runOnUiThread
      }
      maybeInitAdsSdk()
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

  private fun maybeInitAdsSdk() {
    if (!::consentInformation.isInitialized) return
    if (!consentInformation.canRequestAds()) {
      Log.i(TAG, "UMP: cannot request ads yet")
      return
    }
    if (sdkReady) {
      maybeLoad()
      return
    }
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

  private fun maybeLoad(force: Boolean = false) {
    if (!adsWanted || !sdkReady) return
    if (!consentInformation.canRequestAds()) return
    if (loadedOnce && !force) {
      adView.visibility = View.VISIBLE
      adView.resume()
      return
    }
    try {
      loadAttempts += 1
      adView.visibility = View.VISIBLE
      adView.resume()
      adView.loadAd(AdRequest.Builder().build())
      loadedOnce = true
    } catch (e: Exception) {
      Log.w(TAG, "AdMob load failed", e)
      loadedOnce = false
      adView.visibility = View.GONE
    }
  }

  companion object {
    private const val TAG = "AdMobManager"
  }
}
