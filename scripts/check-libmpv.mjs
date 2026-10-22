// Guards release builds: the Windows installer bundles libmpv-2.dll, so an
// installer built without it would ship a broken MPV audio player.
//
// `bun run mpv:fetch` downloads it into src-tauri/resources.

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

if (process.platform === "win32") {
  const dll = resolve("src-tauri/resources/libmpv-2.dll");
  const present = existsSync(dll) && statSync(dll).size > 0;

  if (!present) {
    console.error(
      [
        "",
        "libmpv-2.dll is missing from src-tauri/resources.",
        "The installer bundles this file for the MPV audio player.",
        "",
        "Run `bun run mpv:fetch` (or copy a 64-bit libmpv-2.dll there),",
        "then build again. Use `bun run tauri dev` if you only need the app",
        "with the built-in web player.",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
}
