package com.stepz.stepunder.media

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import org.json.JSONObject
import java.io.File
import java.lang.ref.WeakReference

/**
 * The Android playback engine: Media3 ExoPlayer, driven by the page.
 *
 * The queue still lives in the page. It loads the current track together
 * with the one after it, so ExoPlayer moves on to the next song by itself
 * (gapless, and without waiting for the WebView's JavaScript, which Android
 * slows down while the screen is off). The page is then told which song is
 * playing and sends the one after that.
 *
 * Page → native: `window.StepUnderPlayer.load(json)`, `.setNext(json)`,
 * `.play()`, `.pause()`, `.seek(seconds)`, `.stop()`, `.setVolume(v)`,
 * `.setMuted(b)`, `.setRepeatOne(b)`, `.setOutput(deviceId)`.
 *
 * Native → page: `window.__stepunderPlayerEvent(json)` with a `type` of
 * `state`, `advanced` (moved on to the queued next song), `repeated`,
 * `ended` (nothing left to play) or `error`.
 */
@OptIn(UnstableApi::class)
object NativePlayer {
    private const val TAG = "StepUnderPlayer"
    const val JS_NAME = "StepUnderPlayer"
    private const val TICK_MS = 500L

    private val main = Handler(Looper.getMainLooper())
    private var appContext: Context? = null
    private var webView = WeakReference<WebView>(null)
    private var player: ExoPlayer? = null

    private var volume = 1f
    private var muted = false

    /** Output picked in the app; null lets Android route the audio. Main thread. */
    var preferredDeviceId: Int? = null
        private set

    /** True once the page has loaded a track into this engine. Main thread. */
    var inUse = false
        private set

    fun attach(view: WebView) {
        appContext = view.context.applicationContext
        webView = WeakReference(view)
        view.addJavascriptInterface(JsInterface(), JS_NAME)
    }

    /** The activity (and with it the queue) is going away for good. */
    fun release() {
        main.removeCallbacks(ticker)
        player?.release()
        player = null
        inUse = false
        webView = WeakReference(null)
    }

    // --- Controls used by the media session (lock screen, headset) --------

    fun play() {
        val player = player ?: return
        if (player.playbackState == Player.STATE_ENDED) player.seekTo(0, 0)
        if (player.playbackState == Player.STATE_IDLE) player.prepare()
        player.play()
    }

    fun pause() {
        player?.pause()
    }

    fun seek(seconds: Double) {
        val player = player ?: return
        if (!seconds.isFinite()) return
        player.seekTo((seconds.coerceAtLeast(0.0) * 1000).toLong())
        sendState()
    }

    // --- Player ------------------------------------------------------------

