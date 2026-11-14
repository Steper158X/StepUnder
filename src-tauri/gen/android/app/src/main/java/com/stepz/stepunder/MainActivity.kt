package com.stepz.stepunder

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import com.stepz.stepunder.media.AudioOutputs
import com.stepz.stepunder.media.MediaBridge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    // Media notification, lock screen, Bluetooth buttons and Android Auto.
    MediaBridge.attach(webView)
    // Speaker / Bluetooth list and the system output switcher.
    AudioOutputs.attach(webView)
  }

  override fun onDestroy() {
    // The music plays inside this activity's WebView, so it stops here.
    MediaBridge.detach(this)
    super.onDestroy()
  }
}
