package app.gameplaylive.stream

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioPlaybackCaptureConfiguration
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.pedro.common.ConnectChecker
import com.pedro.library.generic.GenericDisplay
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/**
 * Foreground MediaProjection encoder that pushes RTMPS straight to YouTube.
 * Uses RootEncoder (GenericDisplay) — video encodes on-device, ₹0 server relay.
 *
 * Notification actions (Stop / Mute Mic) are required for Play Store policy.
 * Floating [FloatingLiveBubble] keeps controls over the game.
 */
class ScreenStreamService : Service(), ConnectChecker {

  companion object {
    const val TAG = "ScreenStreamService"
    const val CHANNEL_ID = "gameplay_live_stream"
    const val NOTIF_ID = 7101

    const val ACTION_START = "app.gameplaylive.stream.START"
    const val ACTION_STOP = "app.gameplaylive.stream.STOP"
    const val ACTION_MUTE = "app.gameplaylive.stream.MUTE"
    const val ACTION_UNMUTE = "app.gameplaylive.stream.UNMUTE"

    const val EXTRA_RTMP_URL = "rtmp_url"
    const val EXTRA_RESOLUTION = "resolution"
    const val EXTRA_MIC_ENABLED = "mic_enabled"
    const val EXTRA_GAME_PACKAGE = "game_package"
    const val EXTRA_RESULT_CODE = "result_code"
    const val EXTRA_RESULT_DATA = "result_data"
    const val EXTRA_API_BASE = "api_base"
    const val EXTRA_AUTH_COOKIE = "auth_cookie"
    const val EXTRA_STREAM_ID = "stream_id"

    @Volatile
    var isStreaming: Boolean = false
      private set

    @Volatile
    var isMicMuted: Boolean = false
      private set
  }

