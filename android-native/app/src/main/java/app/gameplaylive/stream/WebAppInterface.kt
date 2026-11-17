package app.gameplaylive.stream

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.core.content.ContextCompat

/**
 * Injected into the GamePlay Live WebView / Capacitor shell as `AndroidStreamBridge`.
 *
 * JS:
 *   window.AndroidStreamBridge.startStream(rtmpUrl, gamePackageName, resolution, micEnabled)
 *   window.AndroidStreamBridge.stopStream()
 */
class WebAppInterface(
  private val activity: Activity,
  private val apiBaseUrl: String,
  private val authCookieProvider: () -> String = { "" }
) {

  @JavascriptInterface
  fun isNativeApp(): Boolean = true

  @JavascriptInterface
  fun startStream(
    rtmpFullUrl: String,
    gamePackageName: String,
    resolution: String,
    micEnabled: Boolean
  ) {
    activity.runOnUiThread {
      if (rtmpFullUrl.isBlank()) {
        Toast.makeText(activity, "Missing RTMP URL", Toast.LENGTH_SHORT).show()
        return@runOnUiThread
      }
      ensureOverlayPermission()
      ensureMicPermission(micEnabled)

      val intent = Intent(activity, StreamPermissionActivity::class.java).apply {
        putExtra(ScreenStreamService.EXTRA_RTMP_URL, rtmpFullUrl)
        putExtra(ScreenStreamService.EXTRA_GAME_PACKAGE, gamePackageName)
        putExtra(ScreenStreamService.EXTRA_RESOLUTION, resolution.ifBlank { "720p60" })
        putExtra(ScreenStreamService.EXTRA_MIC_ENABLED, micEnabled)
        putExtra(ScreenStreamService.EXTRA_API_BASE, apiBaseUrl)
        putExtra(ScreenStreamService.EXTRA_AUTH_COOKIE, authCookieProvider())
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      activity.startActivity(intent)
    }
  }

  /** Back-compat: older JS that only passed (url, resolution, mic). */
  @JavascriptInterface
  fun startStream(rtmpFullUrl: String, resolution: String, micEnabled: Boolean) {
    startStream(rtmpFullUrl, "", resolution, micEnabled)
  }

  @JavascriptInterface
  fun stopStream() {
    activity.runOnUiThread {
      val intent = Intent(activity, ScreenStreamService::class.java).apply {
        action = ScreenStreamService.ACTION_STOP
      }
      activity.startService(intent)
    }
  }

  @JavascriptInterface
  fun muteMic() {
    activity.startService(
      Intent(activity, ScreenStreamService::class.java).setAction(ScreenStreamService.ACTION_MUTE)
    )
  }

  @JavascriptInterface
  fun unmuteMic() {
    activity.startService(
      Intent(activity, ScreenStreamService::class.java).setAction(ScreenStreamService.ACTION_UNMUTE)
    )
  }

  private fun ensureOverlayPermission() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    if (Settings.canDrawOverlays(activity)) return
    Toast.makeText(
      activity,
      "Allow display over other apps for the LIVE bubble",
      Toast.LENGTH_LONG
    ).show()
    val intent = Intent(
      Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
      Uri.parse("package:${activity.packageName}")
    )
    activity.startActivity(intent)
  }

  private fun ensureMicPermission(micEnabled: Boolean) {
    if (!micEnabled) return
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    val granted = ContextCompat.checkSelfPermission(
      activity,
      Manifest.permission.RECORD_AUDIO
    ) == PackageManager.PERMISSION_GRANTED
    if (!granted) {
      activity.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 4411)
    }
  }
}
