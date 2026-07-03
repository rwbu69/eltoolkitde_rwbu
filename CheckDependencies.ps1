$ErrorActionPreference = 'Stop'

function Wait-Toolkit {
    Write-Host ''
    Write-Host 'Tekan ENTER untuk lanjut...' -ForegroundColor DarkGray
    [void](Read-Host)
}

function Clear-AndHeader {
    param([Parameter(Mandatory)][string]$Title)
    Clear-Host
    try { $host.UI.RawUI.WindowTitle = $Title } catch {}
    Write-Host '======================================================' -ForegroundColor Cyan
    Write-Host ("  {0}" -f $Title) -ForegroundColor Cyan
    Write-Host '======================================================' -ForegroundColor Cyan
    Write-Host ''
}

function Test-CommandExists {
    param([Parameter(Mandatory)][string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Confirm-ToolkitInstall {
    param(
        [Parameter(Mandatory)][string]$AppName
    )

    Write-Host ''
    Write-Host "WARNING: '$AppName' tidak tersedia." -ForegroundColor Yellow
    Write-Host "Aplikasi ini tidak tersedia, akan di-download menggunakan winget. Apakah setuju? (Y/N)" -ForegroundColor Yellow

    while ($true) {
        $ans = (Read-Host 'Jawab').Trim()
        if ($ans -match '^(y|yes)$') { return $true }
        if ($ans -match '^(n|no)$') { return $false }
        Write-Host 'Ketik Y atau N.' -ForegroundColor Yellow
    }
}

function Install-Package {
    param(
        [Parameter(Mandatory)][string]$Id
    )
    $installParams = @('install', $Id, '-e', '--accept-package-agreements', '--accept-source-agreements')
    & winget @installParams
    if ($LASTEXITCODE -ne 0) { throw "Gagal install via winget: $Id" }
}

function Install-ToolkitDependency {
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string]$DisplayName,
        [Parameter(Mandatory)][string]$WingetId
    )

    if (Test-CommandExists $Command) {
        Write-Host "[OK] $DisplayName terdeteksi." -ForegroundColor Green
        return
    }

    Write-Host "[MISSING] $DisplayName belum terpasang. Mencoba install otomatis..." -ForegroundColor Yellow

    if (-not (Test-CommandExists 'winget')) {
        throw "Tidak menemukan winget. Install $DisplayName manual atau pasang winget terlebih dahulu."
    }

    $approved = Confirm-ToolkitInstall -AppName $DisplayName
    if (-not $approved) {
        throw "Instalasi dibatalkan oleh user: $DisplayName"
    }

    try {
        Install-Package -Id $WingetId
    } catch {
        throw "Gagal melakukan instalasi $DisplayName via winget."
    }

    if (-not (Test-CommandExists $Command)) {
        throw "Install selesai tapi perintah '$Command' masih tidak terdeteksi di PATH. Coba restart terminal atau PC Anda."
    }

    Write-Host "[OK] $DisplayName berhasil dipasang." -ForegroundColor Green
}

function Install-ToolkitDependencies {
    Clear-AndHeader -Title 'ElToolkitDeRWBU - Dependency Checker'
    Write-Host 'Memeriksa dependency (yt-dlp, ffmpeg, Node.js)...' -ForegroundColor White
    Write-Host ''

    Install-ToolkitDependency -Command 'yt-dlp' -DisplayName 'yt-dlp' -WingetId 'yt-dlp.yt-dlp'
    Install-ToolkitDependency -Command 'ffmpeg' -DisplayName 'FFmpeg' -WingetId 'Gyan.FFmpeg'
    Install-ToolkitDependency -Command 'node' -DisplayName 'Node.js' -WingetId 'OpenJS.NodeJS.LTS'

    Write-Host ''
    Write-Host 'Semua Dependency siap!' -ForegroundColor Green
    Write-Host ''
    
    # Prompt for yt-dlp update
    Write-Host 'Apakah Anda ingin memeriksa pembaruan (update) yt-dlp via yt-dlp -U? (Y/N/kosongkan untuk N)' -ForegroundColor Cyan
    $ans = (Read-Host 'Jawab')
    if ($ans -match '^(y|yes)$') {
        Write-Host 'Memperbarui yt-dlp...' -ForegroundColor White
        & yt-dlp -U
        Write-Host 'Selesai.' -ForegroundColor Green
    }
    
    Start-Sleep -Seconds 1
}

try {
    Install-ToolkitDependencies
} catch {
    Clear-AndHeader -Title 'Dependency Error'
    Write-Host ("ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
    Wait-Toolkit
    exit 1
}
