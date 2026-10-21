import { createSignal } from "solid-js";
import { readSetting, writeSetting } from "~/lib/storage";

export type Theme = "dark" | "light" | "system";
export type StreamFormat = "raw" | "mp3" | "aac" | "opus" | "flac";

const [theme, setThemeSignal] = createSignal<Theme>("dark");
const [scrobble, setScrobbleSignal] = createSignal(true);
const [maxBitRate, setMaxBitRateSignal] = createSignal(0);
const [streamFormat, setStreamFormatSignal] = createSignal<StreamFormat>("raw");

export { theme, scrobble, maxBitRate, streamFormat };

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
  const [savedTheme, savedScrobble, savedBitRate, savedFormat] =
    await Promise.all([
      readSetting<Theme>("theme", "dark"),
      readSetting<boolean>("scrobble", true),
      readSetting<number>("maxBitRate", 0),
      readSetting<StreamFormat>("streamFormat", "raw"),
    ]);

  const nextTheme: Theme =
    savedTheme === "light" || savedTheme === "system" ? savedTheme : "dark";
  setThemeSignal(nextTheme);
  setScrobbleSignal(savedScrobble !== false);
  setMaxBitRateSignal(typeof savedBitRate === "number" ? savedBitRate : 0);
  setStreamFormatSignal(savedFormat ?? "raw");
  apply(nextTheme);

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