  private var display: GenericDisplay? = null
  private var mediaProjection: MediaProjection? = null
  private var floatingBubble: FloatingLiveBubble? = null
  private var rtmpUrl: String = ""
  private var streamId: String? = null
  private var apiBase: String = ""
  private var authCookie: String = ""
  private val http = OkHttpClient()
  private val scope = CoroutineScope(Dispatchers.IO + Job())

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createChannel()
    display = GenericDisplay(baseContext, this).apply {
      getStreamClient().setReTries(10)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopStreaming(notifyApi = true)
        return START_NOT_STICKY
      }
      ACTION_MUTE -> {
        muteMic(true)
        floatingBubble?.refreshMuteState(true)
        refreshNotification()
        return START_STICKY
      }
      ACTION_UNMUTE -> {
        muteMic(false)
        floatingBubble?.refreshMuteState(false)
        refreshNotification()
        return START_STICKY
      }
      ACTION_START -> {
        @Suppress("DEPRECATION")
        val data = if (Build.VERSION.SDK_INT >= 33) {
          intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
        } else {
          intent.getParcelableExtra(EXTRA_RESULT_DATA)
        }
        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
        rtmpUrl = intent.getStringExtra(EXTRA_RTMP_URL).orEmpty()
        val resolution = intent.getStringExtra(EXTRA_RESOLUTION) ?: "720p60"
        val micEnabled = intent.getBooleanExtra(EXTRA_MIC_ENABLED, true)
        isMicMuted = !micEnabled
        streamId = intent.getStringExtra(EXTRA_STREAM_ID)
        apiBase = intent.getStringExtra(EXTRA_API_BASE).orEmpty()
        authCookie = intent.getStringExtra(EXTRA_AUTH_COOKIE).orEmpty()
        val gamePackage = intent.getStringExtra(EXTRA_GAME_PACKAGE).orEmpty()

        if (rtmpUrl.isBlank() || data == null) {
          Log.e(TAG, "Missing RTMP url or MediaProjection data")
          stopSelf()
          return START_NOT_STICKY
        }

        startAsForeground()
        startEncoding(resultCode, data, resolution)
        showFloatingBubble()
        launchGameIfPossible(gamePackage)
        return START_STICKY
      }
    }
    return START_NOT_STICKY
  }

  private fun startAsForeground() {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIF_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
      )
    } else {
      startForeground(NOTIF_ID, notification)
    }
  }

  private fun startEncoding(resultCode: Int, data: Intent, resolution: String) {
    val mpm = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    mediaProjection = mpm.getMediaProjection(resultCode, data)

    val width: Int
    val height: Int
    val fps: Int
    val vBitrate: Int
    if (resolution == "1080p30") {
      width = 1920; height = 1080; fps = 30; vBitrate = 4_500_000
    } else {
      width = 1280; height = 720; fps = 60; vBitrate = 3_500_000
    }

    val d = display ?: return
    d.setIntentResult(resultCode, data)

    // Keep MediaProjection alive for Android 10+ internal audio capture policy
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      try {
        mediaProjection?.let { projection ->
          AudioPlaybackCaptureConfiguration.Builder(projection)
            .addMatchingUsage(AudioAttributes.USAGE_GAME)
            .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
            .build()
          Log.i(TAG, "AudioPlaybackCaptureConfiguration prepared for game/media")
        }
      } catch (t: Throwable) {
        Log.w(TAG, "Playback capture unavailable: ${t.message}")
      }
    }

    val preparedVideo = d.prepareVideo(width, height, fps, vBitrate, 0, 320)
    val preparedAudio = d.prepareAudio(
      /* bitrate */ 128_000,
      /* sampleRate */ 44_100,
      /* isStereo */ true,
      /* echoCanceler */ false,
      /* noiseSuppressor */ true
    )

    if (!preparedVideo || !preparedAudio) {
      Log.e(TAG, "prepareVideo/Audio failed")
      stopStreaming(notifyApi = false)
      return
    }

    if (isMicMuted) {
      d.mute()
    }

    d.startStream(rtmpUrl)
    isStreaming = true
    Log.i(TAG, "RTMPS start → $rtmpUrl")
  }

  private fun muteMic(mute: Boolean) {
    isMicMuted = mute
    val d = display ?: return
    // GenericDisplay mute helpers (RootEncoder)
    try {
      if (mute) d.mute() else d.unMute()
    } catch (t: Throwable) {
      Log.w(TAG, "mute toggle: ${t.message}")
    }
  }

  private fun showFloatingBubble() {
    if (floatingBubble == null) {
      floatingBubble = FloatingLiveBubble(this) { action ->
        when (action) {
          FloatingLiveBubble.Action.STOP -> stopStreaming(notifyApi = true)
          FloatingLiveBubble.Action.TOGGLE_MIC -> {
            muteMic(!isMicMuted)
            floatingBubble?.refreshMuteState(isMicMuted)
            refreshNotification()
          }
        }
      }
    }
    floatingBubble?.show(isMicMuted)
  }

  private fun launchGameIfPossible(packageName: String) {
    if (packageName.isBlank()) return
    try {
      val launch = packageManager.getLaunchIntentForPackage(packageName)
      if (launch != null) {
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(launch)
      } else {
        Log.w(TAG, "Game package not installed: $packageName")
      }
    } catch (t: Throwable) {
      Log.w(TAG, "Could not launch game: ${t.message}")
    }
  }

  private fun stopStreaming(notifyApi: Boolean) {
    try {
      display?.stopStream()
    } catch (_: Throwable) {
    }
    try {
      mediaProjection?.stop()
    } catch (_: Throwable) {
    }
    mediaProjection = null
    isStreaming = false
    floatingBubble?.dismiss()
    floatingBubble = null

    if (notifyApi && apiBase.isNotBlank()) {
      scope.launch { postStopToApi() }
    }

    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun postStopToApi() {
    try {
      val bodyJson = JSONObject().apply {
        if (!streamId.isNullOrBlank()) put("stream_id", streamId)
      }
      val req = Request.Builder()
        .url("${apiBase.trimEnd('/')}/api/streams/stop")
        .post(bodyJson.toString().toRequestBody("application/json".toMediaType()))
        .apply {
          if (authCookie.isNotBlank()) header("Cookie", authCookie)
        }
        .build()
      http.newCall(req).execute().use { /* ignore */ }
    } catch (t: Throwable) {
      Log.w(TAG, "stop API failed: ${t.message}")
    }
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = getSystemService(NotificationManager::class.java)
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Gameplay Live Streaming",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Shows while your screen is streaming to YouTube"
      setShowBadge(false)
    }
    mgr.createNotificationChannel(channel)
  }

  private fun refreshNotification() {
    val mgr = getSystemService(NotificationManager::class.java)
    mgr.notify(NOTIF_ID, buildNotification())
  }

  private fun buildNotification(): Notification {
    val stopPi = PendingIntent.getService(
      this,
      1,
      Intent(this, ScreenStreamService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val muteAction = if (isMicMuted) ACTION_UNMUTE else ACTION_MUTE
    val muteLabel = if (isMicMuted) "Unmute Mic" else "Mute Mic"
    val mutePi = PendingIntent.getService(
      this,
      2,
      Intent(this, ScreenStreamService::class.java).setAction(muteAction),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Gameplay Live · LIVE")
      .setContentText(if (isMicMuted) "Streaming (mic muted)" else "Streaming to YouTube")
      .setSmallIcon(android.R.drawable.ic_menu_camera)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .addAction(0, "Stop Stream", stopPi)
      .addAction(0, muteLabel, mutePi)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()
  }

  override fun onDestroy() {
    stopStreaming(notifyApi = false)
    display = null
    super.onDestroy()
  }

  override fun onConnectionStarted(url: String) {
    Log.i(TAG, "Connection started: $url")
  }

  override fun onConnectionSuccess() {
    Log.i(TAG, "RTMPS connected")
  }

  override fun onConnectionFailed(reason: String) {
    Log.e(TAG, "Connection failed: $reason")
    val retried = display?.getStreamClient()?.reTry(5000, reason) == true
    if (!retried) stopStreaming(notifyApi = true)
  }

  override fun onNewBitrate(bitrate: Long) {}

  override fun onDisconnect() {
    Log.i(TAG, "Disconnected")
  }

  override fun onAuthError() {
    Log.e(TAG, "Auth error")
    stopStreaming(notifyApi = true)
  }

  override fun onAuthSuccess() {}
}
