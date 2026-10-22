//! Optional playback engine backed by libmpv.
//!
//! libmpv is loaded at runtime instead of being linked at build time, so the
//! app still compiles and runs on machines that do not have it installed.
//! Place `libmpv-2.dll` next to the executable (or point `STEPUNDER_LIBMPV`
//! at it) and the "MPV" audio player option becomes usable.
//!
//! All playback happens on a single dedicated thread: libmpv allows commands
//! from any thread, but `mpv_wait_event` must only be called from one, so the
//! thread owns the handle and receives commands over a channel.

use std::{
    ffi::{c_char, c_double, c_int, c_void, CStr, CString},
    path::{Path, PathBuf},
    sync::{
        mpsc::{self, TryRecvError},
        Mutex, MutexGuard,
    },
    thread,
    time::{Duration, Instant},
};

use libloading::Library;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

type MpvHandle = *mut c_void;

/// The raw libmpv handle is only ever touched by the engine thread, which is
/// why wrapping it to move it into `thread::spawn` is safe.
struct EngineHandle(MpvHandle);

unsafe impl Send for EngineHandle {}

#[repr(C)]
struct MpvEvent {
    event_id: c_int,
    error: c_int,
    reply_userdata: u64,
    data: *mut c_void,
}

#[repr(C)]
struct MpvEventEndFile {
    reason: c_int,
    error: c_int,
    playlist_entry_id: i64,
    playlist_insert_id: i64,
    playlist_insert_num_entries: c_int,
}

#[repr(C)]
union MpvNodeValue {
    string: *mut c_char,
    flag: c_int,
    int64: i64,
    double_: c_double,
    list: *mut MpvNodeList,
    byte_array: *mut c_void,
}

#[repr(C)]
struct MpvNode {
    value: MpvNodeValue,
    format: c_int,
}

#[repr(C)]
struct MpvNodeList {
    num: c_int,
    values: *mut MpvNode,
    keys: *mut *mut c_char,
}

const MPV_FORMAT_STRING: c_int = 1;
const MPV_FORMAT_FLAG: c_int = 3;
const MPV_FORMAT_DOUBLE: c_int = 5;
const MPV_FORMAT_NODE: c_int = 6;
const MPV_FORMAT_NODE_ARRAY: c_int = 7;
const MPV_FORMAT_NODE_MAP: c_int = 8;

const MPV_EVENT_SHUTDOWN: c_int = 1;
const MPV_EVENT_END_FILE: c_int = 7;
const MPV_EVENT_FILE_LOADED: c_int = 8;

const MPV_END_FILE_REASON_EOF: c_int = 0;
const MPV_END_FILE_REASON_ERROR: c_int = 4;

type MpvCreate = unsafe extern "C" fn() -> MpvHandle;
type MpvInitialize = unsafe extern "C" fn(MpvHandle) -> c_int;
type MpvTerminateDestroy = unsafe extern "C" fn(MpvHandle);
type MpvSetOptionString =
    unsafe extern "C" fn(MpvHandle, *const c_char, *const c_char) -> c_int;
type MpvSetPropertyString =
    unsafe extern "C" fn(MpvHandle, *const c_char, *const c_char) -> c_int;
type MpvGetProperty =
    unsafe extern "C" fn(MpvHandle, *const c_char, c_int, *mut c_void) -> c_int;
type MpvCommand = unsafe extern "C" fn(MpvHandle, *const *const c_char) -> c_int;
type MpvWaitEvent = unsafe extern "C" fn(MpvHandle, c_double) -> *mut MpvEvent;
type MpvErrorString = unsafe extern "C" fn(c_int) -> *const c_char;
type MpvClientApiVersion = unsafe extern "C" fn() -> u64;
type MpvFreeNodeContents = unsafe extern "C" fn(*mut MpvNode);

struct Api {
    // Keeps the shared library loaded for as long as the function pointers
    // below are in use.
    _lib: Library,
    path: String,
    version: String,
    create: MpvCreate,
    initialize: MpvInitialize,
    terminate_destroy: MpvTerminateDestroy,
    set_option_string: MpvSetOptionString,
    set_property_string: MpvSetPropertyString,
    get_property: MpvGetProperty,
    command: MpvCommand,
    wait_event: MpvWaitEvent,
    error_string: MpvErrorString,
    free_node_contents: MpvFreeNodeContents,
}

// The function pointers are plain code addresses from a loaded library;
// libmpv itself is thread-safe for every call we make.
unsafe impl Send for Api {}

