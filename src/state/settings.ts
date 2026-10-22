import { createSignal } from "solid-js";
import { readSetting, writeSetting } from "~/lib/storage";
import { DEFAULT_AUDIO_DEVICE } from "~/lib/audio-output";

export type Theme = "dark" | "light" | "system";
export type StreamFormat = "raw" | "mp3" | "aac" | "opus" | "flac";
export type Font = "system" | "sarabun";
/** Playback engine: the built-in web player or the libmpv engine. */
export type AudioPlayer = "web" | "mpv";

const AUDIO_PLAYERS: readonly AudioPlayer[] = ["web", "mpv"];

/** mpv treats `auto` as "pick the system default device". */
export const DEFAULT_MPV_AUDIO_DEVICE = "auto";

const [theme, setThemeSignal] = createSignal<Theme>("dark");
const [scrobble, setScrobbleSignal] = createSignal(true);
const [maxBitRate, setMaxBitRateSignal] = createSignal(0);
const [streamFormat, setStreamFormatSignal] = createSignal<StreamFormat>("raw");
const [font, setFontSignal] = createSignal<Font>("system");
const [audioPlayer, setAudioPlayerSignal] = createSignal<AudioPlayer>("web");
const [discordPresence, setDiscordPresenceSignal] = createSignal(false);
const [audioDeviceId, setAudioDeviceIdSignal] = createSignal<string>(
  DEFAULT_AUDIO_DEVICE,
);
/** mpv's own device name, e.g. `wasapi/{...}`; `auto` lets mpv decide. */
const [mpvAudioDevice, setMpvAudioDeviceSignal] = createSignal<string>(
  DEFAULT_MPV_AUDIO_DEVICE,
);

export {
  theme,
  scrobble,
  maxBitRate,
  streamFormat,
  font,
  audioPlayer,
  discordPresence,
  audioDeviceId,
  mpvAudioDevice,
};

const FONT_STACKS: Record<Font, string> = {
  system: `"Segoe UI", "Leelawadee UI", "Noto Sans Thai", ui-sans-serif, system-ui, -apple-system, sans-serif`,
  sarabun: `"Sarabun", "Noto Sans Thai", "Segoe UI", ui-sans-serif, system-ui, sans-serif`,
};

const SARABUN_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap";

/** Load the Google-hosted face only when it is actually selected. */
function ensureFontLoaded(value: Font): void {
  if (value !== "sarabun") return;
  if (document.querySelector('link[data-font="sarabun"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = SARABUN_STYLESHEET;
  link.dataset.font = "sarabun";
  document.head.appendChild(link);
}

function applyFont(value: Font) {
  ensureFontLoaded(value);
  document.documentElement.style.setProperty("--font-app", FONT_STACKS[value]);
  document.documentElement.dataset.font = value;
}

const darkQuery =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

function isDark(value: Theme): boolean {
  if (value === "dark") return true;
  if (value === "light") return false;
  return darkQuery?.matches ?? true;
}

function apply(value: Theme) {
  const dark = isDark(value);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export async function initSettings(): Promise<void> {
  const [
    savedTheme,
    savedScrobble,
    savedBitRate,
    savedFormat,
    savedFont,
    savedPlayer,
    savedDevice,
    savedMpvDevice,
    savedDiscordPresence,
  ] = await Promise.all([
    readSetting<Theme>("theme", "dark"),
    readSetting<boolean>("scrobble", true),
    readSetting<number>("maxBitRate", 0),
    readSetting<StreamFormat>("streamFormat", "raw"),
    readSetting<Font>("font", "system"),
    readSetting<AudioPlayer>("audioPlayer", "web"),
    readSetting<string>("audioDeviceId", DEFAULT_AUDIO_DEVICE),
    readSetting<string>("mpvAudioDevice", DEFAULT_MPV_AUDIO_DEVICE),
    readSetting<boolean>("discordPresence", false),
  ]);

  const nextTheme: Theme =
    savedTheme === "light" || savedTheme === "system" ? savedTheme : "dark";
  const nextFont: Font = savedFont === "sarabun" ? "sarabun" : "system";
  const nextPlayer: AudioPlayer = AUDIO_PLAYERS.includes(savedPlayer)
    ? savedPlayer
    : "web";
  setThemeSignal(nextTheme);
  setScrobbleSignal(savedScrobble !== false);
  setMaxBitRateSignal(typeof savedBitRate === "number" ? savedBitRate : 0);
  setStreamFormatSignal(savedFormat ?? "raw");
  setFontSignal(nextFont);
  setAudioPlayerSignal(nextPlayer);
  setDiscordPresenceSignal(savedDiscordPresence === true);
  setAudioDeviceIdSignal(savedDevice || DEFAULT_AUDIO_DEVICE);
  setMpvAudioDeviceSignal(savedMpvDevice || DEFAULT_MPV_AUDIO_DEVICE);
  apply(nextTheme);
  applyFont(nextFont);

  darkQuery?.addEventListener("change", () => {
    if (theme() === "system") apply("system");
  });
}

export function setTheme(value: Theme): void {
  setThemeSignal(value);
  apply(value);
  void writeSetting("theme", value);
}

export function setScrobble(value: boolean): void {
  setScrobbleSignal(value);
  void writeSetting("scrobble", value);
}

export function setMaxBitRate(value: number): void {
  setMaxBitRateSignal(value);
  void writeSetting("maxBitRate", value);
}

export function setStreamFormat(value: StreamFormat): void {
  setStreamFormatSignal(value);
  void writeSetting("streamFormat", value);
}

export function setFont(value: Font): void {
  setFontSignal(value);
  applyFont(value);
  void writeSetting("font", value);
}

export function setAudioPlayer(value: AudioPlayer): void {
  setAudioPlayerSignal(value);
  void writeSetting("audioPlayer", value);
}

export function setDiscordPresence(value: boolean): void {
  setDiscordPresenceSignal(value);
  void writeSetting("discordPresence", value);
}

export function setAudioDeviceId(value: string): void {
  const next = value || DEFAULT_AUDIO_DEVICE;
  setAudioDeviceIdSignal(next);
  void writeSetting("audioDeviceId", next);
}

export function setMpvAudioDevice(value: string): void {
  const next = value || DEFAULT_MPV_AUDIO_DEVICE;
  setMpvAudioDeviceSignal(next);
  void writeSetting("mpvAudioDevice", next);
}
