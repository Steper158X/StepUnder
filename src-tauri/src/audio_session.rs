//! The web player's audio is rendered by the WebView2 browser process, so the
//! Windows volume mixer lists it as "WebView2 Manager" next to StepUnder.
//! Relabel every audio session owned by this process or its children as
//! StepUnder and give them one grouping GUID so the mixer shows one app.

use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::time::Duration;

use windows::Win32::Foundation::{CloseHandle, FILETIME};
use windows::Win32::Media::Audio::{
    eRender, IAudioSessionControl2, IAudioSessionManager2, IMMDeviceEnumerator,
    MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
    TH32CS_SNAPPROCESS,
};
use windows::Win32::System::Threading::{
    GetProcessTimes, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::core::{GUID, HSTRING, Interface};

const APP_NAME: &str = "StepUnder";
const SESSION_GROUP: GUID = GUID::from_u128(0x5f1b0c4e_7a2d_4c39_9e61_53746570556e);

/// WebView2 opens its audio session a moment after playback starts (and again
/// after the output device changes), so each request is retried on this
/// schedule (milliseconds between attempts).
const RETRY_DELAYS: [u64; 4] = [0, 500, 1500, 4000];

/// Creation time as a FILETIME tick count, or None if the process is gone or
/// cannot be queried.
fn creation_time(pid: u32) -> Option<u64> {
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut created = FILETIME::default();
        let mut exited = FILETIME::default();
        let mut kernel = FILETIME::default();
        let mut user = FILETIME::default();
        let result = GetProcessTimes(process, &mut created, &mut exited, &mut kernel, &mut user);
        let _ = CloseHandle(process);
        result.ok()?;
        Some((u64::from(created.dwHighDateTime) << 32) | u64::from(created.dwLowDateTime))
    }
}

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
    let mut pending = vec![(own, creation_time(own))];
    while let Some((pid, parent_created)) = pending.pop() {
        for &child in children.get(&pid).into_iter().flatten() {
            if tree.contains(&child) {
                continue;
            }
            // th32ParentProcessID is never cleared, so a process whose real
            // parent died may name a PID that was since reused by us. A true
            // child is always created after its parent.
            let child_created = creation_time(child);
            let started_after = match (parent_created, child_created) {
                (Some(parent), Some(child)) => child >= parent,
                _ => false,
            };
            if started_after {
                tree.insert(child);
                pending.push((child, child_created));
            }
        }
    }
    tree
}

/// Returns how many sessions were (re)labelled.
fn claim_once(name: &HSTRING, icon: &HSTRING) -> windows::core::Result<usize> {
    let tree = own_process_tree();
    let mut claimed = 0;
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let devices = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
        for i in 0..devices.GetCount()? {
            // One flaky endpoint (e.g. a headset mid-disconnect) must not stop
            // the device that is actually playing from being claimed.
            let Ok(sessions) = devices
                .Item(i)
                .and_then(|device| device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None))
                .and_then(|manager| manager.GetSessionEnumerator())
            else {
                continue;
            };
            let Ok(count) = sessions.GetCount() else {
                continue;
            };
            for j in 0..count {
                let Ok(control) = sessions.GetSession(j) else {
                    continue;
                };
                let Ok(control2) = control.cast::<IAudioSessionControl2>() else {
                    continue;
                };
                if !control2.GetProcessId().is_ok_and(|pid| tree.contains(&pid)) {
                    continue;
                }
                let _ = control.SetDisplayName(name, &GUID::zeroed());
                if !icon.is_empty() {
                    let _ = control.SetIconPath(icon, &GUID::zeroed());
                }
                let _ = control.SetGroupingParam(&SESSION_GROUP, &GUID::zeroed());
                claimed += 1;
            }
        }
    }
    Ok(claimed)
}

/// One long-lived worker runs the retry schedule. A request that arrives
/// mid-schedule restarts it instead of starting another overlapping scan.
fn spawn_worker() -> Sender<()> {
    let (sender, requests) = mpsc::channel::<()>();
    std::thread::spawn(move || {
        // The thread lives as long as the app, so COM is never uninitialized.
        let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        let name = HSTRING::from(APP_NAME);
        let icon = std::env::current_exe()
            .map(|exe| HSTRING::from(format!("{},0", exe.display())))
            .unwrap_or_default();
        while requests.recv().is_ok() {
            let mut step = 0;
            while step < RETRY_DELAYS.len() {
                match requests.recv_timeout(Duration::from_millis(RETRY_DELAYS[step])) {
                    Ok(()) => step = 0,
                    Err(RecvTimeoutError::Timeout) => {
                        if let Err(error) = claim_once(&name, &icon) {
                            eprintln!("audio session: {error}");
                        }
                        step += 1;
                    }
                    Err(RecvTimeoutError::Disconnected) => return,
                }
            }
        }
    });
    sender
}

#[tauri::command]
pub fn claim_audio_sessions() {
    static WORKER: OnceLock<Sender<()>> = OnceLock::new();
    let _ = WORKER.get_or_init(spawn_worker).send(());
}
