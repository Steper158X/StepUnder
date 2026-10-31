//! Song downloads. Files are streamed from the server straight to disk so the
//! audio never passes through the webview. The UI decides where each file goes;
//! this side only queues, writes, reports progress and cleans up.

use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_http::reqwest;
use tokio::io::AsyncWriteExt;

const MAX_CONCURRENCY: usize = 5;
const PROGRESS_INTERVAL: Duration = Duration::from_millis(250);

#[derive(Clone, Deserialize)]
pub struct DownloadJob {
    id: String,
    url: String,
    dest: String,
}

#[derive(Serialize)]
pub struct DiskSpace {
    /// Drive or mount the folder lives on, e.g. `F:\`.
    drive: String,
    available: u64,
    total: u64,
}

#[derive(Clone, Serialize)]
struct ProgressPayload<'a> {
    id: &'a str,
    received: u64,
    total: Option<u64>,
}

#[derive(Clone, Serialize)]
struct DonePayload<'a> {
    id: &'a str,
    path: &'a str,
    size: u64,
}

#[derive(Clone, Serialize)]
struct ErrorPayload<'a> {
    id: &'a str,
    error: String,
    cancelled: bool,
}

struct Queue {
    pending: VecDeque<DownloadJob>,
    active: usize,
    limit: usize,
    /// Cancel flags of running jobs.
    running: HashMap<String, Arc<AtomicBool>>,
}

pub struct DownloadManager {
    queue: Arc<Mutex<Queue>>,
    client: reqwest::Client,
}

impl Default for DownloadManager {
    fn default() -> Self {
        Self {
            queue: Arc::new(Mutex::new(Queue {
                pending: VecDeque::new(),
                active: 0,
                limit: 3,
                running: HashMap::new(),
            })),
            client: reqwest::Client::new(),
        }
    }
}

impl DownloadManager {
    /// Starts queued jobs until the concurrency limit is reached.
    fn pump(&self, app: &AppHandle) {
        let mut queue = self.queue.lock().unwrap();
        while queue.active < queue.limit {
            let Some(job) = queue.pending.pop_front() else {
                break;
            };
            let cancel = Arc::new(AtomicBool::new(false));
            queue.active += 1;
            queue.running.insert(job.id.clone(), cancel.clone());

            let app = app.clone();
            let client = self.client.clone();
            tauri::async_runtime::spawn(async move {
                let result = run_job(&app, &client, &job, &cancel).await;
                let cancelled = cancel.load(Ordering::Relaxed);
                match result {
                    Ok(size) => {
                        let _ = app.emit(
                            "download://done",
                            DonePayload { id: &job.id, path: &job.dest, size },
                        );
                    }
                    Err(error) => {
                        let _ = app.emit(
                            "download://error",
                            ErrorPayload { id: &job.id, error, cancelled },
                        );
                    }
                }
                let manager = app.state::<DownloadManager>();
                {
                    let mut queue = manager.queue.lock().unwrap();
                    queue.active -= 1;
                    queue.running.remove(&job.id);
                }
                manager.pump(&app);
            });
        }
    }
}

async fn run_job(
    app: &AppHandle,
    client: &reqwest::Client,
    job: &DownloadJob,
    cancel: &AtomicBool,
) -> Result<u64, String> {
    let dest = PathBuf::from(&job.dest);
    if !dest.is_absolute() {
        return Err("Download path must be absolute".into());
    }
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|error| error.to_string())?;
    }
    let part = part_path(&dest);

    let result = write_part(app, client, job, &part, cancel).await;
    match result {
        Ok(size) => {
            tokio::fs::rename(&part, &dest)
                .await
                .map_err(|error| error.to_string())?;
            Ok(size)
        }
        Err(error) => {
            let _ = tokio::fs::remove_file(&part).await;
            Err(error)
        }
    }
}

async fn write_part(
    app: &AppHandle,
    client: &reqwest::Client,
    job: &DownloadJob,
    part: &Path,
    cancel: &AtomicBool,
) -> Result<u64, String> {
    let mut response = client
        .get(&job.url)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }
    // Subsonic reports API errors as a 200 with an XML/JSON body.
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if content_type.contains("xml") || content_type.contains("json") {
        let body = response.text().await.unwrap_or_default();
        return Err(subsonic_error(&body));
    }

    let total = response.content_length();
    let mut file = tokio::fs::File::create(part)
        .await
        .map_err(|error| error.to_string())?;
    let mut received = 0u64;
    let mut last_report = Instant::now();
    let _ = app.emit(
        "download://progress",
        ProgressPayload { id: &job.id, received, total },
    );

    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        if cancel.load(Ordering::Relaxed) {
            return Err("Cancelled".into());
        }
        file.write_all(&chunk)
            .await
            .map_err(|error| error.to_string())?;
        received += chunk.len() as u64;
        if last_report.elapsed() >= PROGRESS_INTERVAL {
            last_report = Instant::now();
            let _ = app.emit(
                "download://progress",
                ProgressPayload { id: &job.id, received, total },
            );
        }
    }
    file.flush().await.map_err(|error| error.to_string())?;
    if received == 0 {
        return Err("The server sent an empty file".into());
    }
    Ok(received)
}

