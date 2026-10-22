fn main() {
    // tauri-build embeds the app icons (icon.ico on Windows, icon.png on
    // Linux, icon.icns on macOS) into the binary but does not tell Cargo to
    // watch them, so regenerating the icons would silently keep the old
    // window/taskbar icon until a full clean build. Watch them explicitly.
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=icons/icon.png");
    println!("cargo:rerun-if-changed=icons/icon.icns");

    tauri_build::build()
}