impl Api {
    fn load() -> Result<Self, String> {
        let mut failures = Vec::new();
        for path in library_candidates() {
            match unsafe { Library::new(&path) } {
                Ok(library) => match unsafe { Self::from_library(library, &path) } {
                    Ok(api) => return Ok(api),
                    Err(error) => failures.push(format!("{}: {error}", path.display())),
                },
                Err(error) => failures.push(format!("{}: {error}", path.display())),
            }
        }
        Err(format!(
            "libmpv was not found. Place libmpv-2.dll next to the app or set STEPUNDER_LIBMPV. Tried: {}",
            failures.join("; ")
        ))
    }

    unsafe fn from_library(library: Library, path: &Path) -> Result<Self, String> {
        unsafe fn symbol<T: Copy>(library: &Library, name: &[u8]) -> Result<T, String> {
            unsafe {
                library
                    .get::<T>(name)
                    .map(|value| *value)
                    .map_err(|error| error.to_string())
            }
        }

        let create = unsafe { symbol::<MpvCreate>(&library, b"mpv_create\0")? };
        let initialize = unsafe { symbol::<MpvInitialize>(&library, b"mpv_initialize\0")? };
        let terminate_destroy =
            unsafe { symbol::<MpvTerminateDestroy>(&library, b"mpv_terminate_destroy\0")? };
        let set_option_string =
            unsafe { symbol::<MpvSetOptionString>(&library, b"mpv_set_option_string\0")? };
        let set_property_string =
            unsafe { symbol::<MpvSetPropertyString>(&library, b"mpv_set_property_string\0")? };
        let get_property =
            unsafe { symbol::<MpvGetProperty>(&library, b"mpv_get_property\0")? };
        let command = unsafe { symbol::<MpvCommand>(&library, b"mpv_command\0")? };
        let wait_event = unsafe { symbol::<MpvWaitEvent>(&library, b"mpv_wait_event\0")? };
        let error_string =
            unsafe { symbol::<MpvErrorString>(&library, b"mpv_error_string\0")? };
        let client_api_version = unsafe {
            symbol::<MpvClientApiVersion>(&library, b"mpv_client_api_version\0")?
        };
        let free_node_contents =
            unsafe { symbol::<MpvFreeNodeContents>(&library, b"mpv_free_node_contents\0")? };

        let api_version = unsafe { client_api_version() };
        let version = format!("{}.{}", api_version >> 16, api_version & 0xffff);

        Ok(Self {
            _lib: library,
            path: path.display().to_string(),
            version,
            create,
            initialize,
            terminate_destroy,
            set_option_string,
            set_property_string,
            get_property,
            command,
            wait_event,
            error_string,
            free_node_contents,
        })
    }
}

