/**
 * Bridge to the Android playback service (src-tauri/gen/android/.../media).
 *
 * Native playback publishes its own media state. These calls also support
 * the web-audio fallback. Everywhere else these functions do nothing.
 */

export interface AndroidNowPlaying {
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string;
  playing: boolean;
  loading: boolean;
  /** Seconds. */
  position: number;
  /** Seconds; 0 when unknown. */
  duration: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export type AndroidMediaAction =
  | "play"
  | "pause"
  | "stop"
  | "next"
  | "previous"
  | "seek";

interface NativeBridge {
  update(json: string): void;
  clear(): void;
}

declare global {
  interface Window {
    StepUnderMedia?: NativeBridge;
    __stepunderMediaAction?: (action: string, value: number | null) => void;
  }
}

function bridge(): NativeBridge | undefined {
  return typeof window !== "undefined" ? window.StepUnderMedia : undefined;
}

/** True inside the Android app, where the native bridge is injected. */
export function hasAndroidMedia(): boolean {
  return !!bridge();
}

let last: AndroidNowPlaying | null = null;
let lastSentAt = 0;

/**
 * Publishes the current state. Position updates are skipped while they match
 * what Android extrapolates on its own, so this can be called on every
 * `timeupdate` without flooding the bridge.
 */
export function updateAndroidMedia(next: AndroidNowPlaying) {
  const native = bridge();
  if (!native) return;

  const now = Date.now();
  if (last) {
    const sameTrack =
      last.title === next.title &&
      last.artist === next.artist &&
      last.album === next.album &&
      last.artworkUrl === next.artworkUrl &&
      last.playing === next.playing &&
      last.loading === next.loading &&
      last.duration === next.duration &&
      last.hasNext === next.hasNext &&
      last.hasPrevious === next.hasPrevious;
    const advancing = last.playing && !last.loading;
    const expected =
      last.position + (advancing ? (now - lastSentAt) / 1000 : 0);
    if (sameTrack && Math.abs(expected - next.position) < 1.5) return;
  }

  last = { ...next };
  lastSentAt = now;
  try {
    native.update(JSON.stringify(next));
  } catch (error) {
    console.warn("Android media update failed", error);
  }
}

/** Nothing is queued any more: remove the notification. */
export function clearAndroidMedia() {
  const native = bridge();
  if (!native || last === null) return;
  last = null;
  try {
    native.clear();
  } catch {
    // ignore
  }
}

/** Receives notification / lock screen / headset button presses. */
export function onAndroidMediaAction(
  handler: (action: AndroidMediaAction, value: number | null) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const listener = (action: string, value: number | null) =>
    handler(action as AndroidMediaAction, value);
  window.__stepunderMediaAction = listener;
  return () => {
    if (window.__stepunderMediaAction === listener) {
      delete window.__stepunderMediaAction;
    }
  };
}

// ------------------------------------------------------------ audio outputs

/** One audio output the phone can play through. */
export interface AudioOutput {
  id: number;
  kind: "speaker" | "bluetooth" | "wired" | "usb";
  /** Device name; empty for the phone's own speaker. */
  name: string;
  /** Media is playing through this one now (a best guess before Android 13). */
  active: boolean;
}

interface OutputsBridge {
  list(): string;
  showSwitcher(): string;
}

declare global {
  interface Window {
    StepUnderOutputs?: OutputsBridge;
    __stepunderOutputsChanged?: () => void;
  }
}

function outputsBridge(): OutputsBridge | undefined {
  return typeof window !== "undefined" ? window.StepUnderOutputs : undefined;
}

/** True inside the Android app, which can list and switch outputs. */
export function hasAudioOutputs(): boolean {
  return !!outputsBridge();
}

export function listAudioOutputs(): AudioOutput[] {
  const native = outputsBridge();
  if (!native) return [];
  try {
    return JSON.parse(native.list()) as AudioOutput[];
  } catch (error) {
    console.warn("Could not list audio outputs", error);
    return [];
  }
}

/**
 * Opens Android's Output Switcher, the only way to move the WebView's audio
 * between the phone speaker and Bluetooth. "settings" means only Bluetooth
 * settings could be opened instead.
 */
export function showAudioOutputSwitcher(): "switcher" | "settings" | "none" {
  const native = outputsBridge();
  if (!native) return "none";
  try {
    return native.showSwitcher() as "switcher" | "settings" | "none";
  } catch {
    return "none";
  }
}

/** Runs when a headset or speaker connects or disconnects. */
export function onAudioOutputsChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.__stepunderOutputsChanged = handler;
  return () => {
    if (window.__stepunderOutputsChanged === handler) {
      delete window.__stepunderOutputsChanged;
    }
  };
}
