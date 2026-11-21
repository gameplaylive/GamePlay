package app.gameplaylive.stream

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.animation.AccelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ImageView
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.view.WindowCompat
import com.google.android.gms.ads.AdView

/**
 * WebView shell hosting GamePlay Live + AndroidStreamBridge + sticky AdMob banner.
 * Google OAuth opens in Chrome Custom Tabs (account picker is blocked inside WebView).
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
    // Keep content between status / nav bars (Android 15+ edge-to-edge otherwise overflows).
    WindowCompat.setDecorFitsSystemWindows(window, true)
    setContentView(R.layout.activity_main)

    webView = findViewById(R.id.webView)
    splashOverlay = findViewById(R.id.splashOverlay)
    splashLogo = findViewById(R.id.splashLogo)
    val adView = findViewById<AdView>(R.id.adView)
    adMob = AdMobManager(this, adView)
    adMob.initialize()
    // Don't wait for WebView JS — banner stayed GONE forever if the bridge sync raced/failed.
    adMob.setBannerAdsEnabled(true)

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
      databaseEnabled = true
      mediaPlaybackRequiresUserGesture = false
      mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
      // Helps some Google/account pages; Custom Tabs still used for OAuth.
      // Tag UA so web can detect the shell even if the JS bridge is late.
      val baseUa = userAgentString.replace("; wv", "")
      userAgentString =
        if (baseUa.contains("GameplayLiveAndroid")) baseUa
        else "$baseUa GameplayLiveAndroid/1.0"
      setSupportMultipleWindows(false)
    }
    webView.webChromeClient = WebChromeClient()
    webView.webViewClient = object : WebViewClient() {
      override fun onPageFinished(view: WebView?, url: String?) {
        hideSplash()
      }

      override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val uri = request?.url ?: return false
        return handleUri(uri)
      }

      @Deprecated("Deprecated in Java")
      override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        return handleUri(Uri.parse(url))
      }
    }

    webView.addJavascriptInterface(
      WebAppInterface(
        activity = this,
        apiBaseUrl = API_BASE,
        authCookieProvider = {
          CookieManager.getInstance().getCookie(API_BASE).orEmpty()
        },
        bannerAdsController = { enabled -> adMob.setBannerAdsEnabled(enabled) },
        onOpenExternalUrl = { url -> openCustomTab(url) }
      ),
      "AndroidStreamBridge"
    )

    loadFromIntent(intent)

    splashOverlay.postDelayed({ hideSplash() }, 4500)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    loadFromIntent(intent)
  }

  private fun loadFromIntent(intent: Intent?) {
    val deep = intent?.data?.toString()
    if (!deep.isNullOrBlank()) {
      webView.loadUrl(deep)
    } else if (webView.url.isNullOrBlank()) {
      webView.loadUrl(WEB_URL)
    }
  }

  /** Open Google / OAuth hosts outside the WebView so the account picker works. */
  private fun handleUri(uri: Uri): Boolean {
    val host = uri.host?.lowercase().orEmpty()
    val href = uri.toString()
    // Stay in WebView for our site (including /auth/callback after App Link return).
    if (host == "gameplaylive.live" || host.endsWith(".gameplaylive.live")) {
      return false
    }
    val externalAuth =
      host.startsWith("accounts.google.") ||
        host == "accounts.google.com" ||
        (host.endsWith("google.com") && (href.contains("/o/oauth") || href.contains("oauth2"))) ||
        (host.endsWith("supabase.co") && href.contains("/auth/")) ||
        host == "appleid.apple.com"
    if (externalAuth) {
      openCustomTab(href)
      return true
    }
    return false
  }

  private fun openCustomTab(url: String) {
    try {
      CustomTabsIntent.Builder()
        .setShowTitle(true)
        .build()
        .launchUrl(this, Uri.parse(url))
    } catch (_: Exception) {
      startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }
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
