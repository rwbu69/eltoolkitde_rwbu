#requires -Version 5.1

<#
.SYNOPSIS
    ElToolkitDeRWBU (PowerShell TUI) untuk Windows.

.DESCRIPTION
    Aplikasi TUI berbasis PowerShell yang menggabungkan beberapa workflow media:
    1) Auto dependency check + installer (winget, fallback choco): yt-dlp, FFmpeg, Node.js
    2) YT-DLP downloader (cookies + mode video/audio + single/batch)
    3) FFmpeg tools (mirror/rename)
    4) Converter media -> MP3 (single folder / multiple folders) dengan struktur output rapi

    Desainnya sengaja modular: setiap fitur ada dalam function terpisah.

.NOTES
    - Ditargetkan untuk Windows PowerShell 5.1+ atau PowerShell 7 (pwsh).
    - Script menggunakan $ErrorActionPreference = 'Stop' agar error mudah ditangkap try/catch.
    - Nama function diusahakan mengikuti approved verbs untuk mengurangi warning analyzer.
#>

$ErrorActionPreference = 'Stop'

# Best practice catatan:
# - Script ini sengaja mempertahankan state minimal via $script:... untuk TUI (mis. folder output).
# - Semua operasi "berbahaya" (FFmpeg/yt-dlp/install) dibungkus try/catch agar user mendapat pesan jelas.

# -----------------------------
# Utilitas dasar
# -----------------------------

#region Utilities

function Get-ScriptRoot {
    # Mengambil folder tempat script ini berada.
    # Dipakai agar path relatif (mis. cookies.txt) konsisten walaupun script dijalankan dari folder lain.
    if ($PSCommandPath) {
        return (Split-Path -Parent $PSCommandPath)
    }
    return (Split-Path -Parent $MyInvocation.MyCommand.Path)
}

$script:ScriptRoot = Get-ScriptRoot
$script:DownloadOutputDir = $null
$script:CookieSource = $null
$script:CookieBrowser = $null

function Wait-Toolkit {
    # Pause sederhana setelah sebuah proses, supaya output tidak langsung hilang saat balik ke menu.
    Write-Host ''
    Write-Host 'Tekan ENTER untuk lanjut...' -ForegroundColor DarkGray
    [void](Read-Host)
}

function Clear-AndHeader {
    param(
        [Parameter(Mandatory)]
        [string]$Title
    )

    Clear-Host
    try {
        $host.UI.RawUI.WindowTitle = $Title
    } catch {
        # Abaikan jika host tidak mendukung.
    }

    Write-Host '======================================================' -ForegroundColor Cyan
    Write-Host ("  {0}" -f $Title) -ForegroundColor Cyan
    Write-Host '======================================================' -ForegroundColor Cyan
    Write-Host ''
}

function ConvertTo-ToolkitPath {
    # Normalisasi input path:
    # - Menghapus awalan `& ` dari drag & drop di PS7/Windows Terminal
    # - Menghapus quote (ganda/tunggal) pembungkus dan merapikan whitespace
    param([string]$Text)

    if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
    $clean = $Text.Trim()

    if ($clean.StartsWith('& ')) {
        $clean = $clean.Substring(2).Trim()
    }

    if ($clean -match '^["''](.*)["'']$') {
        $clean = $Matches[1]
    }
    
    $clean = $clean.Trim()
    $clean = $clean -replace '"', ''
    
    return $clean
}

function Read-Choice {
    # Helper untuk menu angka/huruf.
    # Akan terus meminta input sampai user memasukkan nilai yang valid.
    param(
        [Parameter(Mandatory)]
        [string]$Prompt,
        [Parameter(Mandatory)]
        [string[]]$Valid
    )

    while ($true) {
        $inputValue = (Read-Host $Prompt).Trim()
        if ($Valid -contains $inputValue) { return $inputValue }
        Write-Host 'Pilihan tidak valid. Coba lagi.' -ForegroundColor Yellow
    }
}

function Confirm-ToolkitInstall {
    <#
    .SYNOPSIS
        Meminta persetujuan user sebelum mengunduh/menginstal dependency.

    .DESCRIPTION
        Sesuai requirement: jika aplikasi/dependency tidak tersedia, jangan auto-install diam-diam.
        Tool akan menampilkan warning dan meminta konfirmasi (Y/N).
    #>

    param(
        [Parameter(Mandatory)][string]$AppName,
        [Parameter(Mandatory)][ValidateSet('winget','choco')][string]$Manager
    )

    Write-Host ''
    Write-Host "WARNING: '$AppName' tidak tersedia." -ForegroundColor Yellow
    Write-Host "Aplikasi ini tidak tersedia, akan download menggunakan $Manager. Apakah setuju? (Y/N)" -ForegroundColor Yellow

    while ($true) {
        $ans = (Read-Host 'Jawab').Trim()
        if ($ans -match '^(y|yes)$') { return $true }
        if ($ans -match '^(n|no)$') { return $false }
        Write-Host 'Ketik Y atau N.' -ForegroundColor Yellow
    }
}

function Read-ExistingPath {
    # Helper untuk input drag & drop file/folder.
    # Fungsi ini juga validasi: path harus benar-benar ada dan sesuai jenis (File/Folder).
    param(
        [Parameter(Mandatory)]
        [string]$Prompt,
        [ValidateSet('File','Folder')]
        [string]$Kind,
        [switch]$AllowEmpty
    )

    while ($true) {
        Write-Host '(Tips: Kosongkan lalu ENTER untuk memilih lewat Jendela Dialog GUI)' -ForegroundColor Cyan
        $raw = Read-Host $Prompt
        if ($AllowEmpty -and [string]::IsNullOrWhiteSpace($raw)) { return $null }

        if ([string]::IsNullOrWhiteSpace($raw)) {
            Add-Type -AssemblyName System.Windows.Forms
            $form = New-Object System.Windows.Forms.Form
            $form.TopMost = $true
            $form.ShowInTaskbar = $false
            $form.WindowState = 'Minimized'

            if ($Kind -eq 'Folder') {
                $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
                $dialog.Description = "Pilih Folder"
                $dialog.ShowNewFolderButton = $true
                if ($dialog.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
                    return $dialog.SelectedPath
                }
            } else {
                $dialog = New-Object System.Windows.Forms.OpenFileDialog
                $dialog.Title = "Pilih File"
                if ($dialog.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
                    return $dialog.FileName
                }
            }
            Write-Host 'Dialog dibatalkan. Silakan input ulang.' -ForegroundColor Yellow
            continue
        }

        $path = ConvertTo-ToolkitPath $raw
        if ([string]::IsNullOrWhiteSpace($path)) {
            Write-Host 'Input kosong. Coba lagi.' -ForegroundColor Yellow
            continue
        }

        if (-not (Test-Path -LiteralPath $path)) {
            Write-Host 'ERROR: Path tidak ditemukan.' -ForegroundColor Red
            continue
        }

        if ($Kind -eq 'File') {
            if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
                Write-Host 'ERROR: Bukan file.' -ForegroundColor Red
                continue
            }
        }

        if ($Kind -eq 'Folder') {
            if (-not (Test-Path -LiteralPath $path -PathType Container)) {
                Write-Host 'ERROR: Bukan folder.' -ForegroundColor Red
                continue
            }
        }

        return $path
    }
}

