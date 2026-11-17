package app.gameplaylive.stream

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

/**
 * Minimal WebView shell hosting GamePlay Live + AndroidStreamBridge.
 * Replace WEB_URL with your production / staging host.
 */
class MainActivity : AppCompatActivity() {

  companion object {
    const val WEB_URL = "https://gameplaylive.app/go-live"
    const val API_BASE = "https://gameplaylive.app"
  }

  private lateinit var webView: WebView

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    webView = WebView(this)
    setContentView(webView)

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
    webView.webViewClient = WebViewClient()

    webView.addJavascriptInterface(
      WebAppInterface(
        activity = this,
        apiBaseUrl = API_BASE,
        authCookieProvider = {
          CookieManager.getInstance().getCookie(API_BASE).orEmpty()
        }
      ),
      "AndroidStreamBridge"
    )

    val deep = intent?.data?.toString()
    webView.loadUrl(deep ?: WEB_URL)
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
  }
}