fn library_candidates() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Ok(value) = std::env::var("STEPUNDER_LIBMPV") {
        let value = value.trim();
        if !value.is_empty() {
            paths.push(PathBuf::from(value));
        }
    }

    #[cfg(windows)]
    let names: &[&str] = &["libmpv-2.dll", "libmpv.dll", "mpv-2.dll"];
    #[cfg(target_os = "macos")]
    let names: &[&str] = &["libmpv.2.dylib", "libmpv.dylib"];
    #[cfg(all(unix, not(target_os = "macos")))]
    let names: &[&str] = &["libmpv.so.2", "libmpv.so.1", "libmpv.so"];

    // Next to the executable (the recommended place for a bundled copy).
    if let Ok(exe) = std::env::current_exe()
        && let Some(dir) = exe.parent()
    {
        for name in names {
            paths.push(dir.join(name));
        }
    }

    #[cfg(windows)]
    {
        for base in ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"] {
            if let Ok(root) = std::env::var(base) {
                for suffix in [
                    "mpv",
                    "Programs\\mpv",
                    "mpv\\libmpv",
                    "Programs\\mpv\\libmpv",
                ] {
                    for name in names {
                        paths.push(PathBuf::from(&root).join(suffix).join(name));
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    for dir in ["/opt/homebrew/lib", "/usr/local/lib", "/usr/lib"] {
        for name in names {
            paths.push(PathBuf::from(dir).join(name));
        }
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    for dir in [
        "/usr/local/lib",
        "/usr/lib",
        "/usr/lib/x86_64-linux-gnu",
        "/usr/lib/aarch64-linux-gnu",
    ] {
        for name in names {
            paths.push(PathBuf::from(dir).join(name));
        }
    }

    // Finally let the platform loader search its default paths / PATH.
    for name in names {
        paths.push(PathBuf::from(name));
    }

    paths
}

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct Snapshot {
    position: f64,
    duration: f64,
    playing: bool,
    loading: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct EndPayload {
    reason: i32,
    eof: bool,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MpvStatus {
    pub available: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub error: Option<String>,
}

impl MpvStatus {
    fn ready(api: &Api) -> Self {
        Self {
            available: true,
            path: Some(api.path.clone()),
            version: Some(api.version.clone()),
            error: None,
        }
    }

    fn missing(error: String) -> Self {
        Self {
            available: false,
            path: None,
            version: None,
            error: Some(error),
        }
    }
}

struct LoadRequest {
    url: String,
    position: f64,
    autoplay: bool,
    volume: f64,
    muted: bool,
    audio_device: Option<String>,
}

/// One entry of mpv's `audio-device-list`, exposed to the settings page.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MpvAudioDevice {
    pub id: String,
    pub label: String,
}

enum Request {
    Load(LoadRequest),
    Pause(bool),
    Seek(f64),
    Volume(f64),
    Mute(bool),
    Stop,
    ListDevices(mpsc::Sender<Vec<MpvAudioDevice>>),
    SetAudioDevice(String),
    Shutdown,
}

struct Engine {
    tx: mpsc::Sender<Request>,
    path: String,
    version: String,
}

/// Owns the optional libmpv engine. The engine is created lazily the first
/// time MPV playback or validation is requested.
#[derive(Default)]
pub struct MpvManager {
    engine: Mutex<Option<Engine>>,
}

impl MpvManager {
    fn lock(&self) -> Result<MutexGuard<'_, Option<Engine>>, String> {
        self.engine
            .lock()
            .map_err(|_| "MPV engine lock was poisoned".to_string())
    }

    fn ensure(&self, app: &AppHandle) -> Result<(String, String), String> {
        let mut guard = self.lock()?;
        if let Some(engine) = guard.as_ref() {
            return Ok((engine.path.clone(), engine.version.clone()));
        }
        let api = Api::load()?;
        let path = api.path.clone();
        let version = api.version.clone();
        let engine = spawn_engine(api, app.clone())?;
        *guard = Some(engine);
        Ok((path, version))
    }

    fn send(&self, app: &AppHandle, request: Request) -> Result<(), String> {
        self.ensure(app)?;
        let guard = self.lock()?;
        let engine = guard
            .as_ref()
            .ok_or_else(|| "MPV engine is not running".to_string())?;
        engine
            .tx
            .send(request)
            .map_err(|_| "MPV engine stopped unexpectedly".to_string())
    }

    pub fn shutdown(&self) {
        if let Ok(mut guard) = self.engine.lock()
            && let Some(engine) = guard.take()
        {
            let _ = engine.tx.send(Request::Shutdown);
        }
    }

    /// Stops playback without starting the engine. Used when the webview
    /// reloads, so a page reload cannot leave orphaned audio playing.
    pub fn stop_if_running(&self) {
        if let Ok(guard) = self.engine.lock()
            && let Some(engine) = guard.as_ref()
        {
            let _ = engine.tx.send(Request::Stop);
        }
    }
}

fn spawn_engine(api: Api, app: AppHandle) -> Result<Engine, String> {
    let handle = EngineHandle(unsafe { (api.create)() });
    if handle.0.is_null() {
        return Err("mpv_create() returned null".to_string());
    }

    // A pure audio player: no window, no video, no terminal, no key bindings.
    for (name, value) in [
        ("vo", "null"),
        ("vid", "no"),
        ("audio-display", "no"),
        ("idle", "yes"),
        ("keep-open", "no"),
        ("terminal", "no"),
        ("input-default-bindings", "no"),
        ("input-vo-keyboard", "no"),
        ("osc", "no"),
        ("force-window", "no"),
        ("audio-client-name", "StepUnder"),
    ] {
        unsafe {
            set_option(&api, handle.0, name, value);
        }
    }

    let result = unsafe { (api.initialize)(handle.0) };
    if result < 0 {
        let message = unsafe { error_text(&api, result) };
        unsafe { (api.terminate_destroy)(handle.0) };
        return Err(format!("mpv_initialize failed: {message}"));
    }

    let (tx, rx) = mpsc::channel();
    let engine = Engine {
        tx,
        path: api.path.clone(),
        version: api.version.clone(),
    };
    thread::Builder::new()
        .name("mpv-engine".to_string())
        .spawn(move || engine_loop(api, handle, rx, app))
        .map_err(|error| format!("Could not start the MPV thread: {error}"))?;
    Ok(engine)
}

fn engine_loop(api: Api, handle: EngineHandle, rx: mpsc::Receiver<Request>, app: AppHandle) {
    let handle = handle.0;
    let mut last = Snapshot::default();
    let mut last_emit = Instant::now();
    // Resume offset to apply as soon as the file has loaded.
    let mut pending_seek: Option<f64> = None;

    'outer: loop {
        loop {
            match rx.try_recv() {
                Ok(Request::Shutdown) => break 'outer,
                Ok(request) => apply_request(&api, handle, request, &app, &mut pending_seek),
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => break 'outer,
            }
        }

        let event = unsafe { (api.wait_event)(handle, 0.1) };
        if !event.is_null() {
            let event = unsafe { &*event };
            match event.event_id {
                MPV_EVENT_SHUTDOWN => break 'outer,
                MPV_EVENT_FILE_LOADED => {
                    if let Some(position) = pending_seek.take() {
                        let _ = run_command(
                            &api,
                            handle,
                            &["seek", &format!("{position:.3}"), "absolute+exact"],
                        );
                    }
                }
                MPV_EVENT_END_FILE if !event.data.is_null() => {
                    let data = unsafe { &*(event.data as *const MpvEventEndFile) };
                    let error = if data.reason == MPV_END_FILE_REASON_ERROR && data.error < 0 {
                        Some(unsafe { error_text(&api, data.error) })
                    } else {
                        None
                    };
                    let _ = app.emit(
                        "mpv:end",
                        EndPayload {
                            reason: data.reason,
                            eof: data.reason == MPV_END_FILE_REASON_EOF,
                            error,
                        },
                    );
                }
                _ => {}
            }
        }

        let snapshot = read_snapshot(&api, handle);
        let now = Instant::now();
        let engine_changed = snapshot.playing != last.playing
            || snapshot.loading != last.loading
            || snapshot.duration != last.duration;
        if snapshot != last
            && (engine_changed || now.duration_since(last_emit) >= Duration::from_millis(250))
        {
            let _ = app.emit("mpv:state", snapshot.clone());
            last = snapshot;
            last_emit = now;
        }
    }

    unsafe { (api.terminate_destroy)(handle) };
}

fn apply_request(
    api: &Api,
    handle: MpvHandle,
    request: Request,
    app: &AppHandle,
    pending_seek: &mut Option<f64>,
) {
    match request {
        Request::Load(load) => {
            if let Some(device) = load.audio_device.as_deref()
                && !device.is_empty()
            {
                unsafe {
                    set_property(api, handle, "audio-device", device);
                }
            }
            // The seek is issued once the file has actually loaded, which is
            // more reliable than the --start option set at runtime.
            *pending_seek = if load.position > 0.25 {
                Some(load.position)
            } else {
                None
            };
            if let Err(error) = run_command(api, handle, &["loadfile", &load.url, "replace"]) {
                let _ = app.emit(
                    "mpv:end",
                    EndPayload {
                        reason: MPV_END_FILE_REASON_ERROR,
                        eof: false,
                        error: Some(error),
                    },
                );
                return;
            }
            unsafe {
                set_property(
                    api,
                    handle,
                    "mute",
                    if load.muted { "yes" } else { "no" },
                );
                set_property(
                    api,
                    handle,
                    "volume",
                    &format!("{:.1}", load.volume.clamp(0.0, 1.0) * 100.0),
                );
                set_property(
                    api,
                    handle,
                    "pause",
                    if load.autoplay { "no" } else { "yes" },
                );
            }
        }
        Request::Pause(paused) => unsafe {
            set_property(api, handle, "pause", if paused { "yes" } else { "no" });
        },
        Request::Seek(seconds) => {
            let seconds = seconds.max(0.0);
            let _ = run_command(
                api,
                handle,
                &["seek", &format!("{seconds:.3}"), "absolute+exact"],
            );
        }
        Request::Volume(volume) => unsafe {
            set_property(
                api,
                handle,
                "volume",
                &format!("{:.1}", volume.clamp(0.0, 1.0) * 100.0),
            );
        },
        Request::Mute(muted) => unsafe {
            set_property(api, handle, "mute", if muted { "yes" } else { "no" });
        },
        Request::Stop => {
            *pending_seek = None;
            let _ = run_command(api, handle, &["stop"]);
        }
        Request::ListDevices(reply) => {
            let _ = reply.send(read_audio_devices(api, handle));
        }
        Request::SetAudioDevice(device) => {
            if !device.is_empty() {
                unsafe {
                    set_property(api, handle, "audio-device", &device);
                }
            }
        }
        Request::Shutdown => {}
    }
}

fn read_snapshot(api: &Api, handle: MpvHandle) -> Snapshot {
    let position = unsafe { get_double(api, handle, "time-pos") }.unwrap_or(0.0);
    let duration = unsafe { get_double(api, handle, "duration") }.unwrap_or(0.0);
    let paused = unsafe { get_flag(api, handle, "pause") }.unwrap_or(false);
    let idle = unsafe { get_flag(api, handle, "core-idle") }.unwrap_or(true);
    let buffering = unsafe { get_flag(api, handle, "paused-for-cache") }.unwrap_or(false);
    let seeking = unsafe { get_flag(api, handle, "seeking") }.unwrap_or(false);

    Snapshot {
        position: if position.is_finite() && position > 0.0 {
            position
        } else {
            0.0
        },
        duration: if duration.is_finite() && duration > 0.0 {
            duration
        } else {
            0.0
        },
        playing: !paused && !idle,
        loading: buffering || seeking,
    }
}

fn c_string(value: &str) -> Result<CString, String> {
    CString::new(value).map_err(|_| "Value contains a NUL byte".to_string())
}

unsafe fn set_option(api: &Api, handle: MpvHandle, name: &str, value: &str) {
    let Ok(name) = c_string(name) else { return };
    let Ok(value) = c_string(value) else { return };
    unsafe {
        (api.set_option_string)(handle, name.as_ptr(), value.as_ptr());
    }
}

unsafe fn set_property(api: &Api, handle: MpvHandle, name: &str, value: &str) {
    let Ok(name) = c_string(name) else { return };
    let Ok(value) = c_string(value) else { return };
    unsafe {
        (api.set_property_string)(handle, name.as_ptr(), value.as_ptr());
    }
}

fn run_command(api: &Api, handle: MpvHandle, args: &[&str]) -> Result<(), String> {
    let args = args
        .iter()
        .map(|value| c_string(value))
        .collect::<Result<Vec<_>, _>>()?;
    let mut pointers: Vec<*const c_char> = args.iter().map(|value| value.as_ptr()).collect();
    pointers.push(std::ptr::null());

    let result = unsafe { (api.command)(handle, pointers.as_ptr()) };
    if result < 0 {
        Err(unsafe { error_text(api, result) })
    } else {
        Ok(())
    }
}

unsafe fn get_double(api: &Api, handle: MpvHandle, name: &str) -> Option<f64> {
    let name = c_string(name).ok()?;
    let mut value: c_double = 0.0;
    let result = unsafe {
        (api.get_property)(
            handle,
            name.as_ptr(),
            MPV_FORMAT_DOUBLE,
            &mut value as *mut c_double as *mut c_void,
        )
    };
    (result >= 0).then_some(value)
}

unsafe fn get_flag(api: &Api, handle: MpvHandle, name: &str) -> Option<bool> {
    let name = c_string(name).ok()?;
    let mut value: c_int = 0;
    let result = unsafe {
        (api.get_property)(
            handle,
            name.as_ptr(),
            MPV_FORMAT_FLAG,
            &mut value as *mut c_int as *mut c_void,
        )
    };
    (result >= 0).then_some(value != 0)
}

fn read_audio_devices(api: &Api, handle: MpvHandle) -> Vec<MpvAudioDevice> {
    unsafe {
        let Ok(name) = c_string("audio-device-list") else {
            return Vec::new();
        };
        let mut node = MpvNode {
            value: MpvNodeValue { int64: 0 },
            format: 0,
        };
        let result = (api.get_property)(
            handle,
            name.as_ptr(),
            MPV_FORMAT_NODE,
            &mut node as *mut MpvNode as *mut c_void,
        );
        if result < 0 {
            return Vec::new();
        }

        let devices = if node.format == MPV_FORMAT_NODE_ARRAY && !node.value.list.is_null() {
            let entries = &*node.value.list;
            (0..entries.num)
                .filter_map(|index| {
                    let entry = &*entries.values.offset(index as isize);
                    let id = node_map_string(entry, "name")?;
                    if id.is_empty() {
                        return None;
                    }
                    let label = node_map_string(entry, "description").unwrap_or_default();
                    Some(MpvAudioDevice { id, label })
                })
                .collect()
        } else {
            Vec::new()
        };

        (api.free_node_contents)(&mut node);
        devices
    }
}

/// Reads one string field out of an `MPV_FORMAT_NODE_MAP` node.
unsafe fn node_map_string(node: &MpvNode, key: &str) -> Option<String> {
    if node.format != MPV_FORMAT_NODE_MAP {
        return None;
    }
    let map = unsafe { node.value.list };
    if map.is_null() {
        return None;
    }
    let list = unsafe { &*map };
    for index in 0..list.num {
        let index = index as isize;
        let key_pointer = unsafe { *list.keys.offset(index) };
        if key_pointer.is_null() {
            continue;
        }
        let entry_key = unsafe { CStr::from_ptr(key_pointer) }.to_string_lossy();
        if entry_key != key {
            continue;
        }
        let value = unsafe { &*list.values.offset(index) };
        if value.format != MPV_FORMAT_STRING {
            return None;
        }
        let text = unsafe { value.value.string };
        if text.is_null() {
            return None;
        }
        return Some(
            unsafe { CStr::from_ptr(text) }
                .to_string_lossy()
                .into_owned(),
        );
    }
    None
}

unsafe fn error_text(api: &Api, code: c_int) -> String {
    let pointer = unsafe { (api.error_string)(code) };
    if pointer.is_null() {
        format!("mpv error {code}")
    } else {
        unsafe { CStr::from_ptr(pointer) }
            .to_string_lossy()
            .into_owned()
    }
}

// ----------------------------------------------------------------- commands

#[tauri::command]
pub fn mpv_status() -> MpvStatus {
    match Api::load() {
        Ok(api) => MpvStatus::ready(&api),
        Err(error) => MpvStatus::missing(error),
    }
}

#[tauri::command]
pub fn mpv_ensure(
    app: AppHandle,
    manager: tauri::State<'_, MpvManager>,
) -> Result<MpvStatus, String> {
    let (path, version) = manager.ensure(&app)?;
    Ok(MpvStatus {
        available: true,
        path: Some(path),
        version: Some(version),
        error: None,
    })
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn mpv_load(
    app: AppHandle,
    manager: tauri::State<'_, MpvManager>,
    url: String,
    position: Option<f64>,
    autoplay: Option<bool>,
    volume: Option<f64>,
    muted: Option<bool>,
    audio_device: Option<String>,
) -> Result<(), String> {
    manager.send(
        &app,
        Request::Load(LoadRequest {
            url,
            position: position.unwrap_or(0.0),
            autoplay: autoplay.unwrap_or(true),
            volume: volume.unwrap_or(1.0),
            muted: muted.unwrap_or(false),
            audio_device,
        }),
    )
}

#[tauri::command]
pub fn mpv_pause(
    app: AppHandle,
    manager: tauri::State<'_, MpvManager>,
    paused: bool,
) -> Result<(), String> {
    manager.send(&app, Request::Pause(paused))
}

#[tauri::command]
pub fn mpv_seek(
    app: AppHandle,
    manager: tauri::State<'_, MpvManager>,
    seconds: f64,
) -> Result<(), String> {
    manager.send(&app, Request::Seek(seconds))
}

#[tauri::command]
pub fn mpv_set_volume(
    app: AppHandle,
    manager: tauri::State<'_, MpvManager>,
    volume: f64,
) -> Result<(), String> {
    manager.send(&app, Request::Volume(volume))
}

#[tauri::command]
pub fn mpv_set_mute(
    app: AppHandle,
    manager: tauri::State<'_, MpvManager>,
    muted: bool,
) -> Result<(), String> {
    manager.send(&app, Request::Mute(muted))
}

#[tauri::command]
pub fn mpv_stop(app: AppHandle, manager: tauri::State<'_, MpvManager>) -> Result<(), String> {
    manager.send(&app, Request::Stop)
}

#[tauri::command]
pub async fn mpv_audio_devices(app: AppHandle) -> Result<Vec<MpvAudioDevice>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<MpvManager>();
        let (tx, rx) = mpsc::channel();
        manager.send(&app, Request::ListDevices(tx))?;
        rx.recv_timeout(Duration::from_millis(2000))
            .map_err(|_| "MPV did not return its audio devices".to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn mpv_set_audio_device(
    app: AppHandle,
    manager: tauri::State<'_, MpvManager>,
    device: String,
) -> Result<(), String> {
    manager.send(&app, Request::SetAudioDevice(device))
}
