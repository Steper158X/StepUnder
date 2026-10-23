# Build a signed Windows release locally (NSIS installer + updater artifacts).
#
# Usage:
#   bun run build:release
#
# The private key stays in src-tauri\keys (git-ignored). CI uses the
# TAURI_SIGNING_PRIVATE_KEY repository secret instead.

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$key = Join-Path $root "src-tauri\keys\stepunder.key"

if (-not (Test-Path $key)) {
    throw "Missing $key. Generate one with: bunx tauri signer generate -w src-tauri/keys/stepunder.key"
}

# Tauri accepts either a path or the key contents; the contents also work in CI.
$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content $key -Raw).Trim()
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""

Push-Location $root
try {
    bun run tauri build --bundles nsis
} finally {
    Pop-Location
}
