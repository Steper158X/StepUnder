//! Disk cache for cover art, served to the webview through the `cover://`
//! URI scheme (`http://cover.localhost/` on Windows).
//!
//! The page asks for `cover://localhost/<percent-encoded getCoverArt URL>`.
//! The cache key ignores the Subsonic auth params, so a cover downloaded once
//! is reused across sessions and logins. Entries older than the configured
//! max age are refetched, but still served if the server can't be reached.
//! A `_v` param (bumped after a playlist cover upload) forces one refetch per
//! value. The page configures the cache with `cover_cache_configure`.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, SystemTime};

use serde::Serialize;
use tauri::http::{Request, Response, StatusCode, header};
use tauri::{AppHandle, Manager, Runtime, Url, UriSchemeContext, UriSchemeResponder};
use tauri_plugin_http::reqwest;
use tokio::sync::{Mutex as AsyncMutex, Semaphore};

pub const SCHEME: &str = "cover";

const MB: u64 = 1024 * 1024;
const MAX_COVER_BYTES: usize = 16 * 1024 * 1024;
const MAX_COVER_REQUESTS: usize = 8;
const COVER_LOCK_SHARDS: usize = 32;
const DAY_SECS: u64 = 24 * 60 * 60;
/// Defaults until the page sends the saved settings.
const DEFAULT_MAX_BYTES: u64 = 512 * MB;
const DEFAULT_MAX_AGE_SECS: u64 = 14 * DAY_SECS;
/// Smallest size limit accepted, so the cache can still hold a page of covers.
const MIN_MAX_BYTES: u64 = 32 * MB;
/// Re-check the size limit after this many new files.
const PRUNE_EVERY_WRITES: u64 = 200;
/// Query params that only carry auth/format, never which image is returned.
const IGNORED_PARAMS: &[&str] = &["u", "t", "s", "p", "v", "c", "f", "_v"];

pub struct CoverCache {
    client: reqwest::Client,
    requests: Semaphore,
    key_locks: Vec<AsyncMutex<()>>,
    /// Latest successfully refreshed version per cover key.
    refreshed: Mutex<HashMap<String, String>>,
    temp_counter: AtomicU64,
    /// When off, covers are passed straight through without touching disk.
    enabled: AtomicBool,
    max_bytes: AtomicU64,
    /// 0 keeps cached covers forever.
    max_age_secs: AtomicU64,
    writes_since_prune: AtomicU64,
}

impl Default for CoverCache {
    fn default() -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
            requests: Semaphore::new(MAX_COVER_REQUESTS),
            key_locks: (0..COVER_LOCK_SHARDS).map(|_| AsyncMutex::new(())).collect(),
            refreshed: Mutex::new(HashMap::new()),
            temp_counter: AtomicU64::new(0),
            enabled: AtomicBool::new(true),
            max_bytes: AtomicU64::new(DEFAULT_MAX_BYTES),
            max_age_secs: AtomicU64::new(DEFAULT_MAX_AGE_SECS),
            writes_since_prune: AtomicU64::new(0),
        }
    }
}

fn cache_dir<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_cache_dir().ok().map(|dir| dir.join("covers"))
}

/// FNV-1a: stable across builds, unlike `DefaultHasher`.
fn fnv1a(text: &str) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in text.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0100_0000_01b3);
    }
    hash
}

