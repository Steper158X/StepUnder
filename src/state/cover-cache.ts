/**
 * Desktop cover-art disk cache (see src-tauri/src/cover_cache.rs): keeps the
 * Rust side in sync with the saved settings and wraps its commands.
 */
import { invoke } from "@tauri-apps/api/core";
import { createEffect, createRoot, createSignal, on } from "solid-js";
import { isTauri } from "~/lib/platform";
import {
  coverCacheEnabled,
  coverCacheMaxDays,
  coverCacheMaxMb,
} from "~/state/settings";

export type CoverCacheStats = { files: number; bytes: number };

let started = false;

/** Bumps after the Rust side applied new settings (and trimmed the cache). */
const [configuredRevision, setConfiguredRevision] = createSignal(0);
export { configuredRevision };

/** Call once after `initSettings`; re-sends the settings whenever they change. */
export function initCoverCache(): void {
  if (!isTauri || started) return;
  started = true;
  createRoot(() => {
    createEffect(
      on(
        [coverCacheEnabled, coverCacheMaxMb, coverCacheMaxDays],
        ([enabled, maxMb, maxDays]) => {
          void invoke("cover_cache_configure", { enabled, maxMb, maxDays })
            .catch(() => undefined)
            .then(() => setConfiguredRevision((n) => n + 1));
        },
      ),
    );
  });
}

export async function coverCacheStats(): Promise<CoverCacheStats | null> {
  if (!isTauri) return null;
  return invoke<CoverCacheStats>("cover_cache_stats").catch(() => null);
}

export function clearCoverCache(): Promise<void> {
  return invoke("cover_cache_clear");
}

export function coverCacheDir(): Promise<string> {
  return invoke<string>("cover_cache_dir");
}
