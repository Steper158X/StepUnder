package com.stepz.stepunder.media

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.media.AudioAttributesCompat
import androidx.media.AudioFocusRequestCompat
import androidx.media.AudioManagerCompat
import androidx.media.MediaBrowserServiceCompat
import com.stepz.stepunder.R
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Keeps the app alive while music plays and publishes it to Android: the
 * media notification, lock screen controls, Bluetooth/headset buttons and
 * Android Auto (through the MediaBrowserService interface).
 *
 * Owns [PlaybackEngine], including the complete playback queue and audio focus.
 */
class PlaybackService : MediaBrowserServiceCompat() {
    companion object {
        private const val TAG = "StepUnderMedia"
        private const val CHANNEL_ID = "playback"
        private const val NOTIFICATION_ID = 1
        private const val ROOT_ID = "root"
        private const val NOW_PLAYING_ID = "now_playing"

        private const val ACTION_PLAY = "com.stepz.stepunder.media.PLAY"
        private const val ACTION_PAUSE = "com.stepz.stepunder.media.PAUSE"
        private const val ACTION_NEXT = "com.stepz.stepunder.media.NEXT"
        private const val ACTION_PREVIOUS = "com.stepz.stepunder.media.PREVIOUS"
        private const val ACTION_DISMISS = "com.stepz.stepunder.media.DISMISS"

        private const val ARTWORK_SIZE = 512
        /**
         * Browse items cross the binder with their icon inline; a 512px ARGB
         * bitmap alone is ~1 MB, the whole transaction limit.
         */
        private const val BROWSE_ICON_SIZE = 192
    }

    internal lateinit var engine: PlaybackEngine
        private set

    private val main = Handler(Looper.getMainLooper())
    private val artworkLoader = Executors.newSingleThreadExecutor()

    private lateinit var session: MediaSessionCompat
    private lateinit var notificationManager: NotificationManager
    private lateinit var audioManager: AudioManager

    private var foreground = false
    private var started = false
    private var lastMetadataKey: String? = null
    private var lastNotificationKey: String? = null

    private var artworkUrl: String? = null
    private var artwork: Bitmap? = null
    /** [artwork] scaled down for Android Auto / media browsers. */
    private var browseIcon: Bitmap? = null
    private var lastBrowseKey: String? = null

    private var focusRequest: AudioFocusRequestCompat? = null
    /** Paused by a phone call or similar; resume once it is over. */
    private var resumeOnFocusGain = false