fn percent_decode(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = std::str::from_utf8(bytes.get(i + 1..i + 3)?).ok()?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

struct Target {
    upstream: Url,
    key: String,
    version: Option<String>,
}

/// Decodes and validates the upstream URL; only Subsonic cover requests pass.
fn parse_target(uri: &str) -> Option<Target> {
    let uri: Url = uri.parse().ok()?;
    let upstream: Url = percent_decode(uri.path().trim_start_matches('/'))?
        .parse()
        .ok()?;
    if !matches!(upstream.scheme(), "http" | "https") {
        return None;
    }
    let endpoint = upstream.path().rsplit('/').next().unwrap_or_default();
    if endpoint != "getCoverArt" && endpoint != "getCoverArt.view" {
        return None;
    }

    let mut params: Vec<(String, String)> = upstream
        .query_pairs()
        .filter(|(name, _)| !IGNORED_PARAMS.contains(&name.as_ref()))
        .map(|(name, value)| (name.into_owned(), value.into_owned()))
        .collect();
    params.sort();
    let version = upstream
        .query_pairs()
        .find(|(name, _)| name == "_v")
        .map(|(_, value)| value.into_owned());

    let mut identity = format!(
        "{}://{}:{}{}",
        upstream.scheme(),
        upstream.host_str()?,
        upstream.port_or_known_default().unwrap_or_default(),
        upstream.path()
    );
    for (name, value) in &params {
        identity.push_str(&format!("&{name}={value}"));
    }
    Some(Target {
        upstream,
        key: format!("{:016x}", fnv1a(&identity)),
        version,
    })
}

fn sniff_type(bytes: &[u8]) -> &'static str {
    match bytes {
        [0xFF, 0xD8, 0xFF, ..] => "image/jpeg",
        [0x89, b'P', b'N', b'G', ..] => "image/png",
        [b'G', b'I', b'F', b'8', ..] => "image/gif",
        [b'R', b'I', b'F', b'F', _, _, _, _, b'W', b'E', b'B', b'P', ..] => "image/webp",
        _ if bytes.starts_with(b"<svg") || bytes.starts_with(b"<?xml") => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

fn image_response(bytes: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, sniff_type(&bytes))
        // Lets the webview keep decoded covers in memory, and lets
        // canvas code (cover colors) read them without tainting.
        .header(header::CACHE_CONTROL, "public, max-age=86400")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(bytes)
        .unwrap_or_default()
}

fn error_response(status: StatusCode) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Vec::new())
        .unwrap_or_default()
}

