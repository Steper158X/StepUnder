import { createSignal } from "solid-js";
import { readSetting, writeSetting } from "~/lib/storage";
import { DEFAULT_AUDIO_DEVICE } from "~/lib/audio-output";
import { isTauri } from "~/lib/platform";

export type Theme = "dark" | "light" | "system";
export type StreamFormat = "raw" | "mp3" | "aac" | "opus" | "flac";
export type Font = "system" | "sarabun";
export type Accent =
  | "purple"
  | "blue"
  | "teal"
  | "green"
  | "orange"
  | "red"
  | "pink";

/** OKLCH hue for each accent; feeds `--brand-h` in app.css. */
export const ACCENT_HUES: Record<Accent, number> = {
  purple: 293,
  blue: 260,
  teal: 190,
  green: 150,
  orange: 50,
  red: 25,
  pink: 350,
};
/** Player bar style: attached to the bottom edge, or a floating card. */
export type PlayerLayout = "docked" | "floating";

/** Surface style: solid panels, or translucent "liquid glass" panels. */
export type UiStyle = "standard" | "glass";

/** Liquid glass background brightness, 0–100, kept per theme. */
export const DEFAULT_GLASS_BRIGHTNESS = 30;
export const DEFAULT_GLASS_BRIGHTNESS_LIGHT = 70;

/** Blur radius of liquid glass panels, in px. */
export const DEFAULT_GLASS_BLUR = 45;
export const MAX_GLASS_BLUR = 60;

/**
 * Windows material behind a liquid glass window. `acrylic` blurs whatever is
 * behind the window; `mica` tints from the wallpaper only.
 */
export type WindowEffect = "none" | "acrylic" | "mica";

const WINDOW_EFFECTS: readonly WindowEffect[] = ["none", "acrylic", "mica"];

/** How much of the app background still covers the desktop, 0–100. */
export const DEFAULT_WINDOW_OPACITY = 60;

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
const [accent, setAccentSignal] = createSignal<Accent>("purple");
const [playerLayout, setPlayerLayoutSignal] =
  createSignal<PlayerLayout>("docked");
const [uiStyle, setUiStyleSignal] = createSignal<UiStyle>("standard");
const [glassBrightness, setGlassBrightnessSignal] = createSignal(
  DEFAULT_GLASS_BRIGHTNESS,
);
const [glassBrightnessLight, setGlassBrightnessLightSignal] = createSignal(
  DEFAULT_GLASS_BRIGHTNESS_LIGHT,
);
/** Whether the dark palette is showing right now (resolves "system"). */
const [darkActive, setDarkActive] = createSignal(true);
const [glassBlur, setGlassBlurSignal] = createSignal(DEFAULT_GLASS_BLUR);
const [windowEffect, setWindowEffectSignal] =
  createSignal<WindowEffect>("none");
const [windowOpacity, setWindowOpacitySignal] = createSignal(
  DEFAULT_WINDOW_OPACITY,
);
const [audioPlayer, setAudioPlayerSignal] = createSignal<AudioPlayer>("web");
const [discordPresence, setDiscordPresenceSignal] = createSignal(false);
const [autoUpdate, setAutoUpdateSignal] = createSignal(true);
const [audioDeviceId, setAudioDeviceIdSignal] = createSignal<string>(
  DEFAULT_AUDIO_DEVICE,
);
/** mpv's own device name, e.g. `wasapi/{...}`; `auto` lets mpv decide. */
const [mpvAudioDevice, setMpvAudioDeviceSignal] = createSignal<string>(
  DEFAULT_MPV_AUDIO_DEVICE,
);
/** Show a small reading line (romaji, pinyin, …) under each lyric line. */
const [phoneticLyrics, setPhoneticLyricsSignal] = createSignal(false);