    private var noisyRegistered = false
    private val noisyReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            // Headphones unplugged or Bluetooth disconnected: do not blast
            // the music out of the speaker.
            if (intent.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
                resumeOnFocusGain = false
                MediaBridge.dispatch("pause")
            }
        }
    }

    private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
        when (change) {
            AudioManager.AUDIOFOCUS_LOSS -> {
                resumeOnFocusGain = false
                MediaBridge.dispatch("pause")
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                if (MediaBridge.current?.playing == true) {
                    resumeOnFocusGain = true
                    MediaBridge.dispatch("pause")
                }
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                if (resumeOnFocusGain) {
                    resumeOnFocusGain = false
                    MediaBridge.dispatch("play")
                }
            }
            // Ducking is done by the system on Android 8+.
        }
    }

    private val callback = object : MediaSessionCompat.Callback() {
        override fun onPlay() {
            resumeOnFocusGain = false
            if (NativePlayer.inUse) NativePlayer.play() else MediaBridge.dispatch("play")
        }

        override fun onPause() {
            resumeOnFocusGain = false
            if (NativePlayer.inUse) NativePlayer.pause() else MediaBridge.dispatch("pause")
        }

        override fun onStop() {
            resumeOnFocusGain = false
            if (NativePlayer.inUse) NativePlayer.stop() else MediaBridge.dispatch("stop")
        }

        override fun onSkipToNext() { if (NativePlayer.inUse) NativePlayer.next() else MediaBridge.dispatch("next") }

        override fun onSkipToPrevious() { if (NativePlayer.inUse) NativePlayer.previous() else MediaBridge.dispatch("previous") }

        override fun onSeekTo(pos: Long) {
            if (NativePlayer.inUse) NativePlayer.seek(pos / 1000.0)
            else MediaBridge.dispatch("seek", pos / 1000.0)
        }

        override fun onPlayFromMediaId(mediaId: String?, extras: Bundle?) = onPlay()
    }

    override fun onCreate() {
        super.onCreate()
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        createChannel()

        session = MediaSessionCompat(this, "StepUnder").apply {
            setCallback(callback)
            launchIntent()?.let { setSessionActivity(it) }
            isActive = true
        }
        sessionToken = session.sessionToken

        MediaBridge.listener = { render(it) }
        engine = PlaybackEngine(this)
        NativePlayer.connected(this)
        MediaBridge.current?.let { render(it) }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        started = true
        // A service started with startForegroundService must call
        // startForeground, even if playback was paused in the meantime.
        if (!foreground && (intent?.action != null || MediaBridge.current?.playing == true)) {
            val state = MediaBridge.current
            if (state != null) {
                enterForeground(buildNotification(state))
                if (!keepAlive(state)) leaveForeground(keepNotification = true)
            } else {
                enterForeground(placeholderNotification())
                stopEverything()
                return START_NOT_STICKY
            }
        }

        when (intent?.action) {
            ACTION_PLAY -> callback.onPlay()
            ACTION_PAUSE -> callback.onPause()
            ACTION_NEXT -> callback.onSkipToNext()
            ACTION_PREVIOUS -> callback.onSkipToPrevious()
            ACTION_DISMISS -> if (MediaBridge.current?.let(::keepAlive) != true) stopEverything()
        }
        // Recovery restores paused after the page resolves fresh stream URLs.
        return START_NOT_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        if (!NativePlayer.wantsToPlay) stopEverything()
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        engine.release()
        NativePlayer.disconnected(this)
        if (MediaBridge.listener != null) MediaBridge.listener = null
        abandonFocus()
        unregisterNoisy()
        artworkLoader.shutdownNow()
        session.isActive = false
        session.release()
        super.onDestroy()
    }

    // --- Android Auto / media browsers -------------------------------------

    override fun onGetRoot(
        clientPackageName: String,
        clientUid: Int,
        rootHints: Bundle?,
    ): BrowserRoot = BrowserRoot(ROOT_ID, null)

    override fun onLoadChildren(
        parentId: String,
        result: Result<MutableList<MediaBrowserCompat.MediaItem>>,
    ) {
        val items = mutableListOf<MediaBrowserCompat.MediaItem>()
        val state = MediaBridge.current
        if (parentId == ROOT_ID && state != null) {
            val description = MediaDescriptionCompat.Builder()
                .setMediaId(NOW_PLAYING_ID)
                .setTitle(state.title)
                .setSubtitle(state.artist)
                .setDescription(state.album)
                .setIconBitmap(browseIcon)
                .build()
            items.add(MediaBrowserCompat.MediaItem(description, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE))
        }
        result.sendResult(items)
    }

    // --- State -------------------------------------------------------------

    private fun render(state: NowPlaying?) {
        if (state == null) {
            stopEverything()
            return
        }
        if (!session.isActive) session.isActive = true

        if (state.artworkUrl != artworkUrl) {
            artworkUrl = state.artworkUrl
            artwork = null
            browseIcon = null
            state.artworkUrl?.let(::loadArtwork)
        }

        updateMetadata(state)
        updatePlaybackState(state)

        if (NativePlayer.inUse) {
            // ExoPlayer holds audio focus itself; a second request from this
            // service would take it away from the player.
            unregisterNoisy()
            abandonFocus()
        } else if (state.playing) {
            requestFocus()
            registerNoisy()
        } else {
            unregisterNoisy()
            if (!resumeOnFocusGain) abandonFocus()
        }

        val notificationKey = listOf(
            state.title, state.artist, state.album, state.playing,
            state.hasNext, state.hasPrevious, artwork?.hashCode(),
        ).joinToString("\u0000")
        val changed = notificationKey != lastNotificationKey
        lastNotificationKey = notificationKey

        if (keepAlive(state)) {
            if (!started) {
                // Bound only (e.g. by Android Auto): make it a started service
                // so it outlives the binding while music plays.
                try {
                    ContextCompat.startForegroundService(this, Intent(this, PlaybackService::class.java))
                    started = true
                } catch (error: Exception) {
                    Log.w(TAG, "Could not start the playback service", error)
                }
            }
            if (!foreground) enterForeground(buildNotification(state))
            else if (changed) notificationManager.notify(NOTIFICATION_ID, buildNotification(state))
        } else {
            if (foreground) leaveForeground(keepNotification = false)
            if (changed || foreground) {
                notificationManager.notify(NOTIFICATION_ID, buildNotification(state))
            }
        }

        // Media browsers only show the title, artist, album and icon; do not
        // make them reload for every play/pause or position update.
        val browseKey = listOf(state.title, state.artist, state.album, browseIcon?.hashCode())
            .joinToString("\u0000")
        if (browseKey != lastBrowseKey) {
            lastBrowseKey = browseKey
            notifyChildrenChanged(ROOT_ID)
        }
    }

    private fun updateMetadata(state: NowPlaying) {
        val key = listOf(
            state.title, state.artist, state.album, state.duration, artwork?.hashCode(),
        ).joinToString("\u0000")
        if (key == lastMetadataKey) return
        lastMetadataKey = key

        val builder = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, NOW_PLAYING_ID)
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, state.title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, state.artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, state.album)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, state.title)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, state.artist)
        if (state.duration > 0) {
            builder.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (state.duration * 1000).toLong())
        }
        artwork?.let {
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, it)
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, it)
        }
        session.setMetadata(builder.build())
    }

    private fun updatePlaybackState(state: NowPlaying) {
        var actions = PlaybackStateCompat.ACTION_PLAY or
            PlaybackStateCompat.ACTION_PAUSE or
            PlaybackStateCompat.ACTION_PLAY_PAUSE or
            PlaybackStateCompat.ACTION_STOP or
            PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID
        if (state.duration > 0) actions = actions or PlaybackStateCompat.ACTION_SEEK_TO
        if (state.hasNext) actions = actions or PlaybackStateCompat.ACTION_SKIP_TO_NEXT
        if (state.hasPrevious) actions = actions or PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS

        val code = when {
            state.playing && state.loading -> PlaybackStateCompat.STATE_BUFFERING
            state.playing -> PlaybackStateCompat.STATE_PLAYING
            else -> PlaybackStateCompat.STATE_PAUSED
        }
        val speed = if (state.playing && !state.loading) 1f else 0f
        session.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setActions(actions)
                .setState(code, (state.position * 1000).toLong(), speed, SystemClock.elapsedRealtime())
                .build(),
        )
    }

    /**
     * Stay in the foreground while music plays, and also while ExoPlayer is
     * only held silent (a phone call): the page shows that as paused, but the
     * player resumes on its own and must not be killed in the meantime.
     */
    private fun keepAlive(state: NowPlaying) =
        state.playing || (NativePlayer.inUse && NativePlayer.wantsToPlay)

    private fun stopEverything() {
        resumeOnFocusGain = false
        abandonFocus()
        unregisterNoisy()
        leaveForeground(keepNotification = false)
        notificationManager.cancel(NOTIFICATION_ID)
        lastNotificationKey = null
        lastBrowseKey = null
        session.isActive = false
        started = false
        stopSelf()
    }

    // --- Foreground + notification -----------------------------------------

    private fun enterForeground(notification: Notification) {
        try {
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            } else {
                0
            }
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
            foreground = true
        } catch (error: Exception) {
            // Android 12+ may refuse while the app is in the background; the
            // notification still shows, the process is just less protected.
            Log.w(TAG, "startForeground failed", error)
            notificationManager.notify(NOTIFICATION_ID, notification)
        }
    }

    private fun leaveForeground(keepNotification: Boolean) {
        if (!foreground) return
        ServiceCompat.stopForeground(
            this,
            if (keepNotification) ServiceCompat.STOP_FOREGROUND_DETACH else ServiceCompat.STOP_FOREGROUND_REMOVE,
        )
        foreground = false
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.media_channel_name),
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            setShowBadge(false)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        notificationManager.createNotificationChannel(channel)
    }

    private fun buildNotification(state: NowPlaying): Notification {
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_playback)
            .setContentTitle(state.title.ifBlank { getString(R.string.app_name) })
            .setContentText(state.artist)
            .setSubText(state.album.ifBlank { null })
            .setLargeIcon(artwork)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setOngoing(keepAlive(state))
            .setDeleteIntent(serviceIntent(ACTION_DISMISS, 4))
        launchIntent()?.let { builder.setContentIntent(it) }

        // Android 13+ draws the buttons from the session's PlaybackState;
        // older versions use these.
        builder.addAction(
            android.R.drawable.ic_media_previous,
            getString(R.string.media_previous),
            serviceIntent(ACTION_PREVIOUS, 0),
        )
        if (state.playing) {
            builder.addAction(
                android.R.drawable.ic_media_pause,
                getString(R.string.media_pause),
                serviceIntent(ACTION_PAUSE, 1),
            )
        } else {
            builder.addAction(
                android.R.drawable.ic_media_play,
                getString(R.string.media_play),
                serviceIntent(ACTION_PLAY, 2),
            )
        }
        builder.addAction(
            android.R.drawable.ic_media_next,
            getString(R.string.media_next),
            serviceIntent(ACTION_NEXT, 3),
        )
        builder.setStyle(
            androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(session.sessionToken)
                .setShowActionsInCompactView(0, 1, 2),
        )
        return builder.build()
    }

    private fun placeholderNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_playback)
            .setContentTitle(getString(R.string.app_name))
            .setSilent(true)
            .build()

    private fun serviceIntent(action: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, PlaybackService::class.java).setAction(action)
        val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        // The service may have stopped while paused; a plain startService from
        // the background is refused on Android 8+. onStartCommand always
        // calls startForeground, as a foreground start requires.
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && action != ACTION_DISMISS) {
            PendingIntent.getForegroundService(this, requestCode, intent, flags)
        } else {
            PendingIntent.getService(this, requestCode, intent, flags)
        }
    }

    private fun launchIntent(): PendingIntent? {
        val intent = packageManager.getLaunchIntentForPackage(packageName) ?: return null
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        return PendingIntent.getActivity(
            this,
            10,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }

    // --- Audio focus / becoming noisy --------------------------------------

    private fun requestFocus() {
        if (focusRequest != null) return
        val request = AudioFocusRequestCompat.Builder(AudioManagerCompat.AUDIOFOCUS_GAIN)
            .setAudioAttributes(
                AudioAttributesCompat.Builder()
                    .setUsage(AudioAttributesCompat.USAGE_MEDIA)
                    .setContentType(AudioAttributesCompat.CONTENT_TYPE_MUSIC)
                    .build(),
            )
            .setOnAudioFocusChangeListener(focusListener, main)
            .setWillPauseWhenDucked(false)
            .build()
        AudioManagerCompat.requestAudioFocus(audioManager, request)
        focusRequest = request
    }

    private fun abandonFocus() {
        val request = focusRequest ?: return
        AudioManagerCompat.abandonAudioFocusRequest(audioManager, request)
        focusRequest = null
    }

    private fun registerNoisy() {
        if (noisyRegistered) return
        ContextCompat.registerReceiver(
            this,
            noisyReceiver,
            IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        noisyRegistered = true
    }

    private fun unregisterNoisy() {
        if (!noisyRegistered) return
        unregisterReceiver(noisyReceiver)
        noisyRegistered = false
    }

    // --- Artwork -----------------------------------------------------------

    private fun loadArtwork(url: String) {
        if (!url.startsWith("http://") && !url.startsWith("https://")) return
        artworkLoader.execute {
            val bitmap = try {
                val connection = URL(url).openConnection() as HttpURLConnection
                connection.connectTimeout = 10_000
                connection.readTimeout = 15_000
                try {
                    connection.inputStream.use { BitmapFactory.decodeStream(it) }
                        ?.let { scaleDown(it, ARTWORK_SIZE) }
                } finally {
                    connection.disconnect()
                }
            } catch (error: Exception) {
                Log.w(TAG, "Could not load the cover art", error)
                null
            }
            val icon = bitmap?.let { scaleDown(it, BROWSE_ICON_SIZE) }
            main.post {
                // Another track may have started in the meantime.
                if (artworkUrl != url || bitmap == null) return@post
                artwork = bitmap
                browseIcon = icon
                MediaBridge.current?.let(::render)
            }
        }
    }

    private fun scaleDown(bitmap: Bitmap, size: Int): Bitmap {
        val largest = maxOf(bitmap.width, bitmap.height)
        if (largest <= size) return bitmap
        val scale = size.toFloat() / largest
        return Bitmap.createScaledBitmap(
            bitmap,
            (bitmap.width * scale).toInt().coerceAtLeast(1),
            (bitmap.height * scale).toInt().coerceAtLeast(1),
            true,
        )
    }
}

private typealias NowPlaying = MediaBridge.NowPlaying