async fn fetch(client: &reqwest::Client, url: &Url) -> Result<Vec<u8>, String> {
    let mut response = client
        .get(url.as_str())
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }
    // Subsonic reports errors as a 200 with an XML/JSON body.
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !content_type.starts_with("image/") {
        return Err(format!("unexpected content type {content_type}"));
    }
    if response.content_length().is_some_and(|size| size > MAX_COVER_BYTES as u64) {
        return Err("cover exceeds size limit".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        if chunk.len() > MAX_COVER_BYTES - bytes.len() {
            return Err("cover exceeds size limit".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    if bytes.is_empty() {
        return Err("empty body".into());
    }
    Ok(bytes)
}

async fn read_cover(file: &Path) -> Result<Vec<u8>, std::io::Error> {
    use tokio::io::AsyncReadExt;
    let file = tokio::fs::File::open(file).await?;
    let mut bytes = Vec::new();
    file.take(MAX_COVER_BYTES as u64 + 1).read_to_end(&mut bytes).await?;
    if bytes.is_empty() || bytes.len() > MAX_COVER_BYTES {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "invalid cover size"));
    }
    Ok(bytes)
}

impl CoverCache {
    async fn store<R: Runtime>(&self, app: &AppHandle<R>, dir: &Path, file: &Path, bytes: &[u8]) {
        if tokio::fs::create_dir_all(dir).await.is_err() {
            return;
        }
        // Write then rename, so a concurrent reader never sees half a file.
        let n = self.temp_counter.fetch_add(1, Ordering::Relaxed);
        let temp = file.with_extension(format!("{}-{n}.part", std::process::id()));
        if tokio::fs::write(&temp, bytes).await.is_ok()
            && tokio::fs::rename(&temp, file).await.is_err()
        {
            let _ = tokio::fs::remove_file(&temp).await;
        }
        let writes = self.writes_since_prune.fetch_add(1, Ordering::Relaxed) + 1;
        if writes >= PRUNE_EVERY_WRITES {
            self.writes_since_prune.store(0, Ordering::Relaxed);
            tauri::async_runtime::spawn(prune(app.clone()));
        }
    }

    fn is_fresh(&self, modified: SystemTime) -> bool {
        let max_age = self.max_age_secs.load(Ordering::Relaxed);
        if max_age == 0 {
            return true;
        }
        SystemTime::now()
            .duration_since(modified)
            .is_ok_and(|age| age < Duration::from_secs(max_age))
    }

    async fn serve<R: Runtime>(&self, app: &AppHandle<R>, uri: &str) -> Response<Vec<u8>> {
        let Some(target) = parse_target(uri) else {
            return error_response(StatusCode::BAD_REQUEST);
        };
        let Ok(_permit) = self.requests.acquire().await else {
            return error_response(StatusCode::SERVICE_UNAVAILABLE);
        };
        let shard = fnv1a(&target.key) as usize % self.key_locks.len();
        let _key_guard = self.key_locks[shard].lock().await;
        if !self.enabled.load(Ordering::Relaxed) {
            return match fetch(&self.client, &target.upstream).await {
                Ok(bytes) => image_response(bytes),
                Err(_) => error_response(StatusCode::BAD_GATEWAY),
            };
        }
        let dir = cache_dir(app);
        let file = dir.as_ref().map(|dir| dir.join(format!("{}.img", target.key)));

        let force = target.version.as_ref().is_some_and(|version| {
            self.refreshed
                .lock()
                .map(|versions| versions.get(&target.key) != Some(version))
                .unwrap_or(false)
        });

        if let Some(file) = &file {
            let fresh = tokio::fs::metadata(file).await.is_ok_and(|meta| {
                meta.len() <= MAX_COVER_BYTES as u64 &&
                meta.modified().is_ok_and(|modified| self.is_fresh(modified))
            });
            if fresh && !force {
                if let Ok(bytes) = read_cover(file).await {
                    return image_response(bytes);
                }
            }
        }

        match fetch(&self.client, &target.upstream).await {
            Ok(bytes) => {
                if let (Some(dir), Some(file)) = (&dir, &file) {
                    self.store(app, dir, file, &bytes).await;
                }
                if let Some(version) = target.version {
                    if let Ok(mut versions) = self.refreshed.lock() {
                        if versions.len() >= 1024 && !versions.contains_key(&target.key) {
                            versions.clear();
                        }
                        versions.insert(target.key, version);
                    }
                }
                image_response(bytes)
            }
            Err(_) => {
                if let Some(file) = &file {
                    if let Ok(bytes) = read_cover(file).await {
                        return image_response(bytes);
                    }
                }
                error_response(StatusCode::BAD_GATEWAY)
            },
        }
    }
}

/// Handler for `register_asynchronous_uri_scheme_protocol`.
pub fn handle<R: Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let app = ctx.app_handle().clone();
    let uri = request.uri().to_string();
    tauri::async_runtime::spawn(async move {
        let response = app.state::<CoverCache>().serve(&app, &uri).await;
        responder.respond(response);
    });
}

/// Every cached file with its size and last-write time.
async fn entries(dir: &Path) -> Vec<(PathBuf, u64, SystemTime)> {
    let mut found = Vec::new();
    let Ok(mut reader) = tokio::fs::read_dir(dir).await else {
        return found;
    };
    while let Ok(Some(entry)) = reader.next_entry().await {
        if let Ok(meta) = entry.metadata().await
            && meta.is_file()
        {
            let modified = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);
            found.push((entry.path(), meta.len(), modified));
        }
    }
    found
}

/// Drops leftover temp files and the oldest covers beyond the size limit.
pub async fn prune<R: Runtime>(app: AppHandle<R>) {
    let Some(dir) = cache_dir(&app) else { return };
    let max_bytes = app.state::<CoverCache>().max_bytes.load(Ordering::Relaxed);
    let mut files = entries(&dir).await;
    let mut kept = Vec::with_capacity(files.len());
    for (path, size, modified) in files.drain(..) {
        if path.extension().is_some_and(|ext| ext == "part") {
            let _ = tokio::fs::remove_file(&path).await;
        } else {
            kept.push((path, size, modified));
        }
    }
    let mut total: u64 = kept.iter().map(|(_, size, _)| size).sum();
    kept.sort_by_key(|(_, _, modified)| *modified);
    for (path, size, _) in kept {
        if total <= max_bytes {
            break;
        }
        if tokio::fs::remove_file(&path).await.is_ok() {
            total = total.saturating_sub(size);
        }
    }
}

