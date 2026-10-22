# StepUnder

A lightweight desktop client for Navidrome and other Subsonic-compatible
servers, built with Tauri + Solid + TypeScript.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Audio players

Settings → Playback → **Audio player** offers two playback engines:

| Engine           | Description                                                   |
| ---------------- | ------------------------------------------------------------- |
| `Web (built-in)` | The HTML5 player in the webview. Default, nothing to install. |
| `MPV (libmpv)`   | libmpv playback with wider codec/format support.              |

### libmpv

libmpv is loaded **at runtime**, so the app builds and runs without it; the
option only becomes usable once the library is present. StepUnder looks for it
in this order:

1. The path in the `STEPUNDER_LIBMPV` environment variable.
2. The folder next to the executable: `libmpv-2.dll` (Windows),
   `libmpv.2.dylib` (macOS), `libmpv.so.2` (Linux).
3. Common install locations (`%ProgramFiles%\mpv`, Homebrew, `/usr/lib`, …).
4. The platform library search path.

On Windows the quickest way to get a compatible build is:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\fetch-libmpv.ps1
powershell -ExecutionPolicy Bypass -File scripts\fetch-libmpv.ps1 -Destination src-tauri\target\release
```

The script drops `libmpv-2.dll` next to the debug (or release) executable.
Close StepUnder first if it is already running.

Or download an `mpv-dev-*.7z` from the
[mpv-player-windows libmpv folder](https://sourceforge.net/projects/mpv-player-windows/files/libmpv/)
and copy `libmpv-2.dll` next to `StepUnder.exe`.

On Linux/macOS install the mpv development package
(`libmpv2`/`libmpv-dev`, or `brew install mpv`) and the shared library is
picked up automatically.

Notes:

- While MPV is selected, playback state (position, duration, play/pause) comes
  from libmpv; the built-in player is stopped.
- The **Audio device** setting applies to the web player. MPV plays through the
  output libmpv chooses (the system default).
- If libmpv is missing when MPV is selected, Settings shows the searched paths
  and the app falls back to the web player.
