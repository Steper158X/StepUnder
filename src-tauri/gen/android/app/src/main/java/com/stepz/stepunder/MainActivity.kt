package com.stepz.stepunder

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
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
    webView.settings.setSupportZoom(false)
    webView.settings.builtInZoomControls = false
    webView.settings.displayZoomControls = false
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        if (ViewCompat.getRootWindowInsets(webView)?.isVisible(WindowInsetsCompat.Type.ime()) == true) {
          ViewCompat.getWindowInsetsController(webView)?.hide(WindowInsetsCompat.Type.ime())
          return
        }
        webView.evaluateJavascript("window.__stepunderBack?.() === true") { consumed ->
          if (consumed != "true") {
            isEnabled = false
            onBackPressedDispatcher.onBackPressed()
            isEnabled = true
          }
        }
      }
    })
    // Media notification, lock screen, Bluetooth buttons and Android Auto.
    MediaBridge.attach(webView)
    // ExoPlayer: the playback engine the page drives.
    NativePlayer.attach(webView)
    // Speaker / Bluetooth list and the system output switcher.
    AudioOutputs.attach(webView)
  }

  override fun onDestroy() {
    NativePlayer.detach()
    MediaBridge.detach()
    super.onDestroy()
  }
}