function New-ToolkitDirectory {
    # Membuat folder output jika belum ada.
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Test-CommandExists {
    # Cek apakah sebuah command tersedia di PATH (mis. ffmpeg, yt-dlp, winget).
    param([Parameter(Mandatory)][string]$Command)

    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Invoke-External {
    # Wrapper untuk menjalankan program eksternal.
    # Jika exit code non-zero, kita throw supaya bisa ditangkap try/catch dan menampilkan ERROR yang rapi.
    param(
        [Parameter(Mandatory)][string]$Exe,
        [Parameter(Mandatory)][string[]]$Params
    )

#endregion Utilities

    # Jalankan executable dan laporkan error berdasarkan exit code.
    & $Exe @Params
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Perintah gagal: $Exe (ExitCode=$exitCode)"
    }
}

# -----------------------------
# Dependency checker + installer
# -----------------------------

#region Dependencies

function Get-PackageManager {
    # Prioritas sesuai prompt: winget dulu, lalu choco.
    if (Test-CommandExists 'winget') { return 'winget' }
    if (Test-CommandExists 'choco') { return 'choco' }
    return $null
}

function Install-Package {
    # Menjalankan instalasi package via package manager yang tersedia.
    # Catatan: instalasi bisa butuh Admin tergantung kebijakan sistem.
    param(
        [Parameter(Mandatory)][ValidateSet('winget','choco')][string]$Manager,
        [Parameter(Mandatory)][string]$Id
    )

    if ($Manager -eq 'winget') {
        # winget install <id> -e --accept-package-agreements --accept-source-agreements
        $installParams = @('install', $Id, '-e', '--accept-package-agreements', '--accept-source-agreements')
        & winget @installParams
        if ($LASTEXITCODE -ne 0) { throw "Gagal install via winget: $Id" }
        return
    }

    if ($Manager -eq 'choco') {
        # choco install <id> -y
        $installParams = @('install', $Id, '-y')
        & choco @installParams
        if ($LASTEXITCODE -ne 0) { throw "Gagal install via choco: $Id" }
        return
    }
}

function Install-ToolkitDependency {
    # Memastikan sebuah dependency tersedia.
    # Jika command belum ada di PATH, script akan mencoba menginstal.
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string]$DisplayName,
        [Parameter(Mandatory)][string]$WingetId,
        [Parameter(Mandatory)][string]$ChocoId
    )

    if (Test-CommandExists $Command) {
        Write-Host "[OK] $DisplayName terdeteksi." -ForegroundColor Green
        return
    }

    Write-Host "[MISSING] $DisplayName belum terpasang. Mencoba install otomatis..." -ForegroundColor Yellow

    $mgr = Get-PackageManager
    if (-not $mgr) {
        throw "Tidak menemukan winget/choco. Install $DisplayName manual atau pasang winget/choco terlebih dahulu."
    }

    # Persetujuan user sebelum download/install
    $approved = Confirm-ToolkitInstall -AppName $DisplayName -Manager $mgr
    if (-not $approved) {
        throw "Instalasi dibatalkan oleh user: $DisplayName"
    }

    try {
        if ($mgr -eq 'winget') {
            Install-Package -Manager 'winget' -Id $WingetId
        } else {
            Install-Package -Manager 'choco' -Id $ChocoId
        }
    } catch {
        # Fallback ke manager lain jika tersedia.
        if ($mgr -eq 'winget' -and (Test-CommandExists 'choco')) {
            Write-Host "Winget gagal. Mencoba fallback ke choco..." -ForegroundColor Yellow

            # Persetujuan user lagi untuk fallback manager
            if (-not (Confirm-ToolkitInstall -AppName $DisplayName -Manager 'choco')) {
                throw "Instalasi (fallback) dibatalkan oleh user: $DisplayName"
            }
            Install-Package -Manager 'choco' -Id $ChocoId
        } elseif ($mgr -eq 'choco' -and (Test-CommandExists 'winget')) {
            Write-Host "Choco gagal. Mencoba fallback ke winget..." -ForegroundColor Yellow

            # Persetujuan user lagi untuk fallback manager
            if (-not (Confirm-ToolkitInstall -AppName $DisplayName -Manager 'winget')) {
                throw "Instalasi (fallback) dibatalkan oleh user: $DisplayName"
            }
            Install-Package -Manager 'winget' -Id $WingetId
        } else {
            throw
        }
    }

    if (-not (Test-CommandExists $Command)) {
        throw "Install selesai tapi perintah '$Command' masih tidak terdeteksi di PATH. Coba restart terminal."
    }

    Write-Host "[OK] $DisplayName berhasil dipasang." -ForegroundColor Green
}

function Install-ToolkitDependencies {
    # Entry point untuk pengecekan dependency saat startup.
    # Setelah selesai, user dipause agar bisa membaca status.
    Clear-AndHeader -Title 'ElToolkitDeRWBU - Dependency Checker'

    Write-Host 'Memeriksa dependency (yt-dlp, ffmpeg, Node.js)...' -ForegroundColor White
    Write-Host ''

    # Paket default yang umum tersedia di winget/choco.
    Install-ToolkitDependency -Command 'yt-dlp' -DisplayName 'yt-dlp' -WingetId 'yt-dlp.yt-dlp' -ChocoId 'yt-dlp'
    Install-ToolkitDependency -Command 'ffmpeg' -DisplayName 'FFmpeg' -WingetId 'Gyan.FFmpeg' -ChocoId 'ffmpeg'
    Install-ToolkitDependency -Command 'node' -DisplayName 'Node.js' -WingetId 'OpenJS.NodeJS.LTS' -ChocoId 'nodejs-lts'

    Write-Host ''
    Write-Host 'Dependency siap.' -ForegroundColor Green
    Wait-Toolkit
}

function Install-MetadataWriterDependencies {
    # Dependency minimal untuk MetadataWriterDeRWBU (MP3): FFmpeg.
    # (ffprobe biasanya ikut terpasang bersama ffmpeg.)
    Clear-AndHeader -Title 'ElToolkitDeRWBU - Dependency Checker (MetadataWriterDeRWBU)'

    Write-Host 'Memeriksa dependency (FFmpeg)...' -ForegroundColor White
    Write-Host ''
    Install-ToolkitDependency -Command 'ffmpeg' -DisplayName 'FFmpeg' -WingetId 'Gyan.FFmpeg' -ChocoId 'ffmpeg'

    if (Test-CommandExists 'ffprobe') {
        Write-Host '[OK] ffprobe terdeteksi.' -ForegroundColor Green
    } else {
        Write-Host '[INFO] ffprobe tidak terdeteksi (pembacaan metadata akan terbatas).' -ForegroundColor Yellow
    }

    Write-Host ''
    Write-Host 'Dependency siap.' -ForegroundColor Green
    Wait-Toolkit
}

#endregion Dependencies

# -----------------------------
# Module 1: YT-DLP Advanced Downloader
# -----------------------------

