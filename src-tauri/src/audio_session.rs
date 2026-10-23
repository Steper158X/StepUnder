//! The web player's audio is rendered by the WebView2 browser process, so the
//! Windows volume mixer lists it as "WebView2 Manager" next to StepUnder.
//! Relabel every audio session owned by this process or its children as
//! StepUnder and give them one grouping GUID so the mixer shows one app.

use std::collections::{HashMap, HashSet};
use std::time::Duration;

use windows::Win32::Foundation::CloseHandle;
use windows::Win32::Media::Audio::{
    eRender, IAudioSessionControl2, IAudioSessionManager2, IMMDeviceEnumerator,
    MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
    TH32CS_SNAPPROCESS,
};
use windows::core::{GUID, HSTRING, Interface};

const APP_NAME: &str = "StepUnder";
const SESSION_GROUP: GUID = GUID::from_u128(0x5f1b0c4e_7a2d_4c39_9e61_53746570556e);

/// This process plus every process it (transitively) started.
fn own_process_tree() -> HashSet<u32> {
    let own = std::process::id();
    let mut tree = HashSet::from([own]);
    let mut children: HashMap<u32, Vec<u32>> = HashMap::new();
    unsafe {
        let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
            return tree;
        };
        let mut entry = PROCESSENTRY32W {
            dwSize: size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                children
                    .entry(entry.th32ParentProcessID)
                    .or_default()
                    .push(entry.th32ProcessID);
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snapshot);
    }
    let mut pending = vec![own];
    while let Some(pid) = pending.pop() {
        for &child in children.get(&pid).into_iter().flatten() {
            // Guard against PID reuse loops.
            if tree.insert(child) {
                pending.push(child);
            }
        }
    }
    tree
}

/// Returns how many sessions were (re)labelled.
fn claim_once() -> windows::core::Result<usize> {
    let tree = own_process_tree();
    let name = HSTRING::from(APP_NAME);
    let icon = std::env::current_exe()
        .map(|exe| HSTRING::from(format!("{},0", exe.display())))
        .unwrap_or_default();
    let mut claimed = 0;
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let devices = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
        for i in 0..devices.GetCount()? {
            let Ok(manager) = devices
                .Item(i)
                .and_then(|device| device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None))
            else {
                continue;
            };
            let sessions = manager.GetSessionEnumerator()?;
            for j in 0..sessions.GetCount()? {
                let Ok(control) = sessions.GetSession(j) else {
                    continue;
                };
                let Ok(control2) = control.cast::<IAudioSessionControl2>() else {
                    continue;
                };
                if !control2.GetProcessId().is_ok_and(|pid| tree.contains(&pid)) {
                    continue;
                }
                let _ = control.SetDisplayName(&name, &GUID::zeroed());
                if !icon.is_empty() {
                    let _ = control.SetIconPath(&icon, &GUID::zeroed());
                }
                let _ = control.SetGroupingParam(&SESSION_GROUP, &GUID::zeroed());
                claimed += 1;
            }
        }
    }
    Ok(claimed)
}

/// WebView2 opens its audio session a moment after playback starts (and again
/// after the output device changes), so retry a few times in the background.
#[tauri::command]
pub fn claim_audio_sessions() {
    std::thread::spawn(|| {
        let initialized = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.is_ok();
        for delay in [0, 500, 1500, 4000] {
            std::thread::sleep(Duration::from_millis(delay));
            if let Err(error) = claim_once() {
                eprintln!("audio session: {error}");
            }
        }
        if initialized {
            unsafe { CoUninitialize() };
        }
    });
}
