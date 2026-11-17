package app.gameplaylive.stream

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs

/**
 * Draggable SYSTEM_ALERT_WINDOW pill: LIVE · Mic · Stop
 * so creators never leave their game mid-broadcast.
 */
class FloatingLiveBubble(
  private val context: Context,
  private val onAction: (Action) -> Unit
) {
  enum class Action { TOGGLE_MIC, STOP }

  private val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private var root: View? = null
  private var micLabel: TextView? = null

  @SuppressLint("ClickableViewAccessibility")
  fun show(micMuted: Boolean) {
    if (root != null) {
      refreshMuteState(micMuted)
      return
    }

    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = 24
      y = 180
    }

    val pill = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      setPadding(28, 18, 28, 18)
      setBackgroundColor(0xE6111218.toInt())
      elevation = 12f
    }

    val live = TextView(context).apply {
      text = "● LIVE"
      setTextColor(0xFFFF2A54.toInt())
      textSize = 12f
      setPadding(0, 0, 22, 0)
      paint.isFakeBoldText = true
    }

    micLabel = TextView(context).apply {
      text = if (micMuted) "Mic Off" else "Mic"
      setTextColor(0xFFF2F5FF.toInt())
      textSize = 12f
      setPadding(0, 0, 22, 0)
      paint.isFakeBoldText = true
      setOnClickListener { onAction(Action.TOGGLE_MIC) }
    }

    val stop = TextView(context).apply {
      text = "Stop"
      setTextColor(0xFFFFB800.toInt())
      textSize = 12f
      paint.isFakeBoldText = true
      setOnClickListener { onAction(Action.STOP) }
    }

    pill.addView(live)
    pill.addView(micLabel)
    pill.addView(stop)

    var downX = 0f
    var downY = 0f
    var startX = 0
    var startY = 0
    var moved = false

    pill.setOnTouchListener { _, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          downX = event.rawX
          downY = event.rawY
          startX = params.x
          startY = params.y
          moved = false
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = (event.rawX - downX).toInt()
          val dy = (event.rawY - downY).toInt()
          if (abs(dx) > 6 || abs(dy) > 6) moved = true
          params.x = startX + dx
          params.y = startY + dy
          wm.updateViewLayout(pill, params)
          true
        }
        MotionEvent.ACTION_UP -> {
          // clicks on children still fire if not dragged
          !moved
        }
        else -> false
      }
    }

    root = pill
    wm.addView(pill, params)
  }

  fun refreshMuteState(micMuted: Boolean) {
    micLabel?.text = if (micMuted) "Mic Off" else "Mic"
  }

  fun dismiss() {
    root?.let {
      try {
        wm.removeView(it)
      } catch (_: Throwable) {
      }
    }
    root = null
    micLabel = null
  }
}