#[derive(Serialize)]
pub struct CacheStats {
    files: usize,
    bytes: u64,
}

#[tauri::command]
pub async fn cover_cache_stats(app: AppHandle) -> CacheStats {
    let files = match cache_dir(&app) {
        Some(dir) => entries(&dir).await,
        None => Vec::new(),
    };
    CacheStats {
        files: files.len(),
        bytes: files.iter().map(|(_, size, _)| size).sum(),
    }
}

/// Applies the saved settings and trims the cache to the new size limit.
#[tauri::command]
pub async fn cover_cache_configure(
    app: AppHandle,
    enabled: bool,
    max_mb: u64,
    max_days: u64,
) {
    let cache = app.state::<CoverCache>();
    cache.enabled.store(enabled, Ordering::Relaxed);
    cache
        .max_bytes
        .store(max_mb.saturating_mul(MB).max(MIN_MAX_BYTES), Ordering::Relaxed);
    cache
        .max_age_secs
        .store(max_days.saturating_mul(DAY_SECS), Ordering::Relaxed);
    prune(app.clone()).await;
}

/// Folder that holds the cached covers (created so it can be opened).
#[tauri::command]
pub fn cover_cache_dir(app: AppHandle) -> Result<String, String> {
    let dir = cache_dir(&app).ok_or("no cache folder")?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn cover_cache_clear(app: AppHandle) -> Result<(), String> {
    let Some(dir) = cache_dir(&app) else { return Ok(()) };
    for (path, _, _) in entries(&dir).await {
        tokio::fs::remove_file(&path)
            .await
            .map_err(|error| error.to_string())?;
    }
    if let Ok(mut set) = app.state::<CoverCache>().refreshed.lock() {
        set.clear();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wrap(url: &str) -> String {
        let encoded: String = url
            .bytes()
            .map(|b| match b {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    (b as char).to_string()
                }
                _ => format!("%{b:02X}"),
            })
            .collect();
        format!("http://cover.localhost/{encoded}")
    }

    #[test]
    fn key_ignores_auth_params() {
        let a = parse_target(&wrap(
            "https://music.example/rest/getCoverArt?u=me&t=aaa&s=x1&v=1.16&c=App&id=al-1&size=300",
        ))
        .unwrap();
        let b = parse_target(&wrap(
            "https://music.example/rest/getCoverArt?size=300&id=al-1&u=you&t=bbb&s=y2&v=1.16&c=App&_v=3",
        ))
        .unwrap();
        assert_eq!(a.key, b.key);
        assert_eq!(a.version, None);
        assert_eq!(b.version.as_deref(), Some("3"));
        assert_eq!(a.upstream.query_pairs().find(|(k, _)| k == "t").unwrap().1, "aaa");
    }

    #[test]
    fn key_depends_on_id_size_and_server() {
        let base = parse_target(&wrap("https://a.example/rest/getCoverArt?id=1&size=300")).unwrap();
        for other in [
            "https://a.example/rest/getCoverArt?id=2&size=300",
            "https://a.example/rest/getCoverArt?id=1&size=512",
            "https://b.example/rest/getCoverArt?id=1&size=300",
        ] {
            assert_ne!(parse_target(&wrap(other)).unwrap().key, base.key, "{other}");
        }
    }

    #[test]
    fn rejects_non_cover_requests() {
        assert!(parse_target(&wrap("https://a.example/rest/stream?id=1")).is_none());
        assert!(parse_target(&wrap("file:///C:/Windows/rest/getCoverArt")).is_none());
        assert!(parse_target("cover://localhost/not%20a%20url").is_none());
        assert!(parse_target(&wrap("http://a.example/rest/getCoverArt.view?id=1")).is_some());
    }

    #[test]
    fn sniffs_common_formats() {
        assert_eq!(sniff_type(&[0xFF, 0xD8, 0xFF, 0xE0]), "image/jpeg");
        assert_eq!(sniff_type(b"\x89PNG\r\n"), "image/png");
        assert_eq!(sniff_type(b"RIFF\0\0\0\0WEBPVP8 "), "image/webp");
    }
}
