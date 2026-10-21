/** True when running inside a Tauri webview (as opposed to a plain browser). */
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
