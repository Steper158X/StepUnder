/**
 * Bridge to the optional libmpv playback engine (see src-tauri/src/mpv.rs).
 *
 * The Rust side loads libmpv at runtime, so every call can fail with a clear
 * error when the library is missing. In a plain browser build the engine is
 * simply unavailable.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauri } from "./platform";

export interface MpvStatus {
  available: boolean;
  path?: string | null;
  version?: string | null;
  error?: string | null;
}

export interface MpvSnapshot {
  position: number;
  duration: number;
  playing: boolean;
  loading: boolean;
}

export interface MpvEndPayload {
  reason: number;
  eof: boolean;
  error?: string | null;
}

export interface MpvLoadOptions {
  position?: number;
  autoplay?: boolean;
  volume?: number;
  muted?: boolean;
}

const UNAVAILABLE: MpvStatus = {
  available: false,
  error: "MPV is only available in the desktop app.",
};

export async function mpvStatus(): Promise<MpvStatus> {
  if (!isTauri) return UNAVAILABLE;
  try {
    return await invoke<MpvStatus>("mpv_status");
  } catch (error) {
    return { available: false, error: String(error) };
  }
}

/** Load the library and start the playback thread; returns the result. */
export async function mpvEnsure(): Promise<MpvStatus> {
  if (!isTauri) return UNAVAILABLE;
  try {
    return await invoke<MpvStatus>("mpv_ensure");
  } catch (error) {
    return { available: false, error: String(error) };
  }
}

export function mpvLoad(url: string, options: MpvLoadOptions = {}) {
  return invoke("mpv_load", {
    url,
    position: options.position ?? 0,
    autoplay: options.autoplay ?? true,
    volume: options.volume ?? 1,
    muted: options.muted ?? false,
  });
}

export function mpvPause(paused: boolean) {
  return invoke("mpv_pause", { paused });
}

export function mpvSeek(seconds: number) {
  return invoke("mpv_seek", { seconds });
}

export function mpvSetVolume(volume: number) {
  return invoke("mpv_set_volume", { volume });
}

export function mpvSetMute(muted: boolean) {
  return invoke("mpv_set_mute", { muted });
}

export function mpvStop() {
  return invoke("mpv_stop");
}

function subscribe<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<UnlistenFn> {
  if (!isTauri) return Promise.resolve(() => undefined);
  return listen<T>(event, (message) => handler(message.payload));
}

export function onMpvState(
  handler: (snapshot: MpvSnapshot) => void,
): Promise<UnlistenFn> {
  return subscribe("mpv:state", handler);
}

export function onMpvEnd(
  handler: (payload: MpvEndPayload) => void,
): Promise<UnlistenFn> {
  return subscribe("mpv:end", handler);
}
