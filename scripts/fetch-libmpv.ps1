# Downloads the latest shinchiro libmpv build and copies libmpv-2.dll next to
# the StepUnder executable, where the MPV audio player looks for it.
#
# Usage:
#   pwsh scripts/fetch-libmpv.ps1                       # debug build
#   pwsh scripts/fetch-libmpv.ps1 -Destination src-tauri\target\release
#
# The DLL is only needed when you pick "MPV (libmpv)" in Settings.

param(
    [string]$Destination = "src-tauri\target\debug",
    [ValidateSet("x86_64", "aarch64")][string]$Arch = "x86_64"
)

$ErrorActionPreference = "Stop"

function Get-Text([string]$Url) {
    $client = New-Object System.Net.WebClient
    try { $client.DownloadString($Url) } finally { $client.Dispose() }
}

function Get-File([string]$Url, [string]$Path) {
    $client = New-Object System.Net.WebClient
    try { $client.DownloadFile($Url, $Path) } finally { $client.Dispose() }
}

[xml]$feed = Get-Text "https://sourceforge.net/projects/mpv-player-windows/rss?path=/libmpv"
$pattern = "^/libmpv/mpv-dev-$Arch-\d{8}-git-[0-9a-f]+\.7z$"
$entry = $null
foreach ($item in @($feed.rss.channel.item)) {
    $title = $item.SelectSingleNode("title").InnerText
    if ($title -match $pattern) {
        $entry = $item
        break
    }
}
if (-not $entry) { throw "Could not find a libmpv release for $Arch" }

$url = $entry.SelectSingleNode("link").InnerText
Write-Host "Downloading $title"
$temp = Join-Path $env:TEMP "stepunder-libmpv"
New-Item -ItemType Directory -Force $temp | Out-Null
$archive = Join-Path $temp "mpv-dev.7z"
Get-File $url $archive

# Windows ships bsdtar, which can read 7z archives.
tar.exe -xf $archive -C $temp
$dll = Join-Path $temp "libmpv-2.dll"
if (-not (Test-Path $dll)) { throw "libmpv-2.dll was not found in the archive" }

New-Item -ItemType Directory -Force $Destination | Out-Null
$target = Join-Path $Destination "libmpv-2.dll"
try {
    Copy-Item $dll $target -Force
} catch {
    throw "Could not replace $target — close StepUnder and run the script again. ($($_.Exception.Message))"
}
Remove-Item $archive -Force

Write-Host "Installed libmpv-2.dll into $Destination"
