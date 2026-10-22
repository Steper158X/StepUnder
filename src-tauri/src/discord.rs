//! Discord Rich Presence over the local IPC socket.
//!
//! The Discord desktop client exposes a named pipe (Windows) / unix socket that
//! accepts activity updates without any SDK. Everything here is best effort:
//! when Discord is not running the commands simply report `false` and the app
//! keeps working normally.

use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};

use discord_rich_presence::activity::{
    Activity, ActivityType, Assets, StatusDisplayType, Timestamps,
};
use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
use serde::Deserialize;

/// Discord application id (Developer Portal -> Application ID). Public value.
const CLIENT_ID: &str = "1562865206067994694";

/// Give Discord time to come back before touching the socket again.
const CONNECT_RETRY: Duration = Duration::from_secs(15);
/// A live socket can still drop (Discord restarting); retry sooner in that case.
const SEND_RETRY: Duration = Duration::from_secs(3);

/// Discord truncates these fields at 128 characters.
const MAX_TEXT: usize = 128;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresencePayload {
    pub details: String,
    pub state: String,
    #[serde(default)]
    pub large_image: Option<String>,
    #[serde(default)]
    pub large_text: Option<String>,
    /// Unix milliseconds for the progress bar.
    #[serde(default)]
    pub start: Option<i64>,
    #[serde(default)]
    pub end: Option<i64>,
    #[serde(default)]
    pub paused: bool,
}

#[derive(Default)]
struct Inner {
    client: Option<DiscordIpcClient>,
    retry_at: Option<Instant>,
}

#[derive(Default)]
pub struct DiscordManager {
    inner: Mutex<Inner>,
}

impl DiscordManager {
    fn lock(&self) -> MutexGuard<'_, Inner> {
        // A panic in one command must not take the presence state down with it.
        self.inner.lock().unwrap_or_else(|error| error.into_inner())
    }

    /// Connects on first use and returns whether a client is available now.
    fn ensure_client(inner: &mut Inner) -> bool {
        if inner.client.is_some() {
            return true;
        }
        if let Some(retry_at) = inner.retry_at {
            if Instant::now() < retry_at {
                return false;
            }
        }
        let mut client = DiscordIpcClient::new(CLIENT_ID);
        match client.connect() {
            Ok(()) => {
                inner.client = Some(client);
                inner.retry_at = None;
                true
            }
            Err(_) => {
                inner.retry_at = Some(Instant::now() + CONNECT_RETRY);
                false
            }
        }
    }

    fn drop_client(inner: &mut Inner) {
        if let Some(mut client) = inner.client.take() {
            let _ = client.close();
        }
        inner.retry_at = Some(Instant::now() + SEND_RETRY);
    }

    fn activity(payload: &PresencePayload) -> Activity<'_> {
        let details = clip(&payload.details);
        let state = clip(&payload.state);

        let mut assets = Assets::new();
        if let Some(image) = payload.large_image.as_deref().filter(|v| !v.is_empty()) {
            assets = assets.large_image(image);
        }
        if let Some(text) = payload.large_text.as_deref().filter(|v| !v.is_empty()) {
            assets = assets.large_text(clip(text));
        }

        let mut activity = Activity::new()
            .details(details)
            .state(state)
            .activity_type(ActivityType::Listening)
            // Show the song title in the member list instead of "StepUnder",
            // unless the paused status text took over the details line.
            .status_display_type(if payload.paused {
                StatusDisplayType::Name
            } else {
                StatusDisplayType::Details
            })
            .assets(assets);

        // Paused playback has no meaningful progress, so only playing tracks
        // get the elapsed/remaining timestamps.
        if !payload.paused {
            if let (Some(start), Some(end)) = (payload.start, payload.end) {
                if end > start {
                    activity = activity.timestamps(Timestamps::new().start(start).end(end));
                }
            }
        }
        activity
    }

    /// Push an activity. Returns `false` when Discord is unreachable.
    ///
    /// Updates are sent even when they look identical: that is also how a
    /// stale pipe (Discord was restarted) gets noticed and re-established.
    pub fn update(&self, payload: PresencePayload) -> bool {
        let mut inner = self.lock();

        if !Self::ensure_client(&mut inner) {
            return false;
        }

        let sent = inner
            .client
            .as_mut()
            .map(|client| client.set_activity(Self::activity(&payload)).is_ok())
            .unwrap_or(false);

        if !sent {
            Self::drop_client(&mut inner);
        }
        sent
    }

    pub fn clear(&self) {
        let mut inner = self.lock();
        if let Some(client) = inner.client.as_mut() {
            let _ = client.clear_activity();
        }
    }

    /// Clear the activity and close the pipe when the app is quitting.
    pub fn shutdown(&self) {
        let mut inner = self.lock();
        if let Some(mut client) = inner.client.take() {
            let _ = client.clear_activity();
            let _ = client.close();
        }
    }
}

fn clip(value: &str) -> &str {
    if value.chars().count() <= MAX_TEXT {
        return value;
    }
    // Cut on a character boundary rather than a byte index.
    let end = value
        .char_indices()
        .nth(MAX_TEXT)
        .map(|(index, _)| index)
        .unwrap_or(value.len());
    &value[..end]
}

// Async so a slow/hung Discord pipe never blocks the UI thread.
#[tauri::command(async)]
pub fn discord_update_presence(
    manager: tauri::State<'_, DiscordManager>,
    payload: PresencePayload,
) -> bool {
    manager.update(payload)
}

#[tauri::command(async)]
pub fn discord_clear_presence(manager: tauri::State<'_, DiscordManager>) {
    manager.clear();
}