    private fun ensurePlayer(): ExoPlayer? {
        player?.let { return it }
        val context = appContext ?: return null
        val created = ExoPlayer.Builder(context)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                /* handleAudioFocus = */ true,
            )
            // Pause when headphones are unplugged or Bluetooth disconnects.
            .setHandleAudioBecomingNoisy(true)
            // Keeps the CPU and Wi-Fi awake while streaming with the screen off.
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build()
        created.addListener(listener)
        player = created
        applyVolume()
        applyOutput()
        return created
    }

    private val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) {
            if (events.containsAny(
                    Player.EVENT_IS_PLAYING_CHANGED,
                    Player.EVENT_PLAYBACK_STATE_CHANGED,
                    Player.EVENT_PLAY_WHEN_READY_CHANGED,
                    Player.EVENT_POSITION_DISCONTINUITY,
                    Player.EVENT_TIMELINE_CHANGED,
                )
            ) {
                sendState()
                scheduleTicks()
            }
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            val id = mediaItem?.mediaId ?: return
            when (reason) {
                Player.MEDIA_ITEM_TRANSITION_REASON_AUTO -> {
                    // Keep only the song now playing; the page sends the next.
                    val player = player ?: return
                    val index = player.currentMediaItemIndex
                    if (index > 0) player.removeMediaItems(0, index)
                    send(JSONObject().put("type", "advanced").put("id", id))
                }
                Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT ->
                    send(JSONObject().put("type", "repeated").put("id", id))
            }
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_ENDED) {
                send(JSONObject().put("type", "ended"))
            }
        }

        override fun onPlayerError(error: PlaybackException) {
            Log.w(TAG, "Playback failed", error)
            send(
                JSONObject()
                    .put("type", "error")
                    .put("message", error.message ?: error.errorCodeName),
            )
        }
    }

    private fun mediaItem(json: JSONObject): MediaItem? {
        val url = json.optString("url").takeIf { it.isNotBlank() } ?: return null
        // Downloaded songs come as plain file paths.
        val uri = if (url.startsWith("/")) Uri.fromFile(File(url)) else Uri.parse(url)
        return MediaItem.Builder()
            .setMediaId(json.optString("id"))
            .setUri(uri)
            .build()
    }

    private fun load(json: JSONObject) {
        val player = ensurePlayer() ?: return
        val current = mediaItem(json) ?: return
        val items = mutableListOf(current)
        json.optJSONObject("next")?.let(::mediaItem)?.let(items::add)

        volume = json.optDouble("volume", volume.toDouble()).toFloat().coerceIn(0f, 1f)
        muted = json.optBoolean("muted", muted)
        applyVolume()
        player.repeatMode =
            if (json.optBoolean("repeatOne")) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF

        val position = json.optDouble("position", 0.0).takeIf { it.isFinite() } ?: 0.0
        player.setMediaItems(items, 0, (position.coerceAtLeast(0.0) * 1000).toLong())
        player.playWhenReady = json.optBoolean("autoplay", true)
        player.prepare()
        inUse = true
        sendState()
    }

    /** Replaces whatever is queued after the current song. */
    private fun setNext(json: JSONObject?) {
        val player = player ?: return
        if (player.mediaItemCount == 0) return
        val index = player.currentMediaItemIndex
        val next = json?.let(::mediaItem)
        val queued = if (index + 1 < player.mediaItemCount) player.getMediaItemAt(index + 1) else null
        if (queued?.mediaId == next?.mediaId && queued?.localConfiguration?.uri == next?.localConfiguration?.uri) {
            return
        }
        if (index + 1 < player.mediaItemCount) {
            player.removeMediaItems(index + 1, player.mediaItemCount)
        }
        if (next != null) player.addMediaItem(next)
    }

    private fun stop() {
        val player = player ?: return
        player.stop()
        player.clearMediaItems()
        inUse = false
        sendState()
    }

    private fun applyVolume() {
        player?.volume = if (muted) 0f else volume
    }

    private fun setOutput(id: Int?) {
        preferredDeviceId = id
        applyOutput()
    }

    private fun applyOutput() {
        val player = player ?: return
        val id = preferredDeviceId
        val device: AudioDeviceInfo? = if (id == null) null else {
            val manager = appContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            manager?.getDevices(AudioManager.GET_DEVICES_OUTPUTS)?.firstOrNull { it.id == id }
        }
        // A device that is gone lets Android pick again.
        if (id != null && device == null) preferredDeviceId = null
        player.setPreferredAudioDevice(device)
    }

    // --- Page updates ------------------------------------------------------

    private val ticker = object : Runnable {
        override fun run() {
            val player = player ?: return
            if (!player.isPlaying) return
            sendState()
            main.postDelayed(this, TICK_MS)
        }
    }

    private fun scheduleTicks() {
        main.removeCallbacks(ticker)
        if (player?.isPlaying == true) main.postDelayed(ticker, TICK_MS)
    }

    private fun sendState() {
        val player = player ?: return
        val state = player.playbackState
        val active = state != Player.STATE_IDLE && state != Player.STATE_ENDED
        val duration = player.duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: 0L
        send(
            JSONObject()
                .put("type", "state")
                .put("id", player.currentMediaItem?.mediaId ?: JSONObject.NULL)
                .put("playing", player.playWhenReady && active)
                .put("loading", player.playWhenReady && state == Player.STATE_BUFFERING)
                .put("position", player.currentPosition.coerceAtLeast(0) / 1000.0)
                .put("duration", duration / 1000.0),
        )
    }

    private fun send(event: JSONObject) {
        val view = webView.get() ?: return
        view.evaluateJavascript(
            "window.__stepunderPlayerEvent && window.__stepunderPlayerEvent(${JSONObject.quote(event.toString())})",
            null,
        )
    }

    /** Called on a WebView binder thread; ExoPlayer wants the main thread. */
    private class JsInterface {
        private fun run(block: () -> Unit) {
            main.post {
                try {
                    block()
                } catch (error: Exception) {
                    Log.w(TAG, "Player command failed", error)
                }
            }
        }

        @JavascriptInterface
        fun load(json: String) = run { NativePlayer.load(JSONObject(json)) }

        @JavascriptInterface
        fun setNext(json: String) = run {
            NativePlayer.setNext(json.takeIf { it.isNotBlank() && it != "null" }?.let(::JSONObject))
        }

        @JavascriptInterface
        fun play() = run { NativePlayer.play() }

        @JavascriptInterface
        fun pause() = run { NativePlayer.pause() }

        @JavascriptInterface
        fun seek(seconds: Double) = run { NativePlayer.seek(seconds) }

        @JavascriptInterface
        fun stop() = run { NativePlayer.stop() }

        @JavascriptInterface
        fun setVolume(value: Double) = run {
            volume = value.toFloat().coerceIn(0f, 1f)
            applyVolume()
        }

        @JavascriptInterface
        fun setMuted(value: Boolean) = run {
            muted = value
            applyVolume()
        }

        @JavascriptInterface
        fun setRepeatOne(value: Boolean) = run {
            player?.repeatMode = if (value) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
        }

        /** A device id from `StepUnderOutputs.list()`, or -1 to let Android choose. */
        @JavascriptInterface
        fun setOutput(id: Int) = run {
            NativePlayer.setOutput(id.takeIf { it >= 0 })
            AudioOutputs.refresh()
        }
    }
}
