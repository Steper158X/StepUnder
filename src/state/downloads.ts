/**
 * Downloaded songs. The Rust side (src-tauri/src/downloads.rs) does the actual
 * transfer; this keeps the index of finished files, the live job list and the
 * file naming rules.
 */
import { createEffect, createRoot, on } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import type { Song } from "~/lib/types";
import type { SubsonicClient } from "~/lib/subsonic";
import { isTauri } from "~/lib/platform";
import { useServers } from "~/state/servers";
import {
  downloadBitRate,
  downloadConcurrency,
  downloadDir,
  downloadFormat,
  downloadLayout,
  type DownloadLayout,
  type StreamFormat,
} from "~/state/settings";
import { toast } from "~/components/toaster";
import { t } from "~/i18n";

export interface DownloadEntry {
  key: string;
  serverId: string;
  songId: string;
  /** Absolute path of the file. */
  path: string;
  /** Download folder the file was saved under; deletes stay inside it. */
  root: string;
  size: number;
  format: StreamFormat;
  song: Song;
  downloadedAt: number;
}

export interface DownloadJob {
  key: string;
  serverId: string;
  song: Song;
  path: string;
  root: string;
  format: StreamFormat;
  state: "queued" | "downloading" | "error";
  received: number;
  total: number | null;
  error?: string;
}

export type DownloadStatus =
  | { state: "done"; entry: DownloadEntry }
  | { state: "queued" | "downloading" | "error"; job: DownloadJob };

const [entries, setEntries] = createStore<Record<string, DownloadEntry>>({});
const [jobs, setJobs] = createStore<Record<string, DownloadJob>>({});

/** Songs finished since the queue was last empty, for the summary toast. */
let finishedBatch = 0;
let defaultDir: string | null = null;
let indexStore: Promise<IndexStore | null> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const allowedRoots = new Set<string>();

type IndexStore = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
};

async function invoke<T>(command: string, args?: Record<string, unknown>) {
  const core = await import("@tauri-apps/api/core");
  return core.invoke<T>(command, args);
}

function getIndexStore(): Promise<IndexStore | null> {
  if (!indexStore) {
    indexStore = import("@tauri-apps/plugin-store")
      .then(
        ({ load }) => load("downloads.json") as unknown as Promise<IndexStore>,
      )
      .catch((error) => {
        console.error("Failed to open downloads index", error);
        return null;
      });
  }
  return indexStore;
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void getIndexStore().then(async (store) => {
      if (!store) return;
      try {
        await store.set("entries", Object.values(entries));
        await store.save();
      } catch (error) {
        console.error("Failed to save downloads index", error);
      }
    });
  }, 300);
}

export function downloadKey(serverId: string, songId: string): string {
  return `${serverId}:${songId}`;
}

export function downloadEntries(): DownloadEntry[] {
  return Object.values(entries);
}

export function downloadJobs(): DownloadJob[] {
  return Object.values(jobs);
}

export function downloadStatus(key: string): DownloadStatus | null {
  const job = jobs[key];
  if (job) return { state: job.state, job };
  const entry = entries[key];
  return entry ? { state: "done", entry } : null;
}

/** Path of the downloaded copy, or null. */
export function localPath(serverId: string, songId: string): string | null {
  return entries[downloadKey(serverId, songId)]?.path ?? null;
}

/** The download folder in use: the chosen one, or `Music/StepUnder`. */
export async function resolveDownloadDir(): Promise<string> {
  const chosen = downloadDir();
  if (chosen) return chosen;
  if (!defaultDir) defaultDir = await invoke<string>("default_download_dir");
  return defaultDir;
}

/** Lets the web player read files under `root`. */
async function allowRoot(root: string) {
  if (allowedRoots.has(root)) return;
  try {
    await invoke("allow_asset_dir", { path: root });
    allowedRoots.add(root);
  } catch (error) {
    console.warn("Failed to allow download folder", error);
  }
}

// ------------------------------------------------------------------ naming
const RESERVED_NAMES = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

