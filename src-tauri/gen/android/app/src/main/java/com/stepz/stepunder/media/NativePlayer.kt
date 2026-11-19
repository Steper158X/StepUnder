package com.stepz.stepunder.media

import android.content.Context
import android.content.Intent
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
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.lang.ref.WeakReference

@OptIn(UnstableApi::class)
object NativePlayer {
    const val JS_NAME = "StepUnderPlayer"
    private val main = Handler(Looper.getMainLooper())
    private var view = WeakReference<WebView>(null)
    private var service: PlaybackService? = null
    private val pending = mutableListOf<(PlaybackEngine) -> Unit>()
    private var foreground = true
    @Volatile var preferredDeviceId: Int? = null
        internal set
    val inUse get() = service?.engine?.inUse == true
    val wantsToPlay get() = service?.engine?.wantsToPlay == true

    fun attach(webView: WebView) {
        view = WeakReference(webView)
        webView.addJavascriptInterface(Bridge(webView.context.applicationContext), JS_NAME)
    }
    fun detach() { view = WeakReference(null); foreground = false; service?.engine?.foreground = false }
    internal fun connected(owner: PlaybackService) {
        service = owner
        owner.engine.foreground = foreground
        pending.toList().also { pending.clear() }.forEach { it(owner.engine) }
    }
    internal fun disconnected(owner: PlaybackService) { if (service === owner) service = null }
    internal fun send(event: JSONObject) {
        view.get()?.evaluateJavascript("window.__stepunderPlayerEvent?.(${JSONObject.quote(event.toString())})", null)
    }
    fun play() { service?.engine?.play() }
    fun pause() { service?.engine?.pause() }
    fun seek(seconds: Double) { service?.engine?.seek(seconds) }
    fun next() { service?.engine?.next() }
    fun previous() { service?.engine?.previous() }
    fun stop() { service?.engine?.stop() }

    private class Bridge(private val context: Context) {
        private fun command(action: (PlaybackEngine) -> Unit) {
            main.post {
                val owner = service
                if (owner != null) action(owner.engine)
                else {
                    pending.add(action)
                    try { context.startService(Intent(context, PlaybackService::class.java)) }
                    catch (error: Exception) {
                        pending.clear()
                        Log.w(JS_NAME, "Cannot start playback", error)
                        send(JSONObject().put("type", "recovery"))
                        send(JSONObject().put("type", "error").put("message", "Cannot start playback"))
                    }
                }
            }
        }
        private fun load(json: String, preserve: Boolean) {
            val input = try { JSONObject(json) } catch (error: Exception) {
                main.post { send(JSONObject().put("type", "error").put("message", "Invalid playback queue")) }
                return
            }
            val items = input.optJSONArray("items") ?: return
            if ((0 until items.length()).any { i ->
                val item = items.optJSONObject(i)
                item == null || item.optString("id").isBlank() || item.optString("url").isBlank() || item.optJSONObject("song") == null
            }) return
            command { it.load(input, preserve) }
        }
        @JavascriptInterface fun load(json: String) = load(json, false)
        @JavascriptInterface fun setQueue(json: String) = load(json, true)
        @JavascriptInterface fun snapshot() = command { it.snapshot() }
        @JavascriptInterface fun setForeground(value: Boolean) { main.post { foreground = value; service?.engine?.foreground = value } }
        @JavascriptInterface fun play() = command { it.play() }
        @JavascriptInterface fun pause() = command { it.pause() }
        @JavascriptInterface fun next() = command { it.next() }
        @JavascriptInterface fun previous() = command { it.previous() }
        @JavascriptInterface fun seek(seconds: Double) = command { it.seek(seconds) }
        @JavascriptInterface fun stop() = command { it.stop() }
        @JavascriptInterface fun setVolume(value: Double) = command { it.volume = value.toFloat().coerceIn(0f, 1f); it.applyVolume() }
        @JavascriptInterface fun setMuted(value: Boolean) = command { it.muted = value; it.applyVolume() }
        @JavascriptInterface fun setOutput(id: Int) = command { it.output(id.takeIf { id >= 0 }); AudioOutputs.refresh() }
    }
}

