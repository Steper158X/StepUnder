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
