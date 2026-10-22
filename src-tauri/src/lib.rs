mod mpv;

use keyring::Entry;
use tauri::webview::{PermissionKind, PermissionResponse};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .manage(mpv::MpvManager::default())
        // Chromium only reveals the full speaker list after getUserMedia has
        // succeeded once. The UI asks for that explicitly and immediately stops
        // the stream; only audio-output devices are ever shown.
        .on_permission_request(|_webview, kind| match kind {
            PermissionKind::Microphone => PermissionResponse::Allow,
            _ => PermissionResponse::Default,
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
            mpv::mpv_set_audio_device
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            app_handle.state::<mpv::MpvManager>().shutdown();
        }
    });
}
