$ErrorActionPreference = 'Stop'
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Cek dependensi
Write-Host 'Memeriksa Dependensi Sistem...' -ForegroundColor Cyan
try {
    & (Join-Path $ScriptRoot 'CheckDependencies.ps1')
} catch {
    Write-Host "Gagal memeriksa dependensi." -ForegroundColor Red
    exit 1
}

# Refresh Environment Variables (terutama PATH)
# Ini memastikan bahwa jika winget baru saja menginstal Node.js/FFmpeg/yt-dlp,
# command prompt saat ini bisa langsung mendeteksinya tanpa harus restart terminal.
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")


# Mode GUI Langsung
$ServerDir = Join-Path $ScriptRoot 'server'

if (-not (Test-Path -LiteralPath (Join-Path $ServerDir 'node_modules'))) {
    Write-Host 'Menginstall dependensi Node.js pertama kali...' -ForegroundColor Cyan
    Set-Location -LiteralPath $ServerDir
    & npm install
}

# Fungsi deteksi browser
function Get-InstalledBrowsers {
    $browsers = @()
    
    # Chrome
    $chromePath = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
    $chromePath86 = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    if (Test-Path $chromePath) { $browsers += [pscustomobject]@{ Name = 'Chrome'; Path = $chromePath } }
    elseif (Test-Path $chromePath86) { $browsers += [pscustomobject]@{ Name = 'Chrome'; Path = $chromePath86 } }
    
    # Edge
    $edgePath = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    if (Test-Path $edgePath) { $browsers += [pscustomobject]@{ Name = 'Edge'; Path = $edgePath } }
    
    # Brave
    $bravePath = "${env:ProgramFiles}\BraveSoftware\Brave-Browser\Application\brave.exe"
    if (Test-Path $bravePath) { $browsers += [pscustomobject]@{ Name = 'Brave'; Path = $bravePath } }
    
    # Vivaldi
    $vivaldiPath = "${env:LOCALAPPDATA}\Vivaldi\Application\vivaldi.exe"
    if (Test-Path $vivaldiPath) { $browsers += [pscustomobject]@{ Name = 'Vivaldi'; Path = $vivaldiPath } }
    
    # Firefox
    $ffPath = "${env:ProgramFiles}\Mozilla Firefox\firefox.exe"
    if (Test-Path $ffPath) { $browsers += [pscustomobject]@{ Name = 'Firefox'; Path = $ffPath } }
    
    return $browsers
}

$browsers = Get-InstalledBrowsers
$selectedBrowser = $null

if ($browsers.Count -gt 0) {
    Write-Host ''
    Write-Host 'Pilih browser untuk membuka GUI:' -ForegroundColor Cyan
    $i = 1
    $defaultIndex = 1
    foreach ($b in $browsers) {
        $indicator = if ($b.Name -eq 'Chrome') { $defaultIndex = $i; ' (Default Target)' } else { '' }
        Write-Host "[$i] $($b.Name)$indicator"
        $i++
    }
    Write-Host "[0] Gunakan Default System Browser"
    
    $choice = Read-Host "Pilih browser (Tekan ENTER untuk default: $($browsers[$defaultIndex-1].Name))"
    if ([string]::IsNullOrWhiteSpace($choice)) {
        $selectedBrowser = $browsers[$defaultIndex-1].Path
    } elseif ($choice -match '^[1-9]$' -and [int]$choice -le $browsers.Count) {
        $selectedBrowser = $browsers[[int]$choice - 1].Path
    }
}

$Url = "http://localhost:3000"
Write-Host ''
Write-Host "Membuka browser ke $Url ..." -ForegroundColor Green

if ($selectedBrowser) {
    Start-Process -FilePath $selectedBrowser -ArgumentList $Url
} else {
    Start-Process $Url
}

Write-Host "Menyalakan Backend Node.js... (Terminal ini JANGAN ditutup selama Anda menggunakan GUI)" -ForegroundColor Yellow
Set-Location -LiteralPath $ServerDir
& node index.js
