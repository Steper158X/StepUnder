package com.stepz.stepunder.media

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject
import java.lang.ref.WeakReference

/**
 * Connects the web player (an <audio> element inside the WebView) to the
 * Android media stack.
 *
 * The page calls `window.StepUnderMedia.update(json)` whenever the track or
 * play state changes, and `window.StepUnderMedia.clear()` when the queue
 * empties. Buttons on the notification, lock screen, Bluetooth headsets and
 * Android Auto come back through [dispatch], which calls
 * `window.__stepunderMediaAction(action, value)` in the page.
 */
object MediaBridge {
    private const val TAG = "StepUnderMedia"
    const val JS_NAME = "StepUnderMedia"

    data class NowPlaying(
        val title: String,
        val artist: String,
        val album: String,
        val artworkUrl: String?,
        val playing: Boolean,
        val loading: Boolean,
        /** Seconds. */
        val position: Double,
        /** Seconds; 0 when unknown. */
        val duration: Double,
        val hasNext: Boolean,
        val hasPrevious: Boolean,
    )

    private val main = Handler(Looper.getMainLooper())
    private var appContext: Context? = null
    private var webView = WeakReference<WebView>(null)

    /** Latest state from the page; null when nothing is queued. */
    @Volatile
    var current: NowPlaying? = null
        private set

    /** The running service, if any. Main thread only. */
    internal var listener: ((NowPlaying?) -> Unit)? = null

    fun attach(view: WebView) {
        appContext = view.context.applicationContext
        webView = WeakReference(view)
        view.addJavascriptInterface(JsInterface(), JS_NAME)
    }

    fun detach() {
        webView = WeakReference(null)
    }

    /** Sends a media action back to the page. Safe to call from any thread. */
    fun dispatch(action: String, value: Double? = null) {
        main.post {
            if (NativePlayer.inUse) {
                when (action) {
                    "play" -> NativePlayer.play()
                    "pause" -> NativePlayer.pause()
                    "next" -> NativePlayer.next()
                    "previous" -> NativePlayer.previous()
                    "stop" -> NativePlayer.stop()
                    "seek" -> value?.let(NativePlayer::seek)
                }
                return@post
            }
            val view = webView.get() ?: return@post
            val arg = value?.let { if (it.isFinite()) it.toString() else "null" } ?: "null"
            view.evaluateJavascript(
                "window.__stepunderMediaAction && window.__stepunderMediaAction(${JSONObject.quote(action)}, $arg)",
                null,
            )
        }
    }

    internal fun publish(state: NowPlaying?) = apply(state)

    private fun apply(state: NowPlaying?) {
        current = state
        val listener = listener
        if (listener != null) {
            listener(state)
            return
        }
        // Only a playing track needs the service; it reads `current` on start.
        if (state == null || !state.playing) return
        val context = appContext ?: return
        val intent = Intent(context, PlaybackService::class.java)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } catch (error: Exception) {
            // Android 12+ refuses to start a foreground service from the
            // background; the next update while the app is visible retries.
            Log.w(TAG, "Could not start the playback service", error)
        }
    }

    private class JsInterface {
        @JavascriptInterface
        fun update(json: String) {
            val state = try {
                parse(JSONObject(json))
            } catch (error: Exception) {
                Log.w(TAG, "Ignoring a malformed media update", error)
                return
            }
            main.post { if (!NativePlayer.inUse) apply(state) }
        }

        @JavascriptInterface
        fun clear() {
            main.post { if (!NativePlayer.inUse) apply(null) }
        }
    }

    private fun parse(json: JSONObject) = NowPlaying(
        title = json.optString("title"),
        artist = json.optString("artist"),
        album = json.optString("album"),
        artworkUrl = json.optString("artworkUrl").takeIf { it.isNotBlank() },
        playing = json.optBoolean("playing"),
        loading = json.optBoolean("loading"),
        position = json.optDouble("position", 0.0).takeIf { it.isFinite() } ?: 0.0,
        duration = json.optDouble("duration", 0.0).takeIf { it.isFinite() } ?: 0.0,
        hasNext = json.optBoolean("hasNext", true),
        hasPrevious = json.optBoolean("hasPrevious", true),
    )
}
