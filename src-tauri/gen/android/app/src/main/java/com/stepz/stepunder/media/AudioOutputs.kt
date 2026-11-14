package com.stepz.stepunder.media

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.MediaRouter2
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference

/**
 * Audio outputs for the full screen player's output sheet.
 *
 * The music plays through [NativePlayer] (ExoPlayer), which can be sent to a
 * chosen device with `window.StepUnderPlayer.setOutput(id)`. This lists the
 * outputs, says which one media is using, and can also open Android's own
 * Output Switcher.
 *
 * The page calls `window.StepUnderOutputs.list()` and `.showSwitcher()`; when
 * a device connects or disconnects, `window.__stepunderOutputsChanged()` runs.
 */
object AudioOutputs {
    private const val TAG = "StepUnderOutputs"
    const val JS_NAME = "StepUnderOutputs"

    private val main = Handler(Looper.getMainLooper())
    private var appContext: Context? = null
    private var webView = WeakReference<WebView>(null)
    private var callbackRegistered = false

    private val deviceCallback = object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>) = notifyPage()
        override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>) = notifyPage()
    }

    fun attach(view: WebView) {
        appContext = view.context.applicationContext
        webView = WeakReference(view)
        view.addJavascriptInterface(JsInterface(), JS_NAME)
        if (!callbackRegistered) {
            audioManager()?.registerAudioDeviceCallback(deviceCallback, main)
            callbackRegistered = true
        }
    }

    private fun audioManager(): AudioManager? =
        appContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

    /** Tells the page to read the list again, e.g. after picking an output. */
    fun refresh() = notifyPage()

    private fun notifyPage() {
        main.post {
            webView.get()?.evaluateJavascript(
                "window.__stepunderOutputsChanged && window.__stepunderOutputsChanged()",
                null,
            )
        }
    }

    /** "speaker", "bluetooth", "wired" or "usb"; null for outputs not worth listing. */
    private fun kind(type: Int): String? = when (type) {
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "speaker"
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
        AudioDeviceInfo.TYPE_BLE_HEADSET,
        AudioDeviceInfo.TYPE_BLE_SPEAKER,
        AudioDeviceInfo.TYPE_BLE_BROADCAST -> "bluetooth"
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_LINE_ANALOG,
        AudioDeviceInfo.TYPE_AUX_LINE -> "wired"
        AudioDeviceInfo.TYPE_USB_HEADSET,
        AudioDeviceInfo.TYPE_USB_DEVICE,
        AudioDeviceInfo.TYPE_USB_ACCESSORY -> "usb"
        else -> null
    }

    /** Media follows the newest headset or speaker, so guess in that order. */
    private val fallbackOrder = listOf("bluetooth", "usb", "wired", "speaker")

    private fun list(): String {
        val manager = audioManager() ?: return "[]"
        val devices = manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            .mapNotNull { device -> kind(device.type)?.let { device to it } }
            // A headset shows up once per profile; keep one entry per device.
            .distinctBy { (device, kind) ->
                if (kind == "speaker") kind else "$kind:${device.productName}"
            }

        // A device picked in the app wins while it is still connected.
        val preferred = NativePlayer.preferredDeviceId
        val pickedIds: Set<Int>? = preferred
            ?.takeIf { id -> devices.any { it.first.id == id } }
            ?.let { setOf(it) }

        val activeIds: Set<Int> = pickedIds ?: if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            try {
                val attributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
                manager.getAudioDevicesForAttributes(attributes).map { it.id }.toSet()
            } catch (error: Exception) {
                Log.w(TAG, "Could not read the media route", error)
                emptySet()
            }
        } else {
            emptySet()
        }

        // Older Android cannot say, and the reported device may be one we
        // filtered out; then guess from what is connected.
        val activeKind = devices.firstOrNull { (device, _) -> device.id in activeIds }?.second
            ?: fallbackOrder.firstOrNull { wanted -> devices.any { it.second == wanted } }

        val result = JSONArray()
        var marked = false
        for ((device, kind) in devices) {
            val active = !marked && (
                device.id in activeIds ||
                    (activeIds.isEmpty() && kind == activeKind)
                )
            if (active) marked = true
            result.put(
                JSONObject()
                    .put("id", device.id)
                    .put("kind", kind)
                    .put("name", if (kind == "speaker") "" else device.productName?.toString().orEmpty())
                    .put("active", active),
            )
        }
        return result.toString()
    }

    /**
     * Opens Android's Output Switcher. Returns "switcher" when it opened, or
     * "settings" when only the Bluetooth settings could be shown instead.
     */
    private fun showSwitcher(): String {
        val context = appContext ?: return "none"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            try {
                if (MediaRouter2.getInstance(context).showSystemOutputSwitcher()) return "switcher"
            } catch (error: Exception) {
                Log.w(TAG, "System output switcher failed", error)
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11-13: the same dialog, through the System UI broadcast
            // that media apps use. Some phone makers removed it.
            try {
                context.sendBroadcast(
                    Intent("com.android.systemui.action.LAUNCH_MEDIA_OUTPUT_DIALOG")
                        .setPackage("com.android.systemui")
                        .putExtra("package_name", context.packageName),
                )
                return "switcher"
            } catch (error: Exception) {
                Log.w(TAG, "Media output dialog broadcast failed", error)
            }
        }
        return try {
            context.startActivity(
                Intent(Settings.ACTION_BLUETOOTH_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            "settings"
        } catch (error: ActivityNotFoundException) {
            "none"
        }
    }

    private class JsInterface {
        @JavascriptInterface
        fun list(): String = AudioOutputs.list()

        /**
         * Runs on the WebView's bridge thread. MediaRouter2, sendBroadcast and
         * startActivity are all safe off the main thread, so there is no need
         * to block the page's JavaScript waiting for a busy main thread.
         */
        @JavascriptInterface
        fun showSwitcher(): String = AudioOutputs.showSwitcher()
    }
}
