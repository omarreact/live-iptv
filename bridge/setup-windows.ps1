[CmdletBinding()]
param(
    [string]$DhakaFlixBase = "http://172.16.50.14/DHAKA-FLIX-14/",
    [string]$CineplexBase = "http://cineplexbd.net/",
    [string]$PinflixOrigin = "https://iptv.pincodeit.com",
    [string]$PublicBridgeUrl = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function New-HexSecret {
    param([int]$Bytes = 32)
    $data = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($data)
    return -join ($data | ForEach-Object { $_.ToString("x2") })
}

function Test-Url {
    param(
        [string]$Label,
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing -TimeoutSec 8
        Write-Host ("[OK] {0} -> HTTP {1}" -f $Label, $response.StatusCode) -ForegroundColor Green
        return $true
    }
    catch {
        Write-Warning ("{0} is not reachable from this PC: {1}" -f $Label, $_.Exception.Message)
        return $false
    }
}

$bridgeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $bridgeDir

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    throw "Node.js was not found. Install Node.js 24.x, then run this script again."
}

$nodeVersion = (& node -p "process.versions.node").Trim()
$nodeMajor = [int]($nodeVersion.Split(".")[0])
if ($nodeMajor -lt 24) {
    throw "Node.js 24.x is required. Detected $nodeVersion."
}
Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green

$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ffmpeg) {
    Write-Host "[OK] FFmpeg found at $($ffmpeg.Source)" -ForegroundColor Green
} else {
    Write-Warning "FFmpeg was not found. Direct/HLS playback can still work, but MKV/HEVC compatibility transcoding will be unavailable."
}

$dhakaOk = Test-Url -Label "DHAKA-FLIX" -Url $DhakaFlixBase
$cineplexOk = Test-Url -Label "CineplexBD" -Url $CineplexBase

$bridgeSecret = New-HexSecret
$tokenKey = New-HexSecret
$mediaTokenKey = New-HexSecret

$sources = @(
    @{
        id = "dhakaflix-movies"
        name = "DHAKA-FLIX Movies"
        description = "Movies reachable on the local ISP network"
        adapter = "dhakaflix-json"
        baseUrl = $DhakaFlixBase
    },
    @{
        id = "cineplexbd"
        name = "CineplexBD"
        description = "CineplexBD catalog reachable from this network"
        adapter = "cineplexbd"
        baseUrl = $CineplexBase
    }
)
$mediaJson = $sources | ConvertTo-Json -Compress -Depth 5

$lines = @(
    "PORT=8787"
    "BRIDGE_SECRET=$bridgeSecret"
    "BRIDGE_TOKEN_KEY=$tokenKey"
    "BRIDGE_MEDIA_TOKEN_KEY=$mediaTokenKey"
    ""
    "IPTV_PLAYER_BASE=http://172.16.14.1"
    "ALLOWED_STREAM_IDS=105"
    ""
    "PINFLIX_APP_ORIGIN=$PinflixOrigin"
)

if ($PublicBridgeUrl.Trim()) {
    $lines += "BRIDGE_PUBLIC_URL=$($PublicBridgeUrl.TrimEnd('/'))"
}

$lines += @(
    ""
    "MEDIA_SOURCES_JSON=$mediaJson"
    ""
    "FFMPEG_PATH=ffmpeg"
    "FFMPEG_VIDEO_CODEC=libx264"
    "FFMPEG_PRESET=veryfast"
)

$envPath = Join-Path $bridgeDir ".env"
[System.IO.File]::WriteAllLines($envPath, $lines, [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "Created $envPath" -ForegroundColor Cyan
Write-Host "Bridge secret (also use as PINFLIX_BD_BRIDGE_SECRET in Vercel):" -ForegroundColor Yellow
Write-Host $bridgeSecret -ForegroundColor Yellow
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  1. Run: npm start"
Write-Host "  2. Verify locally: http://127.0.0.1:8787/health"
Write-Host "  3. Publish port 8787 through an HTTPS tunnel/reverse proxy."
Write-Host "  4. In Vercel set:"
Write-Host "       PINFLIX_BD_BRIDGE_URL=https://your-bridge-hostname"
Write-Host "       PINFLIX_BD_BRIDGE_SECRET=$bridgeSecret"
Write-Host ""
if (-not $dhakaOk -or -not $cineplexOk) {
    Write-Warning "At least one provider was not reachable during setup. The bridge can still start, but that provider will remain unavailable until this PC/network can reach it."
}