export {
  theme,
  scrobble,
  maxBitRate,
  streamFormat,
  font,
  accent,
  playerLayout,
  uiStyle,
  glassBrightness,
  glassBrightnessLight,
  darkActive,
  glassBlur,
  windowEffect,
  windowOpacity,
  audioPlayer,
  discordPresence,
  audioDeviceId,
  mpvAudioDevice,
  autoUpdate,
  phoneticLyrics,
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

function applyAccent(value: Accent) {
  document.documentElement.style.setProperty(
    "--brand-h",
    String(ACCENT_HUES[value]),
  );
}

/** Glass styling in app.css keys off `html[data-style="glass"]`. */
function applyUiStyle(value: UiStyle) {
  document.documentElement.dataset.style = value;
}

/** Feeds `--glass-level` (0–1) in app.css. */
/** Feeds `--glass-level` (dark) and `--glass-level-light` in app.css. */
function applyGlassBrightness(dark: number, light: number) {
  const root = document.documentElement.style;
  root.setProperty("--glass-level", String(dark / 100));
  root.setProperty("--glass-level-light", String(light / 100));
}

function applyGlassBlur(value: number) {
  document.documentElement.style.setProperty("--glass-blur", `${value}px`);
}

function applyWindowOpacity(value: number) {
  document.documentElement.style.setProperty(
    "--window-opacity",
    String(value / 100),
  );
}

/**
 * Turns the Windows material on only while liquid glass is selected; app.css
 * clears the page background under `html[data-window-effect]` so it shows.
 */
function applyWindowEffect() {
  const effect =
    isTauri && uiStyle() === "glass" ? windowEffect() : ("none" as const);
  const root = document.documentElement;
  if (effect === "none") delete root.dataset.windowEffect;
  else root.dataset.windowEffect = effect;
  if (!isTauri) return;

  void import("@tauri-apps/api/window")
    .then(({ getCurrentWindow, Effect }) => {
      const appWindow = getCurrentWindow();
      if (effect === "none") return appWindow.clearEffects();
      return appWindow.setEffects({
        effects: [effect === "mica" ? Effect.Mica : Effect.Acrylic],
      });
    })
    .catch((error) => console.error("Failed to set window effect", error));
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
  setDarkActive(dark);
}

/** A saved 0..max number, or the fallback when it is missing or garbled. */
function clampSetting(value: unknown, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(0, value))
    : fallback;
}

