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

/**
 * Blur of synced lyric lines around the one being sung; it grows with the
 * distance from that line.
 */
export type LyricsBlur = "off" | "soft" | "strong";

const LYRICS_BLURS: readonly LyricsBlur[] = ["off", "soft", "strong"];

/** Blur of the furthest lines, in px. */
export const LYRICS_BLUR_MAX: Record<LyricsBlur, number> = {
  off: 0,
  soft: 3,
  strong: 6,
};

/** Folder layout for downloaded files, inside the download folder. */
export type DownloadLayout = "artist-album" | "album" | "flat";

const DOWNLOAD_LAYOUTS: readonly DownloadLayout[] = [
  "artist-album",
  "album",
  "flat",
];

export const DEFAULT_DOWNLOAD_CONCURRENCY = 3;
export const MAX_DOWNLOAD_CONCURRENCY = 5;

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
const [lyricsBlur, setLyricsBlurSignal] = createSignal<LyricsBlur>("soft");
/** Blur more the further a line is from the sung one, instead of evenly. */
const [lyricsBlurSmooth, setLyricsBlurSmoothSignal] = createSignal(true);
/** Keep a lyrics panel in the right column, sharing it with the queue. */
const [sideLyrics, setSideLyricsSignal] = createSignal(false);
/** Accent bar on the left of the lyric line being sung. */
const [lyricsLineMarker, setLyricsLineMarkerSignal] = createSignal(false);
/** Where downloads go; empty means the default `Music/StepUnder` folder. */
const [downloadDir, setDownloadDirSignal] = createSignal("");
/** Play a downloaded copy instead of streaming when one exists. */
const [preferLocal, setPreferLocalSignal] = createSignal(true);
const [downloadFormat, setDownloadFormatSignal] =
  createSignal<StreamFormat>("raw");
const [downloadBitRate, setDownloadBitRateSignal] = createSignal(0);
const [downloadLayout, setDownloadLayoutSignal] =
  createSignal<DownloadLayout>("artist-album");
const [downloadConcurrency, setDownloadConcurrencySignal] = createSignal(
  DEFAULT_DOWNLOAD_CONCURRENCY,
);
/** Download a song as soon as it is added to favorites. */
const [downloadOnStar, setDownloadOnStarSignal] = createSignal(false);

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
  lyricsBlur,
  lyricsBlurSmooth,
  sideLyrics,
  lyricsLineMarker,
  downloadDir,
  preferLocal,
  downloadFormat,
  downloadBitRate,
  downloadLayout,
  downloadConcurrency,
  downloadOnStar,
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
    savedLyricsBlur,
    savedLyricsBlurSmooth,
    savedSideLyrics,
    savedLyricsLineMarker,
    savedDownloadDir,
    savedPreferLocal,
    savedDownloadFormat,
    savedDownloadBitRate,
    savedDownloadLayout,
    savedDownloadConcurrency,
    savedDownloadOnStar,
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
    readSetting<LyricsBlur>("lyricsBlur", "soft"),
    readSetting<boolean>("lyricsBlurSmooth", true),
    readSetting<boolean>("sideLyrics", false),
    readSetting<boolean>("lyricsLineMarker", false),
    readSetting<string>("downloadDir", ""),
    readSetting<boolean>("preferLocal", true),
    readSetting<StreamFormat>("downloadFormat", "raw"),
    readSetting<number>("downloadBitRate", 0),
    readSetting<DownloadLayout>("downloadLayout", "artist-album"),
    readSetting<number>("downloadConcurrency", DEFAULT_DOWNLOAD_CONCURRENCY),
    readSetting<boolean>("downloadOnStar", false),
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
  setLyricsBlurSignal(
    LYRICS_BLURS.includes(savedLyricsBlur) ? savedLyricsBlur : "soft",
  );
  setLyricsBlurSmoothSignal(savedLyricsBlurSmooth !== false);
  setSideLyricsSignal(savedSideLyrics === true);
  setLyricsLineMarkerSignal(savedLyricsLineMarker === true);
  setDownloadDirSignal(
    typeof savedDownloadDir === "string" ? savedDownloadDir : "",
  );
  setPreferLocalSignal(savedPreferLocal !== false);
  setDownloadFormatSignal(savedDownloadFormat ?? "raw");
  setDownloadBitRateSignal(
    typeof savedDownloadBitRate === "number" ? savedDownloadBitRate : 0,
  );
  setDownloadLayoutSignal(
    DOWNLOAD_LAYOUTS.includes(savedDownloadLayout)
      ? savedDownloadLayout
      : "artist-album",
  );
  setDownloadConcurrencySignal(
    Math.max(
      1,
      clampSetting(
        savedDownloadConcurrency,
        MAX_DOWNLOAD_CONCURRENCY,
        DEFAULT_DOWNLOAD_CONCURRENCY,
      ),
    ),
  );
  setDownloadOnStarSignal(savedDownloadOnStar === true);
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

export function setLyricsBlur(value: LyricsBlur): void {
  setLyricsBlurSignal(value);
  void writeSetting("lyricsBlur", value);
}

export function setLyricsBlurSmooth(value: boolean): void {
  setLyricsBlurSmoothSignal(value);
  void writeSetting("lyricsBlurSmooth", value);
}

export function setSideLyrics(value: boolean): void {
  setSideLyricsSignal(value);
  void writeSetting("sideLyrics", value);
}

export function setLyricsLineMarker(value: boolean): void {
  setLyricsLineMarkerSignal(value);
  void writeSetting("lyricsLineMarker", value);
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

export function setDownloadDir(value: string): void {
  setDownloadDirSignal(value);
  void writeSetting("downloadDir", value);
}

export function setPreferLocal(value: boolean): void {
  setPreferLocalSignal(value);
  void writeSetting("preferLocal", value);
}

export function setDownloadFormat(value: StreamFormat): void {
  setDownloadFormatSignal(value);
  void writeSetting("downloadFormat", value);
}

export function setDownloadBitRate(value: number): void {
  setDownloadBitRateSignal(value);
  void writeSetting("downloadBitRate", value);
}

export function setDownloadLayout(value: DownloadLayout): void {
  setDownloadLayoutSignal(value);
  void writeSetting("downloadLayout", value);
}

export function setDownloadConcurrency(value: number): void {
  const next = Math.min(MAX_DOWNLOAD_CONCURRENCY, Math.max(1, value));
  setDownloadConcurrencySignal(next);
  void writeSetting("downloadConcurrency", next);
}

export function setDownloadOnStar(value: boolean): void {
  setDownloadOnStarSignal(value);
  void writeSetting("downloadOnStar", value);
}