/** One path segment that is valid on Windows, macOS and Linux. */
function safeSegment(value: string | undefined, fallback: string): string {
  let name = (value ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  if (name.length > 120) name = name.slice(0, 120).trim();
  if (!name) name = fallback;
  if (RESERVED_NAMES.test(name)) name = `_${name}`;
  return name;
}

function extensionFor(song: Song, format: StreamFormat): string {
  if (format === "raw") return safeSegment(song.suffix, "mp3").toLowerCase();
  // Navidrome's default AAC transcode writes an MP4 container.
  if (format === "aac") return "m4a";
  return format;
}

function fileName(song: Song, layout: DownloadLayout, ext: string): string {
  const title = safeSegment(song.title, song.id);
  if (layout === "flat") {
    return `${safeSegment(song.artist, "Unknown Artist")} - ${title}.${ext}`;
  }
  const disc = song.discNumber && song.discNumber > 1 ? `${song.discNumber}-` : "";
  const track = song.track ? `${String(song.track).padStart(2, "0")} - ` : "";
  return `${disc}${track}${title}.${ext}`;
}

function buildPath(
  root: string,
  song: Song,
  layout: DownloadLayout,
  format: StreamFormat,
  taken: Set<string>,
): string {
  const sep = root.includes("\\") ? "\\" : "/";
  const base = root.replace(/[\\/]+$/, "");
  const folders: string[] = [];
  if (layout === "artist-album") {
    folders.push(safeSegment(song.artist, "Unknown Artist"));
  }
  if (layout !== "flat") folders.push(safeSegment(song.album, "Unknown Album"));
  const ext = extensionFor(song, format);
  const name = fileName(song, layout, ext);
  const dir = [base, ...folders].join(sep);
  let path = `${dir}${sep}${name}`;
  // Two different songs can share a name; keep both.
  for (let n = 2; taken.has(path.toLowerCase()); n++) {
    path = `${dir}${sep}${name.slice(0, -(ext.length + 1))} (${n}).${ext}`;
  }
  taken.add(path.toLowerCase());
  return path;
}

// ----------------------------------------------------------------- actions
export async function downloadSongs(
  client: SubsonicClient,
  serverId: string,
  songs: Song[],
): Promise<void> {
  if (!isTauri) return;
  const root = await resolveDownloadDir();
  const format = downloadFormat();
  const layout = downloadLayout();
  const taken = new Set<string>();
  for (const entry of Object.values(entries)) taken.add(entry.path.toLowerCase());
  for (const job of Object.values(jobs)) taken.add(job.path.toLowerCase());

  const seen = new Set<string>();
  const fresh: DownloadJob[] = [];
  for (const song of songs) {
    const key = downloadKey(serverId, song.id);
    if (seen.has(key) || entries[key]) continue;
    const existing = jobs[key];
    if (existing && existing.state !== "error") continue;
    seen.add(key);
    fresh.push({
      key,
      serverId,
      song: { ...song },
      path: existing?.path ?? buildPath(root, song, layout, format, taken),
      root,
      format,
      state: "queued",
      received: 0,
      total: null,
    });
  }

  if (!fresh.length) {
    toast(t("download.alreadyDownloaded"), undefined, "default");
    return;
  }

  setJobs(
    produce((draft) => {
      for (const job of fresh) draft[job.key] = job;
    }),
  );
  toast(t("download.started", { count: fresh.length }), undefined, "default");

  try {
    await invoke("download_enqueue", {
      jobs: fresh.map((job) => ({
        id: job.key,
        url: client.downloadUrl(job.song.id, {
          format,
          maxBitRate: downloadBitRate(),
        }),
        dest: job.path,
      })),
    });
  } catch (error) {
    setJobs(
      produce((draft) => {
        for (const job of fresh) {
          draft[job.key].state = "error";
          draft[job.key].error = String(error);
        }
      }),
    );
    toast(t("download.failed"), String(error), "error");
  }
}

export async function cancelDownloads(keys: string[]): Promise<void> {
  const running = keys.filter((key) => jobs[key] && jobs[key].state !== "error");
  setJobs(
    produce((draft) => {
      for (const key of keys) delete draft[key];
    }),
  );
  if (!running.length) return;
  try {
    await invoke("download_cancel", { ids: running });
  } catch (error) {
    console.warn("Failed to cancel downloads", error);
  }
}

/** Deletes downloaded files and forgets them. */
export async function removeDownloads(keys: string[]): Promise<void> {
  const byRoot = new Map<string, string[]>();
  for (const key of keys) {
    const entry = entries[key];
    if (!entry) continue;
    byRoot.set(entry.root, [...(byRoot.get(entry.root) ?? []), entry.path]);
  }
  try {
    for (const [root, paths] of byRoot) {
      await invoke("download_delete", { root, paths });
    }
  } catch (error) {
    toast(t("download.deleteFailed"), String(error), "error");
  }
  forgetDownloads(keys);
}

export async function removeAllDownloads(): Promise<void> {
  await cancelDownloads(Object.keys(jobs));
  await removeDownloads(Object.keys(entries));
}

/** Drops index entries whose file is gone, without touching the disk. */
export function forgetDownloads(keys: string[]): void {
  setEntries(
    produce((draft) => {
      for (const key of keys) delete draft[key];
    }),
  );
  scheduleSave();
}

/** Total size of the downloaded files, in bytes. */
export function downloadedBytes(): number {
  return Object.values(entries).reduce((sum, entry) => sum + entry.size, 0);
}

export interface DiskSpace {
  drive: string;
  available: number;
  total: number;
}

/** Free and total space of the drive that holds `path`. */
export function downloadDiskSpace(path: string): Promise<DiskSpace> {
  return invoke<DiskSpace>("download_disk_space", { path });
}

export async function pickDownloadDir(): Promise<string | null> {
  const current = await resolveDownloadDir().catch(() => undefined);
  return invoke<string | null>("pick_download_dir", { current });
}

/** Shows a file (selected) or a folder in the system file manager. */
export async function revealDownload(path: string): Promise<void> {
  try {
    await invoke("reveal_download", { path });
  } catch (error) {
    toast(t("download.openFailed"), String(error), "error");
  }
}

// --------------------------------------------------------------- lifecycle
type ProgressEvent = { id: string; received: number; total: number | null };
type DoneEvent = { id: string; path: string; size: number };
type ErrorEvent = { id: string; error: string; cancelled: boolean };

function finishBatchIfIdle() {
  const busy = Object.values(jobs).some((job) => job.state !== "error");
  if (busy || finishedBatch === 0) return;
  toast(t("download.finished", { count: finishedBatch }), undefined, "success");
  finishedBatch = 0;
}

async function listenToEngine() {
  const { listen } = await import("@tauri-apps/api/event");
  await listen<ProgressEvent>("download://progress", ({ payload }) => {
    if (!jobs[payload.id]) return;
    setJobs(payload.id, {
      state: "downloading",
      received: payload.received,
      total: payload.total,
    });
  });
  await listen<DoneEvent>("download://done", ({ payload }) => {
    const job = jobs[payload.id];
    if (!job) return;
    setEntries(payload.id, {
      key: job.key,
      serverId: job.serverId,
      songId: job.song.id,
      path: payload.path,
      root: job.root,
      size: payload.size,
      format: job.format,
      song: job.song,
      downloadedAt: Date.now(),
    });
    setJobs(produce((draft) => delete draft[payload.id]));
    scheduleSave();
    void allowRoot(job.root);
    finishedBatch += 1;
    finishBatchIfIdle();
  });
  await listen<ErrorEvent>("download://error", ({ payload }) => {
    const job = jobs[payload.id];
    if (!job) return;
    if (payload.cancelled) {
      setJobs(produce((draft) => delete draft[payload.id]));
    } else {
      setJobs(payload.id, { state: "error", error: payload.error });
      toast(t("download.failed"), `${job.song.title}: ${payload.error}`, "error");
    }
    finishBatchIfIdle();
  });
}

/** Loads the index, drops files deleted outside the app, starts listening. */
export async function initDownloads(): Promise<void> {
  if (!isTauri) return;
  await listenToEngine();

  const store = await getIndexStore();
  const saved = ((await store?.get<DownloadEntry[]>("entries")) ?? []).filter(
    (entry) => entry && typeof entry.path === "string" && entry.song,
  );
  const exists = await invoke<boolean[]>("download_exists", {
    paths: saved.map((entry) => entry.path),
  }).catch(() => saved.map(() => true));
  const kept = saved.filter((_, index) => exists[index]);
  setEntries(
    reconcile(Object.fromEntries(kept.map((entry) => [entry.key, entry]))),
  );
  if (kept.length !== saved.length) scheduleSave();

  for (const root of new Set(kept.map((entry) => entry.root))) {
    await allowRoot(root);
  }
  void resolveDownloadDir()
    .then(allowRoot)
    .catch(() => undefined);

  createRoot(() => {
    createEffect(
      on(downloadConcurrency, (limit) => {
        void invoke("download_set_concurrency", { limit }).catch(() => undefined);
      }),
    );
    createEffect(
      on(
        downloadDir,
        () => {
          void resolveDownloadDir()
            .then(allowRoot)
            .catch(() => undefined);
        },
        { defer: true },
      ),
    );
  });
}

// --------------------------------------------------------------- component
/** Download helpers bound to the connected server. */
export function useDownloads() {
  const servers = useServers();

  function key(song: Song): string | null {
    const serverId = servers.activeId();
    return serverId ? downloadKey(serverId, song.id) : null;
  }

  return {
    available: isTauri,
    status(song: Song): DownloadStatus | null {
      const k = key(song);
      return k ? downloadStatus(k) : null;
    },
    isDownloaded(song: Song): boolean {
      const k = key(song);
      return !!k && !!entries[k];
    },
    download(songs: Song[]) {
      const client = servers.client();
      const serverId = servers.activeId();
      if (!client || !serverId || !songs.length) return;
      void downloadSongs(client, serverId, songs);
    },
    remove(songs: Song[]) {
      const keys = songs.map(key).filter((k): k is string => !!k);
      void removeDownloads(keys);
    },
    cancel(songs: Song[]) {
      const keys = songs.map(key).filter((k): k is string => !!k);
      void cancelDownloads(keys);
    },
  };
}
