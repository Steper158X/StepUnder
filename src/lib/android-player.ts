/**
 * Bridge to the Android playback engine, Media3 ExoPlayer
 * (src-tauri/gen/android/.../media/NativePlayer.kt).
 *
 * The queue stays here. Each load also hands over the song after the current
 * one, so ExoPlayer moves on by itself (gapless, and even while Android slows
 * down this page's JavaScript with the screen off). It then reports
 * `advanced` and the page sends the next song along.
 *
 * Everywhere else `hasNativePlayer()` is false and nothing here is used.
 */

export interface NativeTrack {
  /** Song id; ExoPlayer echoes it back in events. */
  id: string;
  /** Stream URL, or a plain file path for a downloaded song. */
  url: string;
}

export interface NativeLoadOptions extends NativeTrack {
  position: number;
  autoplay: boolean;
  volume: number;
  muted: boolean;
  repeatOne: boolean;
  next: NativeTrack | null;
}

export type NativePlayerEvent =
  | {
      type: "state";
      id: string | null;
      playing: boolean;
      loading: boolean;
      /** Seconds. */
      position: number;
      /** Seconds; 0 when unknown. */
      duration: number;
    }
  | { type: "advanced"; id: string }
  | { type: "repeated"; id: string }
  | { type: "ended" }
  | { type: "error"; message: string };

interface NativeBridge {
  load(json: string): void;
  setNext(json: string): void;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  stop(): void;
  setVolume(value: number): void;
  setMuted(value: boolean): void;
  setRepeatOne(value: boolean): void;
  setOutput(id: number): void;
}

declare global {
  interface Window {
    StepUnderPlayer?: NativeBridge;
    __stepunderPlayerEvent?: (json: string) => void;
  }
}

function bridge(): NativeBridge | undefined {
  return typeof window !== "undefined" ? window.StepUnderPlayer : undefined;
}

function call(action: (native: NativeBridge) => void) {
  const native = bridge();
  if (!native) return;
  try {
    action(native);
  } catch (error) {
    console.warn("Native player call failed", error);
  }
}

/** True inside the Android app, where ExoPlayer plays the music. */
export function hasNativePlayer(): boolean {
  return !!bridge();
}

export function nativeLoad(options: NativeLoadOptions) {
  call((native) => native.load(JSON.stringify(options)));
}

/** Replaces the song ExoPlayer moves on to after the current one. */
export function nativeSetNext(next: NativeTrack | null) {
  call((native) => native.setNext(next ? JSON.stringify(next) : ""));
}

export const nativePlay = () => call((native) => native.play());
export const nativePause = () => call((native) => native.pause());
export const nativeStop = () => call((native) => native.stop());

export function nativeSeek(seconds: number) {
  if (Number.isFinite(seconds)) call((native) => native.seek(seconds));
}

export function nativeSetVolume(value: number) {
  call((native) => native.setVolume(Math.min(Math.max(value, 0), 1)));
}

export const nativeSetMuted = (value: boolean) =>
  call((native) => native.setMuted(value));

export const nativeSetRepeatOne = (value: boolean) =>
  call((native) => native.setRepeatOne(value));

/** Plays through this output (an id from `listAudioOutputs`); null lets Android choose. */
export function nativeSetOutput(id: number | null) {
  call((native) => native.setOutput(id ?? -1));
}

export function onNativePlayerEvent(
  handler: (event: NativePlayerEvent) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const listener = (json: string) => {
    try {
      handler(JSON.parse(json) as NativePlayerEvent);
    } catch (error) {
      console.warn("Bad native player event", error);
    }
  };
  window.__stepunderPlayerEvent = listener;
  return () => {
    if (window.__stepunderPlayerEvent === listener) {
      delete window.__stepunderPlayerEvent;
    }
  };
}
