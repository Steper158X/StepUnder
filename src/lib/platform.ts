import { createSignal } from "solid-js";

/** True when running inside a Tauri webview (as opposed to a plain browser). */
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";

/** WebView2 on Windows. Mica/Acrylic and the volume-mixer fix only exist here. */
export const isWindows = /Windows/i.test(userAgent);

/** WebKitGTK on Linux (Ubuntu, Pop!_OS, Fedora, …). */
export const isLinux = !isWindows && /Linux/i.test(userAgent) && !/Android/i.test(userAgent);

/** Android or iOS: no desktop window to minimize, maximize or close. */
export const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent);

/** Below Tailwind's `md` breakpoint: the phone layout. */
const narrowQuery =
  typeof window !== "undefined"
    ? window.matchMedia("(max-width: 767.98px)")
    : null;
const [narrow, setNarrow] = createSignal(narrowQuery?.matches ?? false);
narrowQuery?.addEventListener("change", (event) => setNarrow(event.matches));

/** Reactive: true while the window is phone-sized. */
export const isNarrow = narrow;

/**
 * The desktop app (Windows, macOS, Linux): file manager, folder picker,
 * updater, mpv and Discord only exist here.
 */
export const isDesktopApp = isTauri && !isMobile;
