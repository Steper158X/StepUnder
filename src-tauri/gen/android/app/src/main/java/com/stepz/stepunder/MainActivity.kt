package com.stepz.stepunder

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import com.stepz.stepunder.media.AudioOutputs
import com.stepz.stepunder.media.MediaBridge
import com.stepz.stepunder.media.NativePlayer

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    // Media notification, lock screen, Bluetooth buttons and Android Auto.
    MediaBridge.attach(webView)
    // ExoPlayer: the playback engine the page drives.
    NativePlayer.attach(webView)
    // Speaker / Bluetooth list and the system output switcher.
    AudioOutputs.attach(webView)
  }

  override fun onDestroy() {
    // The queue lives in this activity's WebView, so the music stops here.
    NativePlayer.release()
    MediaBridge.detach(this)
    super.onDestroy()
  }
}