#region Module1-YTDLP

function Get-YtDlpCookieArgs {
    # Strategi cookies:
    # 1) Jika ada cookies.txt di folder script -> pakai itu.
    # 2) Jika tidak -> pakai cookies dari browser (user pilih sekali, lalu dicache untuk sesi ini).
    # Smart cookie checker:
    # 1) Jika ada cookies.txt di folder script, pakai itu.
    # 2) Jika tidak, ambil cookies dari browser (meniru "browser aktif" pada kebutuhan prompt).
    $cookieFile = Join-Path $script:ScriptRoot 'cookies.txt'
    if (Test-Path -LiteralPath $cookieFile -PathType Leaf) {
        Write-Host '[STATUS] Menggunakan file cookies.txt' -ForegroundColor DarkCyan
        $script:CookieSource = 'file'
        return @('--cookies', $cookieFile)
    }

    if (-not $script:CookieBrowser) {
        Write-Host '[STATUS] cookies.txt tidak ditemukan.' -ForegroundColor DarkCyan
        Write-Host 'Pilih browser untuk ekstraksi cookies (default: vivaldi):' -ForegroundColor White
        Write-Host '  1) vivaldi'
        Write-Host '  2) edge'
        Write-Host '  3) chrome'
        Write-Host '  4) firefox'
        Write-Host '  5) brave'
        Write-Host '  6) opera'
        Write-Host '  7) custom (ketik manual)'
        $b = Read-Choice -Prompt 'Pilih (1-7): ' -Valid @('1','2','3','4','5','6','7')
        $script:CookieBrowser = switch ($b) {
            '1' { 'vivaldi' }
            '2' { 'edge' }
            '3' { 'chrome' }
            '4' { 'firefox' }
            '5' { 'brave' }
            '6' { 'opera' }
            '7' {
                $custom = Read-Host 'Ketik nama browser untuk yt-dlp (misal: chrome): '
                if ([string]::IsNullOrWhiteSpace($custom)) { 'vivaldi' } else { $custom.Trim() }
            }
        }
    }

    $script:CookieSource = 'browser'
    Write-Host ("[STATUS] Mengekstrak cookies dari browser: {0}" -f $script:CookieBrowser) -ForegroundColor DarkCyan
    return @('--cookies-from-browser', $script:CookieBrowser)
}

function Select-DownloadOutputDir {
    # Folder output yt-dlp disimpan ke $script:DownloadOutputDir agar menu berikutnya tidak tanya ulang.
    Clear-AndHeader -Title 'YT-DLP - Set Folder Tujuan'
    $path = Read-ExistingPath -Prompt 'Drag & Drop folder tujuan lalu ENTER: ' -Kind Folder
    $script:DownloadOutputDir = $path
    Write-Host "Lokasi diset: $script:DownloadOutputDir" -ForegroundColor Green
    Wait-Toolkit
}

function Invoke-YtDlpDownload {
    # Menyusun argument yt-dlp berdasarkan pilihan user.
    # Mengadopsi opsi dari downloadvideo.bat:
    # - --js-runtimes node + --remote-components ejs:github
    # - extractor args youtube:player_client=default,web_embedded
    param(
        [Parameter(Mandatory)][ValidateSet('videoaudio','videoonly','audioonly')][string]$Mode,
        [Parameter(Mandatory)][ValidateSet('autonumber','title')][string]$NameMode,
        [Parameter(Mandatory)][ValidateSet('single','batch')][string]$InputMode
    )

    if (-not $script:DownloadOutputDir) {
        Select-DownloadOutputDir
        if (-not $script:DownloadOutputDir) { return }
    }

    $outputTemplate = if ($NameMode -eq 'autonumber') {
        '%(autonumber)01d. %(title)s.%(ext)s'
    } else {
        '%(title)s.%(ext)s'
    }

    $formatArgs = switch ($Mode) {
        'videoaudio' { @('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', '--merge-output-format', 'mp4') }
        'videoonly'  { @('-f', 'bestvideo', '--merge-output-format', 'mp4') }
        'audioonly'  { @('-x', '--audio-format', 'mp3', '--audio-quality', '0') }
    }

    $cookieArgs = Get-YtDlpCookieArgs

    $commonArgs = @(
        '-4'
        # Cookie
    ) + $cookieArgs + @(
        '--js-runtimes', 'node'
        '--remote-components', 'ejs:github'
        '--extractor-args', 'youtube:player_client=default,web_embedded'
        '--no-check-certificate'
    ) + $formatArgs + @(
        '--embed-metadata'
        '--embed-thumbnail'
        '-o', (Join-Path $script:DownloadOutputDir $outputTemplate)
    )

    if ($InputMode -eq 'single') {
        $url = Read-Host 'Paste URL: '
        if ([string]::IsNullOrWhiteSpace($url)) { throw 'URL kosong.' }
        Invoke-External -Exe 'yt-dlp' -Params ($commonArgs + @($url))
        return
    }

    $listPath = Read-ExistingPath -Prompt 'Drag file .txt list URL lalu ENTER: ' -Kind File
    Invoke-External -Exe 'yt-dlp' -Params ($commonArgs + @('-a', $listPath))
}