export async function initSettings(): Promise<void> {
  const [
    savedTheme,
    savedScrobble,
    savedBitRate,
    savedFormat,
    savedFont,
    savedAccent,
    savedPlayer,
    savedDevice,
    savedMpvDevice,
    savedDiscordPresence,
    savedAutoUpdate,
    savedPlayerLayout,
    savedUiStyle,
    savedGlassBrightness,
    savedGlassBrightnessLight,
    savedGlassBlur,
    savedWindowEffect,
    savedWindowOpacity,
    savedPhoneticLyrics,
  ] = await Promise.all([
    readSetting<Theme>("theme", "dark"),
    readSetting<boolean>("scrobble", true),
    readSetting<number>("maxBitRate", 0),
    readSetting<StreamFormat>("streamFormat", "raw"),
    readSetting<Font>("font", "system"),
    readSetting<Accent>("accent", "purple"),
    readSetting<AudioPlayer>("audioPlayer", "web"),
    readSetting<string>("audioDeviceId", DEFAULT_AUDIO_DEVICE),
    readSetting<string>("mpvAudioDevice", DEFAULT_MPV_AUDIO_DEVICE),
    readSetting<boolean>("discordPresence", false),
    readSetting<boolean>("autoUpdate", true),
    readSetting<PlayerLayout>("playerLayout", "docked"),
    readSetting<UiStyle>("uiStyle", "standard"),
    readSetting<number>("glassBrightness", DEFAULT_GLASS_BRIGHTNESS),
    readSetting<number>("glassBrightnessLight", DEFAULT_GLASS_BRIGHTNESS_LIGHT),
    readSetting<number>("glassBlur", DEFAULT_GLASS_BLUR),
    readSetting<WindowEffect>("windowEffect", "none"),
    readSetting<number>("windowOpacity", DEFAULT_WINDOW_OPACITY),
    readSetting<boolean>("phoneticLyrics", false),
  ]);

  const nextTheme: Theme =
    savedTheme === "light" || savedTheme === "system" ? savedTheme : "dark";
  const nextFont: Font = savedFont === "sarabun" ? "sarabun" : "system";
  const nextAccent: Accent = Object.prototype.hasOwnProperty.call(
    ACCENT_HUES,
    savedAccent,
  )
    ? savedAccent
    : "purple";
  const nextPlayer: AudioPlayer = AUDIO_PLAYERS.includes(savedPlayer)
    ? savedPlayer
    : "web";
  setThemeSignal(nextTheme);
  setScrobbleSignal(savedScrobble !== false);
  setMaxBitRateSignal(typeof savedBitRate === "number" ? savedBitRate : 0);
  setStreamFormatSignal(savedFormat ?? "raw");
  setFontSignal(nextFont);
  setAccentSignal(nextAccent);
  setAudioPlayerSignal(nextPlayer);
  setDiscordPresenceSignal(savedDiscordPresence === true);
  setAutoUpdateSignal(savedAutoUpdate !== false);
  setPhoneticLyricsSignal(savedPhoneticLyrics === true);
  setPlayerLayoutSignal(
    savedPlayerLayout === "floating" ? "floating" : "docked",
  );
  const nextUiStyle: UiStyle = savedUiStyle === "glass" ? "glass" : "standard";
  setUiStyleSignal(nextUiStyle);
  const nextGlassBrightness = clampSetting(
    savedGlassBrightness,
    100,
    DEFAULT_GLASS_BRIGHTNESS,
  );
  setGlassBrightnessSignal(nextGlassBrightness);
  const nextGlassBrightnessLight = clampSetting(
    savedGlassBrightnessLight,
    100,
    DEFAULT_GLASS_BRIGHTNESS_LIGHT,
  );
  setGlassBrightnessLightSignal(nextGlassBrightnessLight);
  const nextGlassBlur = clampSetting(
    savedGlassBlur,
    MAX_GLASS_BLUR,
    DEFAULT_GLASS_BLUR,
  );
  setGlassBlurSignal(nextGlassBlur);
  setWindowEffectSignal(
    WINDOW_EFFECTS.includes(savedWindowEffect) ? savedWindowEffect : "none",
  );
  const nextWindowOpacity = clampSetting(
    savedWindowOpacity,
    100,
    DEFAULT_WINDOW_OPACITY,
  );
  setWindowOpacitySignal(nextWindowOpacity);
  setAudioDeviceIdSignal(savedDevice || DEFAULT_AUDIO_DEVICE);
  setMpvAudioDeviceSignal(savedMpvDevice || DEFAULT_MPV_AUDIO_DEVICE);
  apply(nextTheme);
  applyFont(nextFont);
  applyAccent(nextAccent);
  applyUiStyle(nextUiStyle);
  applyGlassBrightness(nextGlassBrightness, nextGlassBrightnessLight);
  applyGlassBlur(nextGlassBlur);
  applyWindowOpacity(nextWindowOpacity);
  applyWindowEffect();

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

export function setAccent(value: Accent): void {
  setAccentSignal(value);
  applyAccent(value);
  void writeSetting("accent", value);
}

export function setPlayerLayout(value: PlayerLayout): void {
  setPlayerLayoutSignal(value);
  void writeSetting("playerLayout", value);
}

export function setUiStyle(value: UiStyle): void {
  setUiStyleSignal(value);
  applyUiStyle(value);
  applyWindowEffect();
  void writeSetting("uiStyle", value);
}

/** Updates the look live; pass `save: false` while a slider is still dragging. */
/** Sets the brightness of whichever theme is showing; each keeps its own. */
export function setGlassBrightness(value: number, save = true): void {
  if (darkActive()) {
    setGlassBrightnessSignal(value);
    if (save) void writeSetting("glassBrightness", value);
  } else {
    setGlassBrightnessLightSignal(value);
    if (save) void writeSetting("glassBrightnessLight", value);
  }
  applyGlassBrightness(glassBrightness(), glassBrightnessLight());
}

export function setGlassBlur(value: number, save = true): void {
  setGlassBlurSignal(value);
  applyGlassBlur(value);
  if (save) void writeSetting("glassBlur", value);
}

export function setWindowEffect(value: WindowEffect): void {
  setWindowEffectSignal(value);
  applyWindowEffect();
  void writeSetting("windowEffect", value);
}

export function setWindowOpacity(value: number, save = true): void {
  setWindowOpacitySignal(value);
  applyWindowOpacity(value);
  if (save) void writeSetting("windowOpacity", value);
}

export function setAudioPlayer(value: AudioPlayer): void {
  setAudioPlayerSignal(value);
  void writeSetting("audioPlayer", value);
}

export function setDiscordPresence(value: boolean): void {
  setDiscordPresenceSignal(value);
  void writeSetting("discordPresence", value);
}

export function setAutoUpdate(value: boolean): void {
  setAutoUpdateSignal(value);
  void writeSetting("autoUpdate", value);
}

export function setPhoneticLyrics(value: boolean): void {
  setPhoneticLyricsSignal(value);
  void writeSetting("phoneticLyrics", value);
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
