import type { Song } from "~/lib/types";

export interface NativeTrack {
  id: string;
  url: string;
  fallbackUrl?: string;
  artworkUrl?: string;
  song: Song;
}

export interface NativeQueueSnapshot {
  items: NativeTrack[];
  currentIndex: number;
  position: number;
  repeat: "off" | "all" | "one";
  shuffle: boolean;
  radio: boolean;
  serverId: string | null;
  sourceName: string | null;
  volume: number;
  muted: boolean;
  autoplay: boolean;
}

export interface NativeProgress {
  currentIndex: number;
  position: number;
  playing: boolean;
  loading: boolean;
  duration: number;
  volume: number;
  muted: boolean;
  serverId: string | null;
}

export type NativePlayerEvent =
  | (Omit<NativeQueueSnapshot, "items"> & NativeProgress & { type: "snapshot"; items: { id: string; song: Song }[] })
  | (NativeProgress & { type: "state"; transition?: boolean })
  | (Partial<Omit<NativeQueueSnapshot, "items">> & { type: "recovery"; items?: { song: Song }[] })
  | { type: "error"; message: string };

interface NativeBridge {
  load(json: string): void;
  setQueue(json: string): void;
  snapshot(): void;
  setForeground(value: boolean): void;
  play(): void;
  pause(): void;
  next(): void;
  previous(): void;
  seek(seconds: number): void;
  stop(): void;
  setVolume(value: number): void;
  setMuted(value: boolean): void;
  setOutput(id: number): void;
}

declare global {
  interface Window {
    StepUnderPlayer?: NativeBridge;
    __stepunderPlayerEvent?: (json: string) => void;
  }
}

function call(action: (native: NativeBridge) => void) {
  const native = typeof window !== "undefined" ? window.StepUnderPlayer : undefined;
  if (!native) return;
  try { action(native); } catch (error) { console.warn("Native player call failed", error); }
}

export const hasNativePlayer = () => typeof window !== "undefined" && !!window.StepUnderPlayer;
export const nativeLoad = (options: NativeQueueSnapshot) => call(native => native.load(JSON.stringify(options)));
export const nativeSetQueue = (options: NativeQueueSnapshot) => call(native => native.setQueue(JSON.stringify(options)));
export const nativeSnapshot = () => call(native => native.snapshot());
export const nativePlay = () => call(native => native.play());
export const nativePause = () => call(native => native.pause());
export const nativeNext = () => call(native => native.next());
export const nativePrevious = () => call(native => native.previous());
export const nativeStop = () => call(native => native.stop());
export const nativeSeek = (seconds: number) => { if (Number.isFinite(seconds)) call(native => native.seek(seconds)); };
export const nativeSetVolume = (value: number) => call(native => native.setVolume(Math.min(Math.max(value, 0), 1)));
export const nativeSetMuted = (value: boolean) => call(native => native.setMuted(value));
export const nativeSetOutput = (id: number | null) => call(native => native.setOutput(id ?? -1));

export function onNativePlayerEvent(handler: (event: NativePlayerEvent) => void): () => void {
  const listener = (json: string) => {
    try { handler(JSON.parse(json) as NativePlayerEvent); }
    catch (error) { console.warn("Bad native player event", error); }
  };
  window.__stepunderPlayerEvent = listener;
  const visibility = () => call(native => native.setForeground(!document.hidden));
  document.addEventListener("visibilitychange", visibility);
  visibility();
  return () => {
    document.removeEventListener("visibilitychange", visibility);
    call(native => native.setForeground(false));
    if (window.__stepunderPlayerEvent === listener) delete window.__stepunderPlayerEvent;
  };
}
