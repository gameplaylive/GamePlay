package app.gameplaylive.stream

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.widget.Toast

/**
 * Thin activity that requests MediaProjection consent, then starts
 * [ScreenStreamService] and exits — game launch happens inside the service.
 */
class StreamPermissionActivity : Activity() {

  companion object {
    private const val REQ_PROJECTION = 9001
  }

  private var rtmpUrl: String = ""
  private var gamePackage: String = ""
  private var resolution: String = "720p60"
  private var micEnabled: Boolean = true
  private var apiBase: String = ""
  private var authCookie: String = ""
  private var streamId: String = ""

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    rtmpUrl = intent.getStringExtra(ScreenStreamService.EXTRA_RTMP_URL).orEmpty()
    gamePackage = intent.getStringExtra(ScreenStreamService.EXTRA_GAME_PACKAGE).orEmpty()
    resolution = intent.getStringExtra(ScreenStreamService.EXTRA_RESOLUTION) ?: "720p60"
    micEnabled = intent.getBooleanExtra(ScreenStreamService.EXTRA_MIC_ENABLED, true)
    apiBase = intent.getStringExtra(ScreenStreamService.EXTRA_API_BASE).orEmpty()
    authCookie = intent.getStringExtra(ScreenStreamService.EXTRA_AUTH_COOKIE).orEmpty()
    streamId = intent.getStringExtra(ScreenStreamService.EXTRA_STREAM_ID).orEmpty()

    val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    startActivityForResult(mpm.createScreenCaptureIntent(), REQ_PROJECTION)
  }

  @Deprecated("Deprecated in Java")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != REQ_PROJECTION) {
      finish()
      return
    }
    if (resultCode != RESULT_OK || data == null) {
      Toast.makeText(this, "Screen capture permission denied", Toast.LENGTH_SHORT).show()
      finish()
      return
    }

    val serviceIntent = Intent(this, ScreenStreamService::class.java).apply {
      action = ScreenStreamService.ACTION_START
      putExtra(ScreenStreamService.EXTRA_RTMP_URL, rtmpUrl)
      putExtra(ScreenStreamService.EXTRA_GAME_PACKAGE, gamePackage)
      putExtra(ScreenStreamService.EXTRA_RESOLUTION, resolution)
      putExtra(ScreenStreamService.EXTRA_MIC_ENABLED, micEnabled)
      putExtra(ScreenStreamService.EXTRA_API_BASE, apiBase)
      putExtra(ScreenStreamService.EXTRA_AUTH_COOKIE, authCookie)
      putExtra(ScreenStreamService.EXTRA_STREAM_ID, streamId)
      putExtra(ScreenStreamService.EXTRA_RESULT_CODE, resultCode)
      putExtra(ScreenStreamService.EXTRA_RESULT_DATA, data)
    }
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      startForegroundService(serviceIntent)
    } else {
      startService(serviceIntent)
    }
    finish()
  }
}