function Start-ToolkitYtDlpMenu {
    # Menu interaktif untuk module yt-dlp.
    while ($true) {

        #endregion Module1-YTDLP
        Clear-AndHeader -Title 'Module 1 - YT-DLP Advanced Downloader'

        if ($script:DownloadOutputDir) {
            Write-Host ("Folder tujuan: {0}" -f $script:DownloadOutputDir) -ForegroundColor DarkGray
        } else {
            Write-Host 'Folder tujuan: (belum diset)' -ForegroundColor DarkGray
        }

        if ($script:CookieSource -eq 'file') {
            Write-Host 'Cookie: cookies.txt (auto)' -ForegroundColor DarkGray
        } elseif ($script:CookieSource -eq 'browser') {
            Write-Host ("Cookie: browser ({0})" -f $script:CookieBrowser) -ForegroundColor DarkGray
        } else {
            Write-Host 'Cookie: (akan dipilih otomatis saat download)' -ForegroundColor DarkGray
        }
        Write-Host ''

        Write-Host '[1] Download Video+Audio (MP4)'
        Write-Host '[2] Download Video ONLY (No Audio)'
        Write-Host '[3] Download Audio ONLY (MP3)'
        Write-Host '[4] Ganti Folder Tujuan'
        Write-Host '[5] Pilih ulang sumber cookie'
        Write-Host '[6] Perbarui (Update) yt-dlp'
        Write-Host '[0] Kembali'
        Write-Host ''

        $choice = Read-Choice -Prompt 'Pilih: ' -Valid @('1','2','3','4','5','6','0')
        if ($choice -eq '0') { return }
        if ($choice -eq '4') { Select-DownloadOutputDir; continue }
        if ($choice -eq '5') { $script:CookieSource = $null; $script:CookieBrowser = $null; Write-Host 'Sumber cookie di-reset.' -ForegroundColor Green; Wait-Toolkit; continue }
        if ($choice -eq '6') {
            try {
                Write-Host ''
                Write-Host 'Memeriksa dan memperbarui yt-dlp...' -ForegroundColor Cyan
                Invoke-External -Exe 'yt-dlp' -Params @('-U')
                Write-Host 'yt-dlp berhasil diperbarui!' -ForegroundColor Green
            } catch {
                Write-Host ("Gagal memperbarui yt-dlp: {0}" -f $_.Exception.Message) -ForegroundColor Red
            }
            Wait-Toolkit
            continue
        }

        Write-Host ''
        Write-Host '[1] Pakai Nomor (1. Judul.mp4)'
        Write-Host '[2] Judul Asli'
        $nameChoice = Read-Choice -Prompt 'Pilih Nama (1/2): ' -Valid @('1','2')
        $nameMode = if ($nameChoice -eq '1') { 'autonumber' } else { 'title' }

        Write-Host ''
        Write-Host '[1] Satu URL / Playlist'
        Write-Host '[2] Borongan (List .txt)'
        $inputChoice = Read-Choice -Prompt 'Pilih Mode Input (1/2): ' -Valid @('1','2')
        $inputMode = if ($inputChoice -eq '1') { 'single' } else { 'batch' }

        $mode = switch ($choice) {
            '1' { 'videoaudio' }
            '2' { 'videoonly' }
            '3' { 'audioonly' }
        }

        try {
            Write-Host ''
            Write-Host 'Memulai download...' -ForegroundColor Cyan
            Invoke-YtDlpDownload -Mode $mode -NameMode $nameMode -InputMode $inputMode
            Write-Host ''
            Write-Host ("Selesai! File tersimpan di: {0}" -f $script:DownloadOutputDir) -ForegroundColor Green
        } catch {
            Write-Host ''
            Write-Host ("ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
        }

        Wait-Toolkit
    }
}

# -----------------------------
# Module 2: FFmpeg Video Tools (Mirror/Rename)
# -----------------------------

#region Module2-FFmpeg

function Get-DefaultOutputDir {
    param(
        [Parameter(Mandatory)][string]$InputPath,
        [ValidateSet('File','Folder')][string]$InputKind
    )

    if ($InputKind -eq 'Folder') {
        return (Join-Path $InputPath 'Hasil_Proses')
    }

    $dir = Split-Path -Parent $InputPath
    return (Join-Path $dir 'Hasil_Proses')
}

function Select-TargetDir {
    param(
        [Parameter(Mandatory)][string]$InputPath,
        [Parameter(Mandatory)][ValidateSet('File','Folder')][string]$InputKind
    )

    Write-Host ''
    Write-Host 'Di mana kamu ingin menyimpan hasilnya?' -ForegroundColor White
    Write-Host '- Drag & drop folder tujuan, lalu ENTER' -ForegroundColor DarkGray
    Write-Host '- Ketik "?" lalu ENTER untuk memilih via Jendela Dialog GUI' -ForegroundColor DarkGray
    Write-Host '- Atau tekan ENTER kosong untuk default: "Hasil_Proses"' -ForegroundColor DarkGray

    $raw = Read-Host 'Folder Tujuan: '

    if ($raw.Trim() -eq '?') {
        Add-Type -AssemblyName System.Windows.Forms
        $form = New-Object System.Windows.Forms.Form
        $form.TopMost = $true
        $form.ShowInTaskbar = $false
        $form.WindowState = 'Minimized'

        $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        $dialog.Description = "Pilih Folder Tujuan"
        $dialog.ShowNewFolderButton = $true
        if ($dialog.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
            $raw = $dialog.SelectedPath
        } else {
            Write-Host 'Dialog dibatalkan. Menggunakan folder default.' -ForegroundColor Yellow
            $raw = ''
        }
    }

    $raw = ConvertTo-ToolkitPath $raw

    if ([string]::IsNullOrWhiteSpace($raw)) {
        $raw = Get-DefaultOutputDir -InputPath $InputPath -InputKind $InputKind
    }

    New-ToolkitDirectory -Path $raw
    return $raw
}

function Get-VideoFiles {
    param([Parameter(Mandatory)][string]$Folder)

    $extRegex = '\.(mp4|mkv|avi|mov|webm)$'
    $files = Get-ChildItem -LiteralPath $Folder -File -ErrorAction SilentlyContinue |
             Where-Object { $_.Extension -match $extRegex }

    return $files | Sort-Object Name
}

function New-OutputFilePath {
    param(
        [Parameter(Mandatory)][string]$TargetDir,
        [Parameter(Mandatory)][string]$BaseName,
        [Parameter(Mandatory)][string]$Extension
    )

    return (Join-Path $TargetDir ($BaseName + $Extension))
}

function Get-RenameMapping {
    param(
        [Parameter(Mandatory)][System.IO.FileInfo[]]$Files,
        [Parameter(Mandatory)][ValidateSet('basename','txt','interactive')][string]$RenameMode
    )

    if ($RenameMode -eq 'basename') {
        $base = Read-Host 'Input nama dasar (misal "VideoKu"): '
        if ([string]::IsNullOrWhiteSpace($base)) { throw 'Nama dasar kosong.' }

        $count = $Files.Count
        $pad = [Math]::Max(2, ($count.ToString().Length))

        $result = @()
        $i = 1
        foreach ($file in $Files) {
            $newBase = ("{0}_{1:D$pad}" -f $base.Trim(), $i)
            $i++
            $result += [pscustomobject]@{ Input = $file; NewBase = $newBase }
        }
        return $result
    }

    if ($RenameMode -eq 'txt') {
        $txtPath = Read-ExistingPath -Prompt 'Drag & drop file .txt acuan nama lalu ENTER: ' -Kind File
        $lines = Get-Content -LiteralPath $txtPath -ErrorAction Stop
        $names = $lines | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }

        if ($names.Count -ne $Files.Count) {
            throw "Jumlah baris nama ($($names.Count)) tidak sama dengan jumlah file video ($($Files.Count))."
        }

        $result = @()
        for ($idx = 0; $idx -lt $Files.Count; $idx++) {
            $result += [pscustomobject]@{ Input = $Files[$idx]; NewBase = $names[$idx] }
        }
        return $result
    }

    # interactive
    $result = @()
    foreach ($file in $Files) {
        Write-Host ''
        Write-Host ("File: {0}" -f $file.Name) -ForegroundColor DarkCyan
        $new = Read-Host 'Ketik nama baru (tanpa ext): '
        $new = $new.Trim()
        if ([string]::IsNullOrWhiteSpace($new)) {
            $new = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
        }
        $result += [pscustomobject]@{ Input = $file; NewBase = $new }
    }
    return $result
}

