package app.gameplaylive.stream

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.view.animation.AccelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ImageView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.gms.ads.AdView

/**
 * WebView shell hosting GamePlay Live + AndroidStreamBridge + sticky AdMob banner.
 * Shows a black splash with the brand mark until the first page finishes loading.
 */
class MainActivity : AppCompatActivity() {

  companion object {
    const val WEB_URL = "https://gameplaylive.live/"
    const val API_BASE = "https://gameplaylive.live"
  }

  private lateinit var webView: WebView
  private lateinit var adMob: AdMobManager
  private lateinit var splashOverlay: View
  private lateinit var splashLogo: ImageView
  private var splashHidden = false

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    webView = findViewById(R.id.webView)
    splashOverlay = findViewById(R.id.splashOverlay)
    splashLogo = findViewById(R.id.splashLogo)
    val adView = findViewById<AdView>(R.id.adView)
    adMob = AdMobManager(this, adView)
    adMob.initialize()

    // Soft pulse on the mark while the page loads
    splashLogo.animate()
      .scaleX(1.06f)
      .scaleY(1.06f)
      .setDuration(700)
      .setInterpolator(DecelerateInterpolator())
      .withEndAction {
        splashLogo.animate()
          .scaleX(1f)
          .scaleY(1f)
          .setDuration(700)
          .setInterpolator(AccelerateInterpolator())
          .start()
      }
      .start()

    CookieManager.getInstance().setAcceptCookie(true)
    CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

    webView.settings.apply {
      javaScriptEnabled = true
      domStorageEnabled = true
      mediaPlaybackRequiresUserGesture = false
      mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
      userAgentString = "$userAgentString GameplayLiveAndroid/1.0"
    }
    webView.webChromeClient = WebChromeClient()
    webView.webViewClient = object : WebViewClient() {
      override fun onPageFinished(view: WebView?, url: String?) {
        hideSplash()
      }
    }

    webView.addJavascriptInterface(
      WebAppInterface(
        activity = this,
        apiBaseUrl = API_BASE,
        authCookieProvider = {
          CookieManager.getInstance().getCookie(API_BASE).orEmpty()
        },
        bannerAdsController = { enabled -> adMob.setBannerAdsEnabled(enabled) }
      ),
      "AndroidStreamBridge"
    )

    val deep = intent?.data?.toString()
    webView.loadUrl(deep ?: WEB_URL)

    // Failsafe: never leave users stuck on splash
    splashOverlay.postDelayed({ hideSplash() }, 4500)
  }

  private fun hideSplash() {
    if (splashHidden) return
    splashHidden = true
    splashOverlay.animate()
      .alpha(0f)
      .setDuration(420)
      .setInterpolator(AccelerateInterpolator())
      .withEndAction {
        splashOverlay.visibility = View.GONE
      }
      .start()
  }

  override fun onResume() {
    super.onResume()
    if (::adMob.isInitialized) adMob.resume()
  }

  override fun onPause() {
    if (::adMob.isInitialized) adMob.pause()
    super.onPause()
  }

  override fun onDestroy() {
    if (::adMob.isInitialized) adMob.destroy()
    super.onDestroy()
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
  }
}
