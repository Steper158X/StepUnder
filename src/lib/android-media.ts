/**
 * Bridge to the Android playback service (src-tauri/gen/android/.../media).
 *
 * The audio plays in the WebView; the service only mirrors what is playing
 * into a MediaSession + foreground notification, which gives lock screen
 * controls, Bluetooth/headset buttons, Android Auto and keeps the app alive
 * with the screen off. Everywhere else these functions do nothing.
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
