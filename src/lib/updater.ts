/**
 * In-app auto updates.
 *
 * Updates are served as a static `latest.json` attached to the GitHub release
 * feed of this repository (see `plugins.updater` in tauri.conf.json). The
 * desktop build verifies every download against the public key baked into the
 * app, so only releases signed with the project's private key are installed.
 *
 * The Tauri updater plugin does not exist on Android, so phones read the
 * latest GitHub release instead and send the user to its APK to install.
 */
import { createSignal } from "solid-js";
import type { Update } from "@tauri-apps/plugin-updater";
import { isMobile, isTauri } from "./platform";
import { autoUpdate } from "~/state/settings";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "up-to-date"
  | "downloading"
  | "installing"
  | "error";

export interface AvailableUpdate {
  version: string;
  currentVersion: string;
  date?: string;
  notes?: string;
  /** Android only: the release APK (or the release page) to open. */
  downloadUrl?: string;
}

const REPO = "Steper158X/StepUnder";
const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const LATEST_RELEASE_PAGE = `https://github.com/${REPO}/releases/latest`;

const [status, setStatus] = createSignal<UpdateStatus>("idle");
const [available, setAvailable] = createSignal<AvailableUpdate | null>(null);
const [downloaded, setDownloaded] = createSignal(0);
const [contentLength, setContentLength] = createSignal<number | null>(null);
const [error, setError] = createSignal<string | null>(null);
const [promptOpen, setPromptOpen] = createSignal(false);
const [appVersion, setAppVersion] = createSignal("0.1.0");

export {
  status,
  available,
  error,
  promptOpen,
  appVersion,
};

/** The live plugin handle, kept so "Install" can reuse the checked update. */
let pending: Update | null = null;

export function isBusy(): boolean {
  const current = status();
  return current === "checking" || current === "downloading" || current === "installing";
}

/** Percentage (0-100), or null while the server has not sent a length. */
export function progressPercent(): number | null {
  const total = contentLength();
  if (!total) return null;
  return Math.min(100, Math.round((downloaded() / total) * 100));
}

export function dismissPrompt(): void {
  setPromptOpen(false);
}

/** Ask the backend for the installed version (falls back to the build version). */
export async function loadAppVersion(): Promise<string> {
  if (!isTauri) return appVersion();
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    const version = await getVersion();
    setAppVersion(version);
    return version;
  } catch (cause) {
    console.error("Failed to read the app version", cause);
    return appVersion();
  }
}

/**
 * Look for a newer release. `silent` keeps startup checks from surfacing
 * network errors as if the user had asked for them.
 */
export async function checkForUpdates(
  options: { silent?: boolean } = {},
): Promise<AvailableUpdate | null> {
  if (!isTauri) {
    if (!options.silent) {
      setStatus("error");
      setError("Updates are only available in the desktop app.");
    }
    return null;
  }
  if (isBusy() || status() === "available") return available();

  setStatus("checking");
  setError(null);
  if (isMobile) return checkGithubRelease();
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) {
      pending = null;
      setAvailable(null);
      setStatus("up-to-date");
      return null;
    }
    pending = update;
    const info: AvailableUpdate = {
      version: update.version,
      currentVersion: update.currentVersion,
      date: update.date,
      notes: update.body,
    };
    setAvailable(info);
    setStatus("available");
    void loadAppVersion();
    return info;
  } catch (cause) {
    console.error("Update check failed", cause);
    setError(cause instanceof Error ? cause.message : String(cause));
    setStatus("error");
    return null;
  }
}

/** Splits "v1.2.3" / "1.2.3-beta" into numbers for comparison. */
function versionParts(version: string): number[] {
  return version
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isNewer(candidate: string, current: string): boolean {
  const a = versionParts(candidate);
  const b = versionParts(current);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

interface GithubRelease {
  tag_name: string;
  body?: string | null;
  published_at?: string | null;
  html_url?: string;
  assets?: { name: string; browser_download_url: string }[];
}

/** Android: compare the installed version with the latest GitHub release. */
async function checkGithubRelease(): Promise<AvailableUpdate | null> {
  try {
    const current = await loadAppVersion();
    const { fetch } = await import("@tauri-apps/plugin-http");
    const response = await fetch(LATEST_RELEASE_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
    const release = (await response.json()) as GithubRelease;
    if (!release.tag_name || !isNewer(release.tag_name, current)) {
      setAvailable(null);
      setStatus("up-to-date");
      return null;
    }
    const apk = release.assets?.find((asset) =>
      asset.name.toLowerCase().endsWith(".apk"),
    );
    const info: AvailableUpdate = {
      version: release.tag_name.replace(/^v/i, ""),
      currentVersion: current,
      date: release.published_at ?? undefined,
      notes: release.body ?? undefined,
      downloadUrl:
        apk?.browser_download_url ?? release.html_url ?? LATEST_RELEASE_PAGE,
    };
    setAvailable(info);
    setStatus("available");
    return info;
  } catch (cause) {
    console.error("Update check failed", cause);
    setError(cause instanceof Error ? cause.message : String(cause));
    setStatus("error");
    return null;
  }
}

/** Download, verify and install the update that `checkForUpdates` found. */
export async function installUpdate(): Promise<void> {
  if (isTauri && isMobile) {
    // Android installs the APK itself: open it in the browser.
    const url = available()?.downloadUrl ?? LATEST_RELEASE_PAGE;
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url).catch((cause) => {
      console.error("Failed to open the APK download", cause);
      setError(cause instanceof Error ? cause.message : String(cause));
    });
    setPromptOpen(false);
    return;
  }
  if (!isTauri || !pending) return;
  setStatus("downloading");
  setError(null);
  setDownloaded(0);
  setContentLength(null);
  try {
    await pending.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          setContentLength(event.data.contentLength ?? null);
          break;
        case "Progress":
          setDownloaded((value) => value + event.data.chunkLength);
          break;
        case "Finished":
          setStatus("installing");
          break;
      }
    });
    // Windows quits the app while installing, so this only runs on other
    // platforms. Restart into the freshly installed build.
    setStatus("installing");
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (cause) {
    console.error("Update install failed", cause);
    setError(cause instanceof Error ? cause.message : String(cause));
    setStatus("error");
  }
}

/**
 * Called once at startup: check quietly when automatic checks are enabled and
 * prompt when a newer release is waiting.
 */
export async function checkForUpdatesOnStartup(): Promise<void> {
  // Never nag a `tauri dev` session with release builds.
  if (!isTauri || import.meta.env.DEV || !autoUpdate()) return;
  // Give the library/player requests the first few seconds of bandwidth.
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const found = await checkForUpdates({ silent: true });
  if (found) setPromptOpen(true);
}