fn part_path(dest: &Path) -> PathBuf {
    let mut name = dest.file_name().unwrap_or_default().to_os_string();
    name.push(".part");
    dest.with_file_name(name)
}

/// Pulls the `message` out of a Subsonic error body, XML or JSON.
fn subsonic_error(body: &str) -> String {
    if let Some(start) = body.find("message=\"") {
        let rest = &body[start + 9..];
        if let Some(end) = rest.find('"') {
            return rest[..end].to_string();
        }
    }
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(body)
        && let Some(message) = json
            .pointer("/subsonic-response/error/message")
            .and_then(|value| value.as_str())
    {
        return message.to_string();
    }
    "The server returned an error instead of audio".into()
}

/// True when `path` sits inside `root` (both must exist).
fn is_inside(root: &Path, path: &Path) -> bool {
    match (root.canonicalize(), path.canonicalize()) {
        (Ok(root), Ok(path)) => path.starts_with(&root) && path != root,
        _ => false,
    }
}

#[tauri::command]
pub fn download_enqueue(
    app: AppHandle,
    manager: tauri::State<'_, DownloadManager>,
    jobs: Vec<DownloadJob>,
) {
    {
        let mut queue = manager.queue.lock().unwrap();
        for job in jobs {
            let queued = queue.pending.iter().any(|item| item.id == job.id);
            if !queued && !queue.running.contains_key(&job.id) {
                queue.pending.push_back(job);
            }
        }
    }
    manager.pump(&app);
}

#[tauri::command]
pub fn download_cancel(manager: tauri::State<'_, DownloadManager>, ids: Vec<String>) {
    let mut queue = manager.queue.lock().unwrap();
    queue.pending.retain(|job| !ids.contains(&job.id));
    for id in &ids {
        if let Some(flag) = queue.running.get(id) {
            flag.store(true, Ordering::Relaxed);
        }
    }
}

#[tauri::command]
pub fn download_set_concurrency(
    app: AppHandle,
    manager: tauri::State<'_, DownloadManager>,
    limit: usize,
) {
    manager.queue.lock().unwrap().limit = limit.clamp(1, MAX_CONCURRENCY);
    manager.pump(&app);
}

/// Deletes downloaded files under `root`, then any folders left empty.
#[tauri::command]
pub fn download_delete(root: String, paths: Vec<String>) -> Result<(), String> {
    let root = PathBuf::from(root);
    for path in paths {
        let path = PathBuf::from(path);
        if !is_inside(&root, &path) || !path.is_file() {
            continue;
        }
        std::fs::remove_file(&path).map_err(|error| error.to_string())?;
        let mut dir = path.parent();
        while let Some(current) = dir {
            if !is_inside(&root, current) || std::fs::remove_dir(current).is_err() {
                break;
            }
            dir = current.parent();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn download_exists(paths: Vec<String>) -> Vec<bool> {
    paths.iter().map(|path| Path::new(path).is_file()).collect()
}

#[tauri::command]
pub fn default_download_dir(app: AppHandle) -> Result<String, String> {
    let base = app
        .path()
        .audio_dir()
        .or_else(|_| app.path().download_dir())
        .map_err(|error| error.to_string())?;
    Ok(base.join("StepUnder").to_string_lossy().into_owned())
}

/// Free and total space of the drive holding `path`. The folder may not exist
/// yet, so the nearest existing parent is measured instead.
#[tauri::command]
pub fn download_disk_space(path: String) -> Result<DiskSpace, String> {
    let path = PathBuf::from(path);
    let existing = path
        .ancestors()
        .find(|dir| dir.is_dir())
        .ok_or_else(|| "The download folder's drive was not found".to_string())?;
    let stats = fs4::statvfs(existing).map_err(|error| error.to_string())?;
    let drive = existing
        .ancestors()
        .last()
        .unwrap_or(existing)
        .to_string_lossy()
        .into_owned();
    Ok(DiskSpace {
        drive,
        available: stats.available_space(),
        total: stats.total_space(),
    })
}

/// Lets the web player load files from `path` through the asset protocol.
#[tauri::command]
pub fn allow_asset_dir(app: AppHandle, path: String) -> Result<(), String> {
    app.asset_protocol_scope()
        .allow_directory(&path, true)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn pick_download_dir(app: AppHandle, current: Option<String>) -> Option<String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    let mut dialog = app.dialog().file();
    if let Some(current) = current.filter(|path| Path::new(path).is_dir()) {
        dialog = dialog.set_directory(current);
    }
    dialog.pick_folder(move |folder| {
        let _ = tx.send(folder.and_then(|folder| folder.into_path().ok()));
    });
    rx.await
        .ok()
        .flatten()
        .map(|path| path.to_string_lossy().into_owned())
}

/// Opens the folder in the file manager, creating it first if needed.
#[tauri::command]
pub fn reveal_download(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if path.is_file() {
        return tauri_plugin_opener::reveal_item_in_dir(&path).map_err(|error| error.to_string());
    }
    std::fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    tauri_plugin_opener::open_path(&path, None::<&str>).map_err(|error| error.to_string())
}
