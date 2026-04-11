#requires -Version 5.1

<#
.SYNOPSIS
    MetadataWriterDeRWBU - Tool untuk menulis metadata MP3.

.DESCRIPTION
    Tool TUI kecil berbasis PowerShell untuk menulis metadata (ID3) ke file .mp3.

    Fitur:
    - Single file: tulis metadata untuk 1 file MP3.
    - Folder interactive: loop semua MP3 dalam folder, edit satu per satu.
    - Folder dari .txt (INI-style): user bisa menyiapkan metadata via file teks.

    Implementasi metadata dilakukan via FFmpeg (dan membaca metadata via FFprobe jika tersedia).

.NOTES
    - FFmpeg biasanya membuat file output baru; tool ini menulis ke file sementara lalu replace file asli.
    - Tidak semua player menampilkan semua tag; namun tag akan ditulis sebagai metadata container ID3.
#>

$ErrorActionPreference = 'Stop'

# -----------------------------
# Utilities (standalone)
# -----------------------------

function Get-ScriptRoot {
    if ($PSCommandPath) { return (Split-Path -Parent $PSCommandPath) }
    return (Split-Path -Parent $MyInvocation.MyCommand.Path)
}

$script:ScriptRoot = Get-ScriptRoot

function Clear-AndHeader {
    param([Parameter(Mandatory)][string]$Title)

    Clear-Host
    try { $host.UI.RawUI.WindowTitle = $Title } catch { }

    Write-Host '======================================================' -ForegroundColor Cyan
    Write-Host ("  {0}" -f $Title) -ForegroundColor Cyan
    Write-Host '======================================================' -ForegroundColor Cyan
    Write-Host ''
}

function Wait-Toolkit {
    Write-Host ''
    Write-Host 'Tekan ENTER untuk lanjut...' -ForegroundColor DarkGray
    [void](Read-Host)
}

function ConvertTo-ToolkitPath {
    param([string]$Text)

    if ($null -eq $Text) { return $null }
    $clean = $Text.Trim()
    if ($clean.StartsWith('"') -and $clean.EndsWith('"')) {
        $clean = $clean.Trim('"')
    }
    return $clean
}

function Read-Choice {
    param(
        [Parameter(Mandatory)][string]$Prompt,
        [Parameter(Mandatory)][string[]]$Valid
    )

    while ($true) {
        $inputValue = (Read-Host $Prompt).Trim()
        if ($Valid -contains $inputValue) { return $inputValue }
        Write-Host 'Pilihan tidak valid. Coba lagi.' -ForegroundColor Yellow
    }
}

function Read-ExistingPath {
    param(
        [Parameter(Mandatory)][string]$Prompt,
        [ValidateSet('File','Folder')][string]$Kind
    )

    while ($true) {
        $raw = Read-Host $Prompt
        $path = ConvertTo-ToolkitPath $raw

        if ([string]::IsNullOrWhiteSpace($path)) {
            Write-Host 'Input kosong. Coba lagi.' -ForegroundColor Yellow
            continue
        }

        if (-not (Test-Path -LiteralPath $path)) {
            Write-Host 'ERROR: Path tidak ditemukan.' -ForegroundColor Red
            continue
        }

        if ($Kind -eq 'File' -and -not (Test-Path -LiteralPath $path -PathType Leaf)) {
            Write-Host 'ERROR: Bukan file.' -ForegroundColor Red
            continue
        }

        if ($Kind -eq 'Folder' -and -not (Test-Path -LiteralPath $path -PathType Container)) {
            Write-Host 'ERROR: Bukan folder.' -ForegroundColor Red
            continue
        }

        return $path
    }
}