function Invoke-FFmpegMirror {
    # Mirror horizontal dengan filter hflip.
    # Karena ada filter, video harus di-encode ulang; audio dicopy jika ada.
    param(
        [Parameter(Mandatory)][string]$InputFile,
        [Parameter(Mandatory)][string]$OutputFile
    )

    # Mirror horizontal (hflip).
    # Video harus di-encode ulang karena ada filter; audio dicopy jika ada.
    # Catatan penting:
    # - Jangan pakai `-map 0:v` / `-map 0:a?` (tanpa index), karena itu akan mengambil SEMUA stream.
    #   Beberapa file punya lebih dari 1 video stream (mis. stream tambahan/varian) dan itu bisa membuat
    #   output MP4 gagal menulis header (Invalid argument / codec tag error).
    # - Karena itu kita map hanya stream utama: `0:v:0` dan (opsional) audio pertama: `0:a:0?`.
    # - `-pix_fmt yuv420p` dipilih untuk kompatibilitas MP4 yang paling luas.
    Invoke-External -Exe 'ffmpeg' -Params @(
        '-hide_banner',
        '-hwaccel', 'auto',
        '-i', $InputFile,
        '-map', '0:v:0',
        '-map', '0:a:0?',
        '-vf', 'hflip',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-crf', '18',
        '-preset', 'fast',
        '-threads', '0',
        '-c:a', 'copy',
        $OutputFile
    )
}

function Invoke-FFmpegConvertWebmToMp4 {
    # Convert WebM (atau video lain) ke MP4 (H.264 + AAC)
    param(
        [Parameter(Mandatory)][string]$InputFile,
        [Parameter(Mandatory)][string]$OutputFile
    )

    Invoke-External -Exe 'ffmpeg' -Params @(
        '-hide_banner',
        '-hwaccel', 'auto',
        '-i', $InputFile,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'fast',
        '-crf', '18',
        '-c:a', 'aac',
        '-b:a', '192k',
        $OutputFile
    )
}

