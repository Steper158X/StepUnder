# Downloads an official shinchiro libmpv build and copies libmpv-2.dll into
# src-tauri\resources, where Tauri picks it up for both dev runs and installers.
#
# Usage:
#   pwsh scripts/fetch-libmpv.ps1
#   bun run mpv:fetch                                     # same as above
#   pwsh scripts/fetch-libmpv.ps1 -Version 20261021      # pin a release
#
# Builds come from https://github.com/shinchiro/mpv-winbuild-cmake/releases
# (the same maintainer as the SourceForge mpv-player-windows project). GitHub
# is used because SourceForge rejects non-browser clients with HTTP 403.
#
# The DLL goes to `src-tauri\resources`, which Tauri copies into the build
# output and into installers (next to StepUnder.exe on Windows), so both
# `tauri dev` and a release build use it. It is only needed when you pick
# "MPV (libmpv)" in Settings.

param(
    [string]$Destination = "src-tauri\resources",
    [ValidateSet("x86_64", "aarch64", "i686")][string]$Arch = "x86_64",
    [string]$Version = "latest"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$repo = "shinchiro/mpv-winbuild-cmake"
$api = if ($Version -eq "latest") {
    "https://api.github.com/repos/$repo/releases/latest"
} else {
    "https://api.github.com/repos/$repo/releases/tags/$Version"
}

$headers = @{
    "User-Agent" = "StepUnder-build"
    "Accept"     = "application/vnd.github+json"
}
# Optional: avoids the anonymous GitHub API rate limit on shared CI runners.
if ($env:GITHUB_TOKEN) {
    $headers["Authorization"] = "Bearer $env:GITHUB_TOKEN"
}

function Invoke-WithRetry([scriptblock]$Action, [string]$What) {
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            return & $Action
        } catch {
            if ($attempt -eq 3) { throw "$What failed: $($_.Exception.Message)" }
            Write-Host "  $What failed (attempt $attempt), retrying..."
            Start-Sleep -Seconds 2
        }
    }
}

Write-Host "Looking up libmpv ($Arch, $Version) on GitHub..."
$release = Invoke-WithRetry {
    Invoke-RestMethod -Uri $api -Headers $headers
} "GitHub API request"

$pattern = "^mpv-dev-$([regex]::Escape($Arch))-\d{8}-git-[0-9a-f]+\.7z$"
$asset = $release.assets | Where-Object { $_.name -match $pattern } | Select-Object -First 1
if (-not $asset) {
    throw "Could not find a $Arch libmpv build in release $($release.tag_name)."
}

$temp = Join-Path ([IO.Path]::GetTempPath()) "stepunder-libmpv"
Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $temp | Out-Null
$archive = Join-Path $temp $asset.name

Write-Host ("Downloading {0} ({1:N1} MB)..." -f $asset.name, ($asset.size / 1MB))
# Do not send the API Authorization header to the redirect target
# (objects.githubusercontent.com); the asset itself is public.
$downloadHeaders = @{ "User-Agent" = "StepUnder-build" }
Invoke-WithRetry {
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archive -Headers $downloadHeaders -UseBasicParsing
} "Download"

# GitHub's Windows images ship 7-Zip; fall back to Windows' bundled bsdtar.
$sevenZip = $null
$sevenZipCommand = Get-Command 7z.exe -ErrorAction SilentlyContinue
if ($sevenZipCommand) {
    $sevenZip = $sevenZipCommand.Source
} elseif (Test-Path (Join-Path $env:ProgramFiles "7-Zip\7z.exe")) {
    $sevenZip = Join-Path $env:ProgramFiles "7-Zip\7z.exe"
}

if ($sevenZip) {
    & $sevenZip x $archive "-o$temp" -y | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "7-Zip could not extract $($asset.name)." }
} else {
    tar.exe -xf $archive -C $temp
    if ($LASTEXITCODE -ne 0) { throw "tar could not extract $($asset.name)." }
}

$dll = Join-Path $temp "libmpv-2.dll"
if (-not (Test-Path $dll)) { throw "libmpv-2.dll was not found in $($asset.name)." }

New-Item -ItemType Directory -Force $Destination | Out-Null
$target = Join-Path $Destination "libmpv-2.dll"
try {
    Copy-Item $dll $target -Force
} catch {
    throw "Could not replace $target - close StepUnder and run the script again. ($($_.Exception.Message))"
}
Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Installed libmpv ($($release.tag_name)) into $Destination"
