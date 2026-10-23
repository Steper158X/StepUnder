mod discord;
mod mpv;

use keyring::Entry;
use tauri::webview::{PageLoadEvent, PermissionKind, PermissionResponse};
use tauri::Manager;

#[tauri::command]
fn save_secret(service: String, account: String, secret: String) -> Result<(), String> {
    let entry = Entry::new(&service, &account).map_err(|error| error.to_string())?;
    entry
        .set_password(&secret)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_secret(service: String, account: String) -> Result<Option<String>, String> {
    let entry = Entry::new(&service, &account).map_err(|error| error.to_string())?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn delete_secret(service: String, account: String) -> Result<(), String> {
    let entry = Entry::new(&service, &account).map_err(|error| error.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

/// Asks WebView2 to trim its working set while the window is minimized and
/// restores the normal target when it comes back. Scripts (and the built-in
/// audio engine) keep running either way.
#[cfg(windows)]
fn set_webview_memory_low(window: &tauri::Window, low: bool) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
    };
    use windows_core::Interface;

    let Some(webview) = window.app_handle().get_webview_window(window.label()) else {
        return;
    };
    let level = if low {
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
    } else {
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
    };
    let _ = webview.with_webview(move |platform| unsafe {
        // Older WebView2 runtimes lack ICoreWebView2_19; ignore them.
        if let Ok(core) = platform.controller().CoreWebView2()
            && let Ok(core) = core.cast::<ICoreWebView2_19>()
        {
            let _ = core.SetMemoryUsageTargetLevel(level);
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(mpv::MpvManager::default())
        .manage(discord::DiscordManager::default())
        // A webview reload (F5, dev-server reload) tears down the page but not
        // libmpv, so stop the engine before the new document starts.
        .on_page_load(|webview, payload| {
            if matches!(payload.event(), PageLoadEvent::Started) {
                webview
                    .app_handle()
                    .state::<mpv::MpvManager>()
                    .stop_if_running();
            }
        })
        // Chromium only reveals the full speaker list after getUserMedia has
        // succeeded once. The UI asks for that explicitly and immediately stops
        // the stream; only audio-output devices are ever shown.
        .on_permission_request(|_webview, kind| match kind {
            PermissionKind::Microphone => PermissionResponse::Allow,
            _ => PermissionResponse::Default,
        })
        .on_window_event(|_window, _event| {
            #[cfg(windows)]
            if let tauri::WindowEvent::Resized(_) = _event {
                set_webview_memory_low(_window, _window.is_minimized().unwrap_or(false));
            }
        })
        .invoke_handler(tauri::generate_handler![
            save_secret,
            get_secret,
            delete_secret,
            mpv::mpv_status,
            mpv::mpv_ensure,
            mpv::mpv_load,
            mpv::mpv_pause,
            mpv::mpv_seek,
            mpv::mpv_set_volume,
            mpv::mpv_set_mute,
            mpv::mpv_stop,
            mpv::mpv_audio_devices,
            mpv::mpv_set_audio_device,
            discord::discord_update_presence,
            discord::discord_clear_presence
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            app_handle.state::<mpv::MpvManager>().shutdown();
            app_handle.state::<discord::DiscordManager>().shutdown();
        }
    });
}