function Test-CommandExists {
    param([Parameter(Mandatory)][string]$Command)

    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Invoke-External {
    param(
        [Parameter(Mandatory)][string]$Exe,
        [Parameter(Mandatory)][string[]]$Params
    )

    & $Exe @Params
    if ($LASTEXITCODE -ne 0) {
        throw "Perintah gagal: $Exe (ExitCode=$LASTEXITCODE)"
    }
}

function Get-Mp3Files {
    param([Parameter(Mandatory)][string]$Folder)

    return @(Get-ChildItem -LiteralPath $Folder -Filter '*.mp3' -File -ErrorAction SilentlyContinue | Sort-Object Name)
}

# -----------------------------
# Metadata logic
# -----------------------------

$script:KnownTags = @(
    # Common tags
    @{ Key='title';        Label='Title';        Type='string' },
    @{ Key='artist';       Label='Artist';       Type='string' },
    @{ Key='album';        Label='Album';        Type='string' },
    @{ Key='album_artist'; Label='Album Artist'; Type='string' },
    @{ Key='genre';        Label='Genre';        Type='string' },
    @{ Key='date';         Label='Date/Year';    Type='date' },
    @{ Key='track';        Label='Track';        Type='track' },
    @{ Key='disc';         Label='Disc';         Type='track' },
    @{ Key='comment';      Label='Comment';      Type='string' },
    @{ Key='composer';     Label='Composer';     Type='string' },
    @{ Key='publisher';    Label='Publisher';    Type='string' },
    @{ Key='bpm';          Label='BPM';          Type='int' },
    @{ Key='isrc';         Label='ISRC';         Type='string' },
    @{ Key='language';     Label='Language';     Type='string' },
    @{ Key='lyrics';       Label='Lyrics';       Type='string' }
)

function Get-Mp3Tags {
    <#
    .SYNOPSIS
        Membaca tag MP3 via ffprobe (jika ada).

    .OUTPUTS
        Hashtable (key -> value) atau @{} jika ffprobe tidak ada/gagal.
    #>

    param([Parameter(Mandatory)][string]$File)

    if (-not (Test-CommandExists 'ffprobe')) { return @{} }

    try {
        $json = & ffprobe -v error -show_entries format_tags -of json $File 2>$null
        if (-not $json) { return @{} }
        $obj = $json | ConvertFrom-Json
        if ($null -eq $obj.format.tags) { return @{} }

        $tags = @{}
        foreach ($p in $obj.format.tags.PSObject.Properties) {
            $tags[$p.Name] = [string]$p.Value
        }
        return $tags
    } catch {
        return @{}
    }
}

function Read-ValidatedTagValue {
    <#
    .SYNOPSIS
        Minta user input tag dan validasi tipenya.

    .DESCRIPTION
        User boleh ENTER untuk skip (tidak mengubah tag itu).
        Validasi:
        - int: angka bulat
        - date: yyyy atau yyyy-mm-dd
        - track: n atau n/total
        - string: bebas
    #>

    param(
        [Parameter(Mandatory)][string]$Prompt,
        [Parameter(Mandatory)][ValidateSet('string','int','date','track')][string]$Type,
        [string]$CurrentValue
    )

    while ($true) {
        $suffix = if ($CurrentValue) { " (sekarang: $CurrentValue)" } else { '' }
        $raw = Read-Host ("{0}{1} (ENTER=skip): " -f $Prompt, $suffix)
        if ([string]::IsNullOrWhiteSpace($raw)) { return $null }

        $v = $raw.Trim()

        switch ($Type) {
            'string' { return $v }
            'int' {
                if ($v -match '^[0-9]+$') { return $v }
                Write-Host 'Input harus angka bulat.' -ForegroundColor Yellow
            }
            'date' {
                if ($v -match '^[0-9]{4}$' -or $v -match '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') { return $v }
                Write-Host 'Format date: yyyy atau yyyy-mm-dd.' -ForegroundColor Yellow
            }
            'track' {
                if ($v -match '^[0-9]+$' -or $v -match '^[0-9]+/[0-9]+$') { return $v }
                Write-Host 'Format track/disc: n atau n/total.' -ForegroundColor Yellow
            }
        }
    }
}

function Write-Mp3Metadata {
    <#
    .SYNOPSIS
        Menulis metadata ke file MP3 menggunakan FFmpeg.

    .DESCRIPTION
        FFmpeg tidak menulis "in-place". Tool ini:
        - Membuat file temp di folder yang sama
        - Menulis metadata ke temp
        - Replace file asli

        Dukungan cover art:
        - Jika tags berisi key 'cover' (path gambar jpg/png), akan disisipkan sebagai attached picture.
    #>

    param(
        [Parameter(Mandatory)][string]$InputFile,
        [Parameter(Mandatory)][hashtable]$Tags
    )

    if (-not (Test-CommandExists 'ffmpeg')) {
        throw 'FFmpeg tidak ditemukan di PATH.'
    }

    $inputDir = Split-Path -Parent $InputFile
    $tempName = (".{0}.tmp.mp3" -f ([System.IO.Path]::GetRandomFileName()))
    $tempPath = Join-Path $inputDir $tempName

    # Build ffmpeg args
    $coverPath = $null
    if ($Tags.ContainsKey('cover')) {
        $coverPath = ConvertTo-ToolkitPath $Tags['cover']
    }

    $metaPairs = @()
    foreach ($k in $Tags.Keys) {
        if ($k -eq 'cover') { continue }
        $val = [string]$Tags[$k]
        if ([string]::IsNullOrWhiteSpace($val)) { continue }
        $metaPairs += @('-metadata', ("{0}={1}" -f $k, $val))
    }

    if ($coverPath -and (Test-Path -LiteralPath $coverPath -PathType Leaf)) {
        # Attach cover image
        $params = @(
            '-hide_banner','-y',
            '-i', $InputFile,
            '-i', $coverPath,
            '-map', '0:a',
            '-map', '1:v',
            '-c', 'copy',
            '-id3v2_version', '3',
            '-write_id3v1', '1'
        ) + $metaPairs + @(
            '-metadata:s:v', 'title=Album cover',
            '-metadata:s:v', 'comment=Cover (front)',
            $tempPath
        )

        Invoke-External -Exe 'ffmpeg' -Params $params
    } else {
        # Metadata only (copy audio)
        $params = @(
            '-hide_banner','-y',
            '-i', $InputFile,
            '-map', '0:a',
            '-c', 'copy',
            '-id3v2_version', '3',
            '-write_id3v1', '1'
        ) + $metaPairs + @(
            $tempPath
        )

        Invoke-External -Exe 'ffmpeg' -Params $params
    }

    # Replace original
    Move-Item -LiteralPath $tempPath -Destination $InputFile -Force
}

function Edit-Mp3MetadataInteractive {
    <#
    .SYNOPSIS
        UI untuk edit metadata 1 file MP3.

    .DESCRIPTION
        Menampilkan tag saat ini (jika ffprobe ada), lalu user input tag satu per satu.
        User boleh skip field tertentu.

        Tambahan: user bisa set cover art via prompt (optional).
    #>

    param([Parameter(Mandatory)][string]$Mp3File)

    Clear-AndHeader -Title 'MetadataWriterDeRWBU - Edit MP3'
    Write-Host ("File: {0}" -f $Mp3File) -ForegroundColor DarkGray

    $current = Get-Mp3Tags -File $Mp3File

    if ($current.Count -gt 0) {
        Write-Host ''
        Write-Host 'Metadata saat ini (hasil ffprobe):' -ForegroundColor White
        foreach ($k in ($current.Keys | Sort-Object)) {
            Write-Host ("- {0}: {1}" -f $k, $current[$k]) -ForegroundColor DarkCyan
        }
    } else {
        Write-Host ''
        Write-Host 'Metadata saat ini: (ffprobe tidak tersedia / tag kosong)' -ForegroundColor DarkGray
    }

    Write-Host ''
    Write-Host 'Isi metadata baru (ENTER untuk skip field):' -ForegroundColor White

    $tagsToWrite = @{}

    foreach ($tag in $script:KnownTags) {
        $key = $tag.Key
        $label = $tag.Label
        $type = $tag.Type
        $curVal = $null
        if ($current.ContainsKey($key)) { $curVal = $current[$key] }

        $newVal = Read-ValidatedTagValue -Prompt $label -Type $type -CurrentValue $curVal
        if ($null -ne $newVal) {
            $tagsToWrite[$key] = $newVal
        }
    }

    Write-Host ''
    Write-Host 'Cover art (optional):' -ForegroundColor White
    $cover = Read-Host 'Drag & drop file cover (jpg/png) atau ENTER untuk skip: '
    $cover = ConvertTo-ToolkitPath $cover
    if ($cover -and (Test-Path -LiteralPath $cover -PathType Leaf)) {
        $tagsToWrite['cover'] = $cover
    }

    if ($tagsToWrite.Count -eq 0) {
        Write-Host ''
        Write-Host 'Tidak ada perubahan metadata (semua di-skip).' -ForegroundColor Yellow
        Wait-Toolkit
        return
    }

    Write-Host ''
    Write-Host 'Menulis metadata...' -ForegroundColor Cyan
    Write-Mp3Metadata -InputFile $Mp3File -Tags $tagsToWrite
    Write-Host 'Selesai.' -ForegroundColor Green
    Wait-Toolkit
}

function Parse-MetadataTxtIni {
    <#
    .SYNOPSIS
        Parse file .txt INI-style untuk metadata.

    .DESCRIPTION
        Format:

            [DEFAULT]
            artist=Foo
            album=Bar

            [song1.mp3]
            title=Judul 1
            track=1/12

            [song2.mp3]
            title=Judul 2
            track=2/12

        Aturan:
        - Section name bisa nama file (song1.mp3) atau relative path.
        - [DEFAULT] akan diaplikasikan ke semua file, lalu section spesifik override.
        - Key apapun diterima (agar "semua metadata" bisa ditulis), plus key khusus: cover=pathGambar
    #>

    param([Parameter(Mandatory)][string]$TxtFile)

    $lines = Get-Content -LiteralPath $TxtFile -ErrorAction Stop

    $data = @{}
    $currentSection = $null

    foreach ($lineRaw in $lines) {
        $line = $lineRaw.Trim()
        if ($line -eq '' -or $line.StartsWith(';') -or $line.StartsWith('#')) { continue }

        if ($line -match '^\[(.+)\]$') {
            $currentSection = $Matches[1].Trim()
            if (-not $data.ContainsKey($currentSection)) {
                $data[$currentSection] = @{}
            }
            continue
        }

        if (-not $currentSection) { continue }

        $idx = $line.IndexOf('=')
        if ($idx -lt 1) { continue }

        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()

        if ($key -ne '') {
            $data[$currentSection][$key] = $val
        }
    }

    return $data
}

function Apply-MetadataFromTxtToFolder {
    param(
        [Parameter(Mandatory)][string]$Folder,
        [Parameter(Mandatory)][string]$TxtFile
    )

    $parsed = Parse-MetadataTxtIni -TxtFile $TxtFile

    $defaultTags = @{}
    if ($parsed.ContainsKey('DEFAULT')) {
        foreach ($k in $parsed['DEFAULT'].Keys) { $defaultTags[$k] = $parsed['DEFAULT'][$k] }
    }

    $files = Get-Mp3Files -Folder $Folder
    if ($files.Count -eq 0) { throw 'Tidak ada file .mp3 di folder.' }

    foreach ($f in $files) {
        $name = $f.Name
        $section = $null
        if ($parsed.ContainsKey($name)) {
            $section = $name
        } else {
            # fallback: coba cocokkan case-insensitive
            $match = $parsed.Keys | Where-Object { $_.ToLowerInvariant() -eq $name.ToLowerInvariant() } | Select-Object -First 1
            if ($match) { $section = $match }
        }

        $tags = @{}
        foreach ($k in $defaultTags.Keys) { $tags[$k] = $defaultTags[$k] }

        if ($section) {
            foreach ($k in $parsed[$section].Keys) { $tags[$k] = $parsed[$section][$k] }
        } else {
            Write-Host ("Skip (tidak ada section di .txt untuk): {0}" -f $name) -ForegroundColor Yellow
            continue
        }

        Write-Host ''
        Write-Host ("Write metadata: {0}" -f $name) -ForegroundColor Cyan
        try {
            Write-Mp3Metadata -InputFile $f.FullName -Tags $tags
            Write-Host 'OK' -ForegroundColor Green
        } catch {
            Write-Host ("ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
        }
    }
}

# -----------------------------
# Menus
# -----------------------------

function Start-MetadataWriterDeRWBUMainMenu {
    while ($true) {
        Clear-AndHeader -Title 'MetadataWriterDeRWBU (MP3)'

        Write-Host '[1] Tulis metadata - 1 file MP3'
        Write-Host '[2] Tulis metadata - 1 folder (interactive satu per satu)'
        Write-Host '[3] Tulis metadata - 1 folder dari file .txt (INI-style)'
        Write-Host '[0] Kembali'
        Write-Host ''

        $c = Read-Choice -Prompt 'Pilih: ' -Valid @('1','2','3','0')
        if ($c -eq '0') { return }

        try {
            if (-not (Test-CommandExists 'ffmpeg')) {
                throw 'FFmpeg tidak ditemukan. Install FFmpeg dulu (atau jalankan dari ElToolkitDeRWBU agar auto-install).'
            }

            switch ($c) {
                '1' {
                    $file = Read-ExistingPath -Prompt 'Drag & drop file .mp3 lalu ENTER: ' -Kind File
                    if ([System.IO.Path]::GetExtension($file).ToLowerInvariant() -ne '.mp3') {
                        throw 'File harus .mp3'
                    }
                    Edit-Mp3MetadataInteractive -Mp3File $file
                }
                '2' {
                    $folder = Read-ExistingPath -Prompt 'Drag & drop folder berisi .mp3 lalu ENTER: ' -Kind Folder
                    $files = Get-Mp3Files -Folder $folder
                    if ($files.Count -eq 0) { throw 'Tidak ada file .mp3 di folder.' }

                    foreach ($f in $files) {
                        Edit-Mp3MetadataInteractive -Mp3File $f.FullName
                    }
                }
                '3' {
                    $folder = Read-ExistingPath -Prompt 'Drag & drop folder berisi .mp3 lalu ENTER: ' -Kind Folder
                    $txt = Read-ExistingPath -Prompt 'Drag & drop file .txt metadata lalu ENTER: ' -Kind File
                    Apply-MetadataFromTxtToFolder -Folder $folder -TxtFile $txt
                    Wait-Toolkit
                }
            }
        } catch {
            Write-Host ''
            Write-Host ("ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
            Wait-Toolkit
        }
    }
}

# Entry
try {
    Start-MetadataWriterDeRWBUMainMenu
} catch {
    Clear-AndHeader -Title 'MetadataWriterDeRWBU - Fatal Error'
    Write-Host ("ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
    Wait-Toolkit
}