function Start-ToolkitFFmpegMenu {
    # Menu tools FFmpeg:
    # - Single mirror
    # - Batch mirror
    # - Batch rename (3 mode)
    # - Batch mirror + rename
    while ($true) {

        #endregion Module2-FFmpeg
        Clear-AndHeader -Title 'Module 2 - FFmpeg Video Tools'

        Write-Host 'A. Single Mirror (1 file)'
        Write-Host 'B. Batch Mirror (folder)'
        Write-Host 'C. Batch Rename (folder)'
        Write-Host 'D. Batch Mirror + Rename (folder)'
        Write-Host 'E. Single Convert WebM -> MP4 (1 file)'
        Write-Host 'F. Batch Convert WebM -> MP4 (folder)'
        Write-Host '0. Kembali'
        Write-Host ''

        $choice = Read-Choice -Prompt 'Pilih (A/B/C/D/E/F/0): ' -Valid @('A','B','C','D','E','F','0','a','b','c','d','e','f')
        $choice = $choice.ToUpperInvariant()
        if ($choice -eq '0') { return }

        try {
            if ($choice -eq 'A') {
                Write-Host ''
                Write-Host 'Drag & drop 1 file video lalu ENTER:' -ForegroundColor White
                $filePath = Read-ExistingPath -Prompt 'File: ' -Kind File
                $targetDir = Select-TargetDir -InputPath $filePath -InputKind File

                $file = Get-Item -LiteralPath $filePath
                $base = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
                $ext = $file.Extension
                $out = New-OutputFilePath -TargetDir $targetDir -BaseName ("$base (mirror)") -Extension $ext

                if (Test-Path -LiteralPath $out) { throw "Output sudah ada: $out" }

                Write-Host ''
                Write-Host ("[Single Mirror] Memproses: {0}" -f $file.Name) -ForegroundColor Cyan
                Invoke-FFmpegMirror -InputFile $file.FullName -OutputFile $out

                Write-Host ''
                Write-Host "Selesai. Output: $out" -ForegroundColor Green
                Wait-Toolkit
                continue
            }

            if ($choice -eq 'E') {
                Write-Host ''
                Write-Host 'Drag & drop 1 file WebM lalu ENTER:' -ForegroundColor White
                $filePath = Read-ExistingPath -Prompt 'File: ' -Kind File
                $targetDir = Select-TargetDir -InputPath $filePath -InputKind File

                $file = Get-Item -LiteralPath $filePath
                $base = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
                $out = Join-Path $targetDir ($base + '.mp4')

                if (Test-Path -LiteralPath $out) { throw "Output sudah ada: $out" }

                Write-Host ''
                Write-Host ("[Single Convert] Memproses: {0}" -f $file.Name) -ForegroundColor Cyan
                Invoke-FFmpegConvertWebmToMp4 -InputFile $file.FullName -OutputFile $out

                Write-Host ''
                Write-Host "Selesai. Output: $out" -ForegroundColor Green
                Wait-Toolkit
                continue
            }

            # Folder-based
            Write-Host ''
            Write-Host 'Drag & drop folder video lalu ENTER:' -ForegroundColor White
            $folder = Read-ExistingPath -Prompt 'Folder: ' -Kind Folder
            $targetDir = Select-TargetDir -InputPath $folder -InputKind Folder

            $files = @(Get-VideoFiles -Folder $folder)
            if ($files.Count -eq 0) { throw 'Tidak ada file video yang cocok di folder.' }

            if ($choice -eq 'B') {
                Write-Host ''
                Write-Host '[Batch Mirror] Memulai...' -ForegroundColor Cyan

                if ($PSVersionTable.PSVersion.Major -ge 7) {
                    Write-Host "Menjalankan mirror paralel (PowerShell 7+)..." -ForegroundColor Cyan
                    $parallelBlock = [scriptblock]::Create(@'
                        $f = $_.FullName
                        $name = $_.Name
                        $ext = $_.Extension
                        $destFolder = $using:targetDir
                        $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
                        $out = Join-Path $destFolder ($base + ' (mirror)' + $ext)

                        if (Test-Path -LiteralPath $out) {
                            Write-Host "Skip (sudah ada): $out" -ForegroundColor Yellow
                            return
                        }

                        Write-Host "Mirror (Paralel): $name" -ForegroundColor DarkCyan
                        try {
                            & ffmpeg -hide_banner -loglevel error -hwaccel auto -y -i $f -map 0:v:0 -map 0:a:0? -vf hflip -c:v libx264 -pix_fmt yuv420p -crf 18 -preset fast -threads 0 -c:a copy $out
                        } catch {
                            Write-Host "ERROR mirror '$name': $($_.Exception.Message)" -ForegroundColor Red
                        }
'@)
                    $files | ForEach-Object -ThrottleLimit 4 -Parallel $parallelBlock
                } else {
                    $total = $files.Count
                    $i = 0
                    foreach ($f in $files) {
                        $i++
                        Write-Progress -Activity "Melakukan Mirror Video" -Status "Memproses $i dari $($total): $($f.Name)" -PercentComplete (($i / $total) * 100)

                        $base = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
                        $out = New-OutputFilePath -TargetDir $targetDir -BaseName ("$base (mirror)") -Extension $f.Extension
                        if (Test-Path -LiteralPath $out) {
                            Write-Host ("Skip (sudah ada): {0}" -f $out) -ForegroundColor Yellow
                            continue
                        }
                        Write-Host ("Mirror: {0}" -f $f.Name) -ForegroundColor DarkCyan
                        try {
                            Invoke-FFmpegMirror -InputFile $f.FullName -OutputFile $out
                        } catch {
                            Write-Host ("ERROR mirror '{0}': {1}" -f $f.Name, $_.Exception.Message) -ForegroundColor Red
                        }
                    }
                    Write-Progress -Activity "Melakukan Mirror Video" -Completed
                }

                Write-Host ''
                Write-Host "Selesai. Output folder: $targetDir" -ForegroundColor Green
                Wait-Toolkit
                continue
            }

            if ($choice -eq 'F') {
                Write-Host ''
                Write-Host '[Batch Convert WebM -> MP4] Memulai...' -ForegroundColor Cyan

                $webmFiles = $files | Where-Object { $_.Extension -match '\.webm$' }
                if ($webmFiles.Count -eq 0) { throw 'Tidak ada file .webm di folder ini.' }

                if ($PSVersionTable.PSVersion.Major -ge 7) {
                    Write-Host "Menjalankan konversi paralel (PowerShell 7+)..." -ForegroundColor Cyan
                    $parallelBlock = [scriptblock]::Create(@'
                        $f = $_.FullName
                        $name = $_.Name
                        $destFolder = $using:targetDir
                        $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
                        $out = Join-Path $destFolder ($base + '.mp4')

                        if (Test-Path -LiteralPath $out) {
                            Write-Host "Skip (sudah ada): $out" -ForegroundColor Yellow
                            return
                        }

                        Write-Host "Convert (Paralel): $name" -ForegroundColor DarkCyan
                        try {
                            & ffmpeg -hide_banner -loglevel error -hwaccel auto -y -i $f -c:v libx264 -pix_fmt yuv420p -preset fast -crf 18 -c:a aac -b:a 192k $out
                        } catch {
                            Write-Host "ERROR convert '$name': $($_.Exception.Message)" -ForegroundColor Red
                        }
'@)
                    $webmFiles | ForEach-Object -ThrottleLimit 4 -Parallel $parallelBlock
                } else {
                    $total = $webmFiles.Count
                    $i = 0
                    foreach ($f in $webmFiles) {
                        $i++
                        Write-Progress -Activity "Melakukan Konversi WebM -> MP4" -Status "Memproses $i dari $($total): $($f.Name)" -PercentComplete (($i / $total) * 100)

                        $base = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
                        $out = Join-Path $targetDir ($base + '.mp4')
                        if (Test-Path -LiteralPath $out) {
                            Write-Host ("Skip (sudah ada): {0}" -f $out) -ForegroundColor Yellow
                            continue
                        }
                        Write-Host ("Convert: {0}" -f $f.Name) -ForegroundColor DarkCyan
                        try {
                            Invoke-FFmpegConvertWebmToMp4 -InputFile $f.FullName -OutputFile $out
                        } catch {
                            Write-Host ("ERROR convert '{0}': {1}" -f $f.Name, $_.Exception.Message) -ForegroundColor Red
                        }
                    }
                    Write-Progress -Activity "Melakukan Konversi WebM -> MP4" -Completed
                }

                Write-Host ''
                Write-Host "Selesai. Output folder: $targetDir" -ForegroundColor Green
                Wait-Toolkit
                continue
            }

            if ($choice -eq 'C') {
                Clear-AndHeader -Title 'Batch Rename (Folder)'
                Write-Host "Folder sumber: $folder" -ForegroundColor DarkGray
                Write-Host "Folder tujuan: $targetDir" -ForegroundColor DarkGray
                Write-Host ''

                Write-Host '1. Base Name + Auto Number'
                Write-Host '2. Acuan File .txt'
                Write-Host '3. Interaktif (satu per satu)'

                $r = Read-Choice -Prompt 'Pilih (1/2/3): ' -Valid @('1','2','3')
                $renameMode = switch ($r) {
                    '1' { 'basename' }
                    '2' { 'txt' }
                    '3' { 'interactive' }
                }

                $mapping = @(Get-RenameMapping -Files $files -RenameMode $renameMode)

                foreach ($m in $mapping) {
                    $src = $m.Input.FullName
                    $dest = Join-Path $targetDir ($m.NewBase + $m.Input.Extension)

                    if (Test-Path -LiteralPath $dest) {
                        Write-Host ("Skip (nama sudah ada): {0}" -f $dest) -ForegroundColor Yellow
                        continue
                    }

                    # Sesuai prompt: ini adalah fitur "rename".
                    # Jika target folder berbeda, file dipindahkan (move) ke folder tujuan dengan nama baru.
                    if ((Resolve-Path -LiteralPath $targetDir).Path -eq (Resolve-Path -LiteralPath $folder).Path) {
                        Write-Host ("Rename: {0} -> {1}{2}" -f $m.Input.Name, $m.NewBase, $m.Input.Extension) -ForegroundColor DarkCyan
                        Rename-Item -LiteralPath $src -NewName ($m.NewBase + $m.Input.Extension)
                    } else {
                        Write-Host ("Move+Rename: {0} -> {1}{2}" -f $m.Input.Name, $m.NewBase, $m.Input.Extension) -ForegroundColor DarkCyan
                        Move-Item -LiteralPath $src -Destination $dest
                    }
                }

                Write-Host ''
                Write-Host "Selesai. Output folder: $targetDir" -ForegroundColor Green
                Wait-Toolkit
                continue
            }

            if ($choice -eq 'D') {
                Clear-AndHeader -Title 'Batch Mirror + Rename (Folder)'
                Write-Host "Folder sumber: $folder" -ForegroundColor DarkGray
                Write-Host "Folder tujuan: $targetDir" -ForegroundColor DarkGray
                Write-Host ''

                Write-Host '1. Base Name + Auto Number'
                Write-Host '2. Acuan File .txt'
                Write-Host '3. Interaktif (satu per satu)'

                $r = Read-Choice -Prompt 'Pilih Rename (1/2/3): ' -Valid @('1','2','3')
                $renameMode = switch ($r) {
                    '1' { 'basename' }
                    '2' { 'txt' }
                    '3' { 'interactive' }
                }

                $mapping = @(Get-RenameMapping -Files $files -RenameMode $renameMode)

                Write-Host ''
                Write-Host '[Mirror + Rename] Memulai...' -ForegroundColor Cyan

                if ($PSVersionTable.PSVersion.Major -ge 7) {
                    Write-Host "Menjalankan mirror + rename paralel (PowerShell 7+)..." -ForegroundColor Cyan
                    $parallelBlock = [scriptblock]::Create(@'
                        $m = $_
                        $destFolder = $using:targetDir
                        $out = Join-Path $destFolder ($m.NewBase + ' (mirror)' + $m.Input.Extension)

                        if (Test-Path -LiteralPath $out) {
                            Write-Host "Skip (sudah ada): $out" -ForegroundColor Yellow
                            return
                        }

                        Write-Host "Mirror: $($m.Input.Name) -> $($m.NewBase) (mirror)$($m.Input.Extension)" -ForegroundColor DarkCyan
                        try {
                            & ffmpeg -hide_banner -loglevel error -hwaccel auto -y -i $m.Input.FullName -map 0:v:0 -map 0:a:0? -vf hflip -c:v libx264 -pix_fmt yuv420p -crf 18 -preset fast -threads 0 -c:a copy $out
                        } catch {
                            Write-Host "ERROR mirror '$($m.Input.Name)': $($_.Exception.Message)" -ForegroundColor Red
                        }
'@)
                    $mapping | ForEach-Object -ThrottleLimit 4 -Parallel $parallelBlock
                } else {
                    $total = $mapping.Count
                    $i = 0
                    foreach ($m in $mapping) {
                        $i++
                        Write-Progress -Activity "Melakukan Mirror + Rename" -Status "Memproses $i dari $($total): $($m.Input.Name)" -PercentComplete (($i / $total) * 100)

                        $out = Join-Path $targetDir ($m.NewBase + ' (mirror)' + $m.Input.Extension)
                        if (Test-Path -LiteralPath $out) {
                            Write-Host ("Skip (sudah ada): {0}" -f $out) -ForegroundColor Yellow
                            continue
                        }
                        Write-Host ("Mirror: {0} -> {1}" -f $m.Input.Name, ([System.IO.Path]::GetFileName($out))) -ForegroundColor DarkCyan
                        try {
                            Invoke-FFmpegMirror -InputFile $m.Input.FullName -OutputFile $out
                        } catch {
                            Write-Host ("ERROR mirror '{0}': {1}" -f $m.Input.Name, $_.Exception.Message) -ForegroundColor Red
                        }
                    }
                    Write-Progress -Activity "Melakukan Mirror + Rename" -Completed
                }

                Write-Host ''
                Write-Host "Selesai. Output folder: $targetDir" -ForegroundColor Green
                Wait-Toolkit
                continue
            }

        } catch {
            Write-Host ''
            Write-Host ("ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
            Wait-Toolkit
        }
    }
}

# -----------------------------
# Module 3: Universal Audio/Video -> MP3 Converter
# -----------------------------

#region Module3-MP3

function Get-MediaFilesForMp3 {
    # Daftar ekstensi media yang dianggap valid.
    # Catatan: scanning saat ini hanya file di folder tersebut (non-recursive).
    # Dioptimalkan menggunakan Regex agar disk hanya dibaca sekali (disk I/O efisien).
    param([Parameter(Mandatory)][string]$Folder)

    $extRegex = '\.(mp4|mkv|avi|mov|webm|wav|m4a|aac|flac|ogg|wma)$'
    $files = Get-ChildItem -LiteralPath $Folder -File -ErrorAction SilentlyContinue |
             Where-Object { $_.Extension -match $extRegex }

    return $files | Sort-Object Name
}

function Split-InputPaths {
    # Membaca input yang berisi banyak path.
    # Saat drag & drop multiple folder ke terminal, biasanya formatnya: "C:\A" "D:\B" atau 'C:\A' 'D:\B'.
    param([Parameter(Mandatory)][string]$Text)

    # Mendukung drag & drop multiple folder (biasanya jadi "C:\A" "D:\B" atau 'C:\A' 'D:\B')
    # dan juga input manual dipisah spasi.
    $t = $Text.Trim()
    if ($t.StartsWith('& ')) { $t = $t.Substring(2).Trim() }
    if ($t -eq '') { return @() }

    $pathMatches = [regex]::Matches($t, '"([^"]+)"|''([^'']+)''|([^\s]+)')
    $result = @()
    foreach ($m in $pathMatches) {
        if ($m.Groups[1].Success) {
            $result += $m.Groups[1].Value
        } elseif ($m.Groups[2].Success) {
            $result += $m.Groups[2].Value
        } elseif ($m.Groups[3].Success) {
            $result += $m.Groups[3].Value
        }
    }
    return $result
}

function Convert-FolderToMp3 {
    # Mengonversi semua file media dalam 1 folder menjadi MP3 320kbps.
    # Jika ada 1 file gagal, akan ditampilkan ERROR dan lanjut ke file berikutnya.
    param(
        [Parameter(Mandatory)][string]$SourceFolder,
        [Parameter(Mandatory)][string]$DestinationFolder
    )

    New-ToolkitDirectory -Path $DestinationFolder

    $items = @(Get-MediaFilesForMp3 -Folder $SourceFolder)
    if ($items.Count -eq 0) {
        Write-Host ("Tidak ada file media di folder: {0}" -f $SourceFolder) -ForegroundColor Yellow
        return
    }

    if ($PSVersionTable.PSVersion.Major -ge 7) {
        Write-Host "Menjalankan konversi paralel (PowerShell 7+)..." -ForegroundColor Cyan
        $parallelBlock = [scriptblock]::Create(@'
            $f = $_
            $destFolder = $using:DestinationFolder
            $base = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
            $out = Join-Path $destFolder ($base + '.mp3')

            if (Test-Path -LiteralPath $out) {
                Write-Host "Skip (sudah ada): $out" -ForegroundColor Yellow
                return
            }

            Write-Host "Convert (Paralel): $($f.Name)" -ForegroundColor DarkCyan
            try {
                & ffmpeg -hide_banner -loglevel error -y -i $f.FullName -map 0:a:0? -vn -codec:a libmp3lame -b:a 320k $out
            } catch {
                Write-Host "ERROR convert '$($f.Name)': $($_.Exception.Message)" -ForegroundColor Red
            }
'@)
        $items | ForEach-Object -ThrottleLimit 4 -Parallel $parallelBlock
    } else {
        $total = $items.Count
        $i = 0
        foreach ($f in $items) {
            $i++
            Write-Progress -Activity "Mengonversi Media ke MP3" -Status "Memproses $i dari $($total): $($f.Name)" -PercentComplete (($i / $total) * 100)

            $base = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
            $out = Join-Path $DestinationFolder ($base + '.mp3')

            if (Test-Path -LiteralPath $out) {
                Write-Host ("Skip (sudah ada): {0}" -f $out) -ForegroundColor Yellow
                continue
            }

            Write-Host ("Convert: {0}" -f $f.Name) -ForegroundColor DarkCyan

            try {
                Invoke-External -Exe 'ffmpeg' -Params @('-hide_banner', '-y', '-i', $f.FullName, '-map', '0:a:0?', '-vn', '-codec:a', 'libmp3lame', '-b:a', '320k', $out)
            } catch {
                # Untuk batch, lebih baik lanjut file berikutnya.
                Write-Host ("ERROR convert '{0}': {1}" -f $f.Name, $_.Exception.Message) -ForegroundColor Red
            }
        }
        Write-Progress -Activity "Mengonversi Media ke MP3" -Completed
    }
}

function Start-ToolkitMp3ConverterMenu {
    # Workflow output sesuai requirement:
    # - User memilih direktori output root
    # - Script membuat: <root>\output_mp3\
    # - Untuk tiap folder sumber dibuat subfolder: <NamaFolder>_mp3\ berisi file .mp3
    while ($true) {

        #endregion Module3-MP3
        Clear-AndHeader -Title 'Module 3 - Convert Media -> MP3 (320kbps)'

        Write-Host '[1] Convert 1 folder (folder -> folder)'
        Write-Host '[2] Convert multiple folders'
        Write-Host '[0] Kembali'
        Write-Host ''

        $c = Read-Choice -Prompt 'Pilih: ' -Valid @('1','2','0')
        if ($c -eq '0') { return }

        try {
            # Output root selalu: <outputDir>\output_mp3
            Write-Host ''
            Write-Host 'Pilih direktori output (akan dibuat subfolder "output_mp3"):' -ForegroundColor White
            $outRootDir = Read-ExistingPath -Prompt 'Drag & drop folder output root: ' -Kind Folder
            $outputMp3Root = Join-Path $outRootDir 'output_mp3'
            New-ToolkitDirectory -Path $outputMp3Root

            if ($c -eq '1') {
                Write-Host ''
                Write-Host 'Drag & drop folder sumber media lalu ENTER:' -ForegroundColor White
                $srcFolder = Read-ExistingPath -Prompt 'Folder sumber: ' -Kind Folder

                $srcName = (Split-Path -Leaf $srcFolder)
                $destFolder = Join-Path $outputMp3Root ("{0}_mp3" -f $srcName)

                Write-Host ''
                Write-Host 'Memulai konversi...' -ForegroundColor Cyan
                Write-Host ("Sumber : {0}" -f $srcFolder) -ForegroundColor DarkGray
                Write-Host ("Output : {0}" -f $destFolder) -ForegroundColor DarkGray
                Write-Host ''

                Convert-FolderToMp3 -SourceFolder $srcFolder -DestinationFolder $destFolder

                Write-Host ''
                Write-Host ("Selesai. Output root: {0}" -f $outputMp3Root) -ForegroundColor Green
            }

            if ($c -eq '2') {
                Clear-AndHeader -Title 'Module 3 - Multiple Folders'
                Write-Host 'Mode multiple folders:' -ForegroundColor White
                Write-Host '  [1] Pilih banyak folder (drag & drop beberapa folder sekaligus)'
                Write-Host '  [2] Pilih 1 folder induk (semua subfolder-nya akan diproses)'
                Write-Host ''

                $mc = Read-Choice -Prompt 'Pilih (1/2): ' -Valid @('1','2')
                $sourceFolders = @()

                if ($mc -eq '1') {
                    Write-Host ''
                    Write-Host 'Drag & drop BANYAK folder sumber, lalu ENTER:' -ForegroundColor White
                    $raw = Read-Host 'Folder-folder sumber: '
                    # Jangan normalize seluruh baris, karena bisa menghapus quote penting.
                    $paths = @(Split-InputPaths -Text $raw)
                    if ($paths.Count -eq 0) { throw 'Tidak ada folder sumber yang diberikan.' }

                    foreach ($p in $paths) {
                        $p = ConvertTo-ToolkitPath $p
                        if (-not (Test-Path -LiteralPath $p -PathType Container)) {
                            Write-Host ("Skip (bukan folder): {0}" -f $p) -ForegroundColor Yellow
                            continue
                        }
                        $sourceFolders += $p
                    }
                } else {
                    Write-Host ''
                    Write-Host 'Drag & drop folder induk (berisi banyak folder), lalu ENTER:' -ForegroundColor White
                    $parent = Read-ExistingPath -Prompt 'Folder induk: ' -Kind Folder
                    $sourceFolders = @(Get-ChildItem -LiteralPath $parent -Directory | Sort-Object Name | ForEach-Object { $_.FullName })
                }

                if ($sourceFolders.Count -eq 0) { throw 'Tidak ada folder yang bisa diproses.' }

                Write-Host ''
                Write-Host ("Output root: {0}" -f $outputMp3Root) -ForegroundColor DarkGray
                Write-Host ("Jumlah folder: {0}" -f $sourceFolders.Count) -ForegroundColor DarkGray
                Write-Host ''
                Write-Host 'Memulai konversi batch...' -ForegroundColor Cyan

                foreach ($src in $sourceFolders) {
                    $srcName = Split-Path -Leaf $src
                    $destFolder = Join-Path $outputMp3Root ("{0}_mp3" -f $srcName)
                    Write-Host ''
                    Write-Host ("Folder: {0}" -f $srcName) -ForegroundColor White
                    Convert-FolderToMp3 -SourceFolder $src -DestinationFolder $destFolder
                }

                Write-Host ''
                Write-Host ("Selesai. Output root: {0}" -f $outputMp3Root) -ForegroundColor Green
            }
        } catch {
            Write-Host ''
            Write-Host ("ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
        }

        Wait-Toolkit
    }
}

# -----------------------------
# Main Menu
# -----------------------------

#region MainMenu

function Start-ToolkitMainMenu {
    # Menu utama aplikasi. Setelah sebuah module selesai, flow kembali ke menu ini.
    while ($true) {

        #endregion MainMenu
        Clear-AndHeader -Title 'ElToolkitDeRWBU (PowerShell TUI)'
        Write-Host '[1] Module 1: YT-DLP Advanced Downloader'
        Write-Host '[2] Module 2: FFmpeg Video Tools (Mirror/Rename)'
        Write-Host '[3] Module 3: Universal Media -> MP3 Converter'
        Write-Host '[0] Keluar'
        Write-Host ''

        $c = Read-Choice -Prompt 'Pilih menu: ' -Valid @('1','2','3','0')
        switch ($c) {
            '1' { Start-ToolkitYtDlpMenu }
            '2' { Start-ToolkitFFmpegMenu }
            '3' { Start-ToolkitMp3ConverterMenu }
            '0' { return }
        }
    }
}

function Start-ElToolkitDeRWBUSelector {
    # Menu awal untuk memilih toolkit.
    # Launcher (.bat / .bat admin) tetap sama—user memilih dari sini.
    while ($true) {
        Clear-AndHeader -Title 'ElToolkitDeRWBU - Toolkit Selector'
        Write-Host '[1] Media Toolkit (Downloader / FFmpeg Tools / MP3 Converter)'
        Write-Host '[2] MetadataWriterDeRWBU (MP3 Metadata Writer)'
        Write-Host '[0] Keluar'
        Write-Host ''

        $c = Read-Choice -Prompt 'Pilih: ' -Valid @('1','2','0')
        if ($c -eq '0') { return }

        if ($c -eq '1') {
            try {
                Install-ToolkitDependencies
                Start-ToolkitMainMenu
            } catch {
                Write-Host ''
                Write-Host ("ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
                Wait-Toolkit
            }
            continue
        }

        if ($c -eq '2') {
            try {
                Install-MetadataWriterDependencies
                $metaScript = Join-Path $script:ScriptRoot 'MetadataWriterDeRWBU.ps1'
                if (-not (Test-Path -LiteralPath $metaScript -PathType Leaf)) {
                    throw "Script tidak ditemukan: $metaScript"
                }
                & $metaScript
            } catch {
                Write-Host ''
                Write-Host ("ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
                Wait-Toolkit
            }
            continue
        }
    }
}

# Entry point
# - Install dependency dulu
# - Lalu masuk menu utama
try {
    Start-ElToolkitDeRWBUSelector
} catch {
    Clear-AndHeader -Title 'ElToolkitDeRWBU - Fatal Error'
    Write-Host ("ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
    Wait-Toolkit
}
