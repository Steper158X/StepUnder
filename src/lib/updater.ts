/**
 * In-app auto updates.
 *
 * Updates are served as a static `latest.json` attached to the GitHub release
 * feed of this repository (see `plugins.updater` in tauri.conf.json). The
 * desktop build verifies every download against the public key baked into the
 * app, so only releases signed with the project's private key are installed.
 */
import { createSignal } from "solid-js";
import type { Update } from "@tauri-apps/plugin-updater";
import { isTauri } from "./platform";
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
}

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

/** Download, verify and install the update that `checkForUpdates` found. */
export async function installUpdate(): Promise<void> {
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