@OptIn(UnstableApi::class)
class PlaybackEngine(private val context: Context) {
    private val main = Handler(Looper.getMainLooper())
    private val preferences = context.getSharedPreferences("playback-recovery", Context.MODE_PRIVATE)
    private var queue = JSONObject().put("items", JSONArray()).put("currentIndex", -1)
    private var lastPersisted = 0L
    private var updatingQueue = false
    var volume = 0.8f
    var muted = false
    var inUse = false
        private set
    private val player = ExoPlayer.Builder(context)
        .setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true)
        .setHandleAudioBecomingNoisy(true)
        .setWakeMode(C.WAKE_MODE_NETWORK)
        .build()
    val wantsToPlay get() = player.playWhenReady && player.playbackState != Player.STATE_IDLE && player.playbackState != Player.STATE_ENDED

    var foreground = true
        set(value) { field = value; scheduleTick() }
    private var transition = false
    private val ticker = object : Runnable {
        override fun run() { publish() }
    }
    private fun scheduleTick() {
        main.removeCallbacks(ticker)
        if (inUse && wantsToPlay) main.postDelayed(ticker, if (foreground) 500L else 10000L)
    }

    init {
        player.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                transition = reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO || reason == Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT || reason == Player.MEDIA_ITEM_TRANSITION_REASON_SEEK
            }
            override fun onEvents(player: Player, events: Player.Events) { publish() }
            override fun onPlayerError(error: PlaybackException) {
                val item = queue.optJSONArray("items")?.optJSONObject(player.currentMediaItemIndex)
                val fallback = item?.optString("fallbackUrl")
                if (item != null && !fallback.isNullOrBlank() && item.optString("url") != fallback) {
                    item.put("url", fallback)
                    queue.put("currentIndex", player.currentMediaItemIndex).put("position", player.currentPosition / 1000.0).put("autoplay", true)
                    load(queue, false)
                } else {
                    player.pause()
                    NativePlayer.send(JSONObject().put("type", "error").put("message", error.errorCodeName))
                    publish()
                }
            }
        })
        main.post(ticker)
    }
    fun load(input: JSONObject, preserve: Boolean) {
        val items = input.optJSONArray("items") ?: return
        if (items.length() == 0) { stop(); return }
        val old = queue.optJSONArray("items")
        val sameItems = old?.length() == items.length() && (0 until items.length()).all { i ->
            old?.optJSONObject(i)?.optString("url") == items.optJSONObject(i)?.optString("url")
        }
        val index = input.optInt("currentIndex", 0).coerceIn(0, items.length() - 1)
        val retain = preserve && inUse && old?.optJSONObject(player.currentMediaItemIndex)?.optString("id") == items.optJSONObject(index)?.optString("id") && queue.optString("serverId") == input.optString("serverId")
        val position = if (retain) player.currentPosition else (input.optDouble("position", 0.0).coerceAtLeast(0.0) * 1000).toLong()
        val autoplay = if (preserve && inUse) player.playWhenReady else input.optBoolean("autoplay", true)
        updatingQueue = true
        queue = JSONObject(input.toString())
        volume = input.optDouble("volume", volume.toDouble()).toFloat().coerceIn(0f, 1f)
        muted = input.optBoolean("muted", muted)
        inUse = true
        player.repeatMode = when (input.optString("repeat")) { "one" -> Player.REPEAT_MODE_ONE; "all" -> Player.REPEAT_MODE_ALL; else -> Player.REPEAT_MODE_OFF }
        applyVolume()
        if (!preserve || !sameItems || player.mediaItemCount == 0) {
            val media = (0 until items.length()).map { i ->
                val track = items.getJSONObject(i)
                val url = track.getString("url")
                MediaItem.Builder().setMediaId(track.getString("id"))
                    .setUri(if (url.startsWith("/")) Uri.fromFile(File(url)) else Uri.parse(url)).build()
            }
            player.setMediaItems(media, index, position)
            player.playWhenReady = autoplay
            player.prepare()
        } else if (player.currentMediaItemIndex != index) {
            player.seekTo(index, position)
        }
        updatingQueue = false
        transition = false
        snapshot()
        publish()
    }
    fun play() { if (player.playbackState == Player.STATE_ENDED) player.seekTo(0, 0); player.prepare(); player.play() }
    fun pause() { player.pause(); publish() }
    fun seek(seconds: Double) { if (seconds.isFinite()) player.seekTo((seconds.coerceAtLeast(0.0) * 1000).toLong()); publish() }
    fun next() { if (player.mediaItemCount > 0) player.seekTo((player.currentMediaItemIndex + 1) % player.mediaItemCount, 0) }
    fun previous() { if (player.currentPosition > 3000) seek(0.0) else if (player.mediaItemCount > 0) player.seekTo((player.currentMediaItemIndex - 1 + player.mediaItemCount) % player.mediaItemCount, 0) }
    fun stop() {
        inUse = false
        main.removeCallbacks(ticker)
        player.stop()
        player.clearMediaItems()
        queue.put("items", JSONArray()).put("currentIndex", -1)
        preferences.edit().clear().apply()
        NativePlayer.send(snapshotState().put("type", "snapshot").put("currentIndex", -1).put("playing", false).put("loading", false))
        MediaBridge.publish(null)
    }
    fun applyVolume() { player.volume = if (muted) 0f else volume }
    fun output(id: Int?) {
        val manager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val device = manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS).firstOrNull { it.id == id }
        NativePlayer.preferredDeviceId = device?.id
        player.setPreferredAudioDevice(device)
    }
    private fun state(): JSONObject = JSONObject()
        .put("serverId", queue.opt("serverId"))
        .put("currentIndex", player.currentMediaItemIndex).put("position", player.currentPosition.coerceAtLeast(0) / 1000.0)
        .put("playing", wantsToPlay && player.playbackSuppressionReason == Player.PLAYBACK_SUPPRESSION_REASON_NONE)
        .put("loading", player.playbackState == Player.STATE_BUFFERING)
        .put("duration", player.duration.takeIf { it > 0 && it != C.TIME_UNSET }?.div(1000.0) ?: 0.0)
        .put("volume", volume.toDouble()).put("muted", muted)
    private fun snapshotState(): JSONObject {
        val result = state()
        for (key in listOf("repeat", "shuffle", "radio", "sourceName")) result.put(key, queue.opt(key))
        val safeItems = JSONArray()
        val items = queue.optJSONArray("items") ?: JSONArray()
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            safeItems.put(JSONObject().put("id", item.optString("id")).put("song", item.getJSONObject("song")))
        }
        return result.put("items", safeItems)
    }
    fun snapshot() {
        if (inUse) NativePlayer.send(snapshotState().put("type", "snapshot"))
        else {
            val recovery = preferences.getString("snapshot", null)
            NativePlayer.send((recovery?.let(::JSONObject) ?: JSONObject()).put("type", "recovery"))
        }
    }
    private fun publish() {
        if (!inUse || updatingQueue) return
        val state = state()
        val item = queue.getJSONArray("items").optJSONObject(player.currentMediaItemIndex) ?: return
        val song = item.optJSONObject("song") ?: item
        MediaBridge.publish(MediaBridge.NowPlaying(song.optString("title"), song.optString("artist"), song.optString("album"), item.optString("artworkUrl").takeIf { it.isNotBlank() }, state.getBoolean("playing"), state.getBoolean("loading"), state.getDouble("position"), state.getDouble("duration"), player.mediaItemCount > 1, player.mediaItemCount > 0))
        NativePlayer.send(state.put("type", "state").put("transition", transition))
        transition = false
        if (!wantsToPlay || System.currentTimeMillis() - lastPersisted > 5000) { persist(); lastPersisted = System.currentTimeMillis() }
        scheduleTick()
    }
    private fun persist() {
        if (!inUse) return
        val state = snapshotState()
        preferences.edit().putString("snapshot", state.toString()).apply()
    }
    fun release() { persist(); main.removeCallbacks(ticker); player.release() }
}
