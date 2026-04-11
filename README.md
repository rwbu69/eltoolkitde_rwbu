# ElToolkitDeRWBU

ElToolkitDeRWBU adalah toolkit TUI (Text UI) berbasis PowerShell untuk Windows yang menggabungkan workflow media berikut:

1) **Downloader YouTube/Playlist** memakai `yt-dlp` (dengan dukungan cookies file atau cookies dari browser)
2) **FFmpeg Video Tools**: mirror (hflip) + batch rename + mirror+rename
3) **Converter Media → MP3 (320kbps)** untuk 1 folder atau banyak folder dengan struktur output rapi
4) **MetadataWriterDeRWBU**: tool terpisah untuk menulis metadata MP3 (interactive / folder / dari file `.txt` INI-style)

> Catatan penting: tool ini akan **meminta persetujuan (Y/N)** sebelum mengunduh/menginstal dependency yang belum ada.

---

## Kompatibilitas

- Windows 10/11
- Windows PowerShell 5.1+ atau PowerShell 7 (`pwsh`)

Dependency eksternal yang dipakai:

- `yt-dlp` (Module 1)
- `ffmpeg` (Module 2, Module 3, MetadataWriter)
- `ffprobe` (opsional, untuk membaca metadata yang sudah ada di MetadataWriter)
- `node` (dipakai oleh opsi advanced `yt-dlp` pada script)
- `winget` atau `choco` (untuk instalasi dependency otomatis, dengan persetujuan user)

---

## Isi Repo

- [ElToolkitDeRWBU.ps1](ElToolkitDeRWBU.ps1) → script utama (selector + Media Toolkit)
- [ElToolkitDeRWBU.bat](ElToolkitDeRWBU.bat) → launcher biasa (recommended untuk double-click)
- [ElToolkitDeRWBU-Admin.bat](ElToolkitDeRWBU-Admin.bat) → launcher Admin (berguna jika instalasi butuh UAC)
- [MetadataWriterDeRWBU.ps1](MetadataWriterDeRWBU.ps1) → tool khusus metadata MP3

---

## Cara Menjalankan

### Opsi 1 (paling mudah): Double-click launcher

1. Buka folder repo ini.
2. Jalankan **[ElToolkitDeRWBU.bat](ElToolkitDeRWBU.bat)**.
3. Jika dependency belum ada, tool akan bertanya dulu:
   - “Aplikasi ini tidak tersedia… akan download menggunakan winget/choco. Apakah setuju? (Y/N)”

Kalau instalasi butuh izin admin, jalankan:

- **[ElToolkitDeRWBU-Admin.bat](ElToolkitDeRWBU-Admin.bat)**

### Opsi 2: Jalankan langsung via PowerShell

Dari PowerShell di folder repo:

```powershell
powershell -ExecutionPolicy Bypass -File .\ElToolkitDeRWBU.ps1
```

Atau jika menggunakan PowerShell 7:

```powershell
pwsh -ExecutionPolicy Bypass -File .\ElToolkitDeRWBU.ps1
```

---

## Menu Selector (awal aplikasi)

Saat start, kamu akan melihat menu:

- **[1] Media Toolkit** (Downloader / FFmpeg Tools / MP3 Converter)
- **[2] MetadataWriterDeRWBU** (MP3 Metadata Writer)

Tool akan menjalankan pengecekan dependency sesuai fitur yang kamu pilih.

---

## Media Toolkit

Di dalam Media Toolkit ada 3 module.

### Module 1 — YT-DLP Advanced Downloader

Menu utama Module 1:

- Download **Video+Audio (MP4)**
- Download **Video ONLY (tanpa audio)**
- Download **Audio ONLY (MP3)**
- Ganti folder tujuan
- Pilih ulang sumber cookies

#### 1) Folder tujuan download

- Kamu akan diminta memilih folder output (drag & drop folder ke terminal lalu Enter).
- Folder tujuan ini akan diingat untuk sesi berjalan.

#### 2) Cookies (dua mode)

Script memakai logika berikut:

1. Jika ada file `cookies.txt` di folder repo (sejajar dengan script), maka dipakai otomatis.
2. Jika tidak ada `cookies.txt`, tool akan meminta kamu memilih browser untuk `--cookies-from-browser`.
   - Default yang disediakan di menu: vivaldi, edge, chrome, firefox, brave, opera, atau custom.

> Jika kamu ingin ganti sumber cookies, pilih menu “Pilih ulang sumber cookie”.

#### 3) Mode penamaan file

- **Pakai Nomor**: `%(autonumber)01d. %(title)s.%(ext)s`
- **Judul Asli**: `%(title)s.%(ext)s`

#### 4) Mode input

- **Satu URL / Playlist**: paste URL
- **Borongan (List .txt)**: drag & drop file `.txt` berisi list URL (satu URL per baris)

---

### Module 2 — FFmpeg Video Tools (Mirror/Rename)

Fitur di module ini:

- **A. Single Mirror (1 file)**
- **B. Batch Mirror (folder)**
- **C. Batch Rename (folder)**
- **D. Batch Mirror + Rename (folder)**

#### Output folder (default)

Saat diminta “Folder Tujuan”:

- Tekan ENTER untuk default → tool akan membuat folder `Hasil_Proses` di:
  - folder yang sama dengan file input (jika input file)
  - atau di dalam folder sumber (jika input folder)
- Atau drag & drop folder tujuan lain.

#### Mirror (hflip)

Mirror memakai FFmpeg filter `hflip` sehingga video akan di-encode ulang (H.264), audio akan dicoba `copy`.

Agar lebih stabil untuk file yang punya banyak stream, mirror memproses **hanya stream utama**:

- `-map 0:v:0` dan `-map 0:a:0?`

Dan memaksa pixel format kompatibel MP4:

- `-pix_fmt yuv420p`

Output nama mengikuti format:

- `NamaAsli (mirror).ext`

#### Rename (batch)

Rename tersedia dalam 3 mode:

1. **Base Name + Auto Number** → contoh: `VideoKu_01.mp4`, `VideoKu_02.mp4`, dst.
2. **Acuan file .txt** → jumlah baris harus sama dengan jumlah file.
3. **Interaktif** → kamu isi nama satu per satu.

Catatan penting:

- Jika folder tujuan sama dengan folder sumber → dilakukan `Rename-Item`.
- Jika folder tujuan berbeda → dilakukan `Move-Item` sambil rename (file dipindah ke folder tujuan).

---

### Module 3 — Convert Media → MP3 (320kbps)

Fitur:

- Convert **1 folder**
- Convert **multiple folders**

Ekstensi yang akan dipindai (non-recursive):

- Video: mp4, mkv, avi, mov, webm
- Audio: wav, m4a, aac, flac, ogg, wma

#### Struktur output (sesuai requirement)

Kamu akan diminta memilih direktori output root. Di dalamnya tool selalu membuat:

- `output_mp3/`

Lalu untuk setiap folder sumber akan dibuat subfolder:

- `output_mp3/<NamaFolderSumber>_mp3/`

Contoh:

- Kamu pilih output root: `D:\Hasil`
- Kamu convert folder sumber: `D:\Media\AlbumA`

Maka outputnya:

- `D:\Hasil\output_mp3\AlbumA_mp3\*.mp3`

#### Multiple folders

Ada 2 cara:

1. Drag & drop **banyak folder** sekaligus ke terminal.
2. Pilih **folder induk**, lalu tool akan memproses semua subfolder di dalamnya.

---

## MetadataWriterDeRWBU (MP3 Metadata Writer)

Tool ini bisa dijalankan dari selector menu (pilih nomor 2), atau dijalankan langsung:

```powershell
powershell -ExecutionPolicy Bypass -File .\MetadataWriterDeRWBU.ps1
```

Menu MetadataWriter:

- **[1] Tulis metadata - 1 file MP3**
- **[2] Tulis metadata - 1 folder (interactive satu per satu)**
- **[3] Tulis metadata - 1 folder dari file .txt (INI-style)**

### Interactive mode

- Tool akan menampilkan tag saat ini (jika `ffprobe` tersedia).
- Kamu dapat mengisi tag satu per satu.
- Tekan ENTER untuk skip (tag tersebut tidak diubah).
- Cover art opsional: drag & drop file gambar `.jpg/.png`.

### Mode dari file .txt (INI-style)

Format file `.txt`:

```ini
[DEFAULT]
artist=Foo
album=Bar
album_artist=Foo
genre=Pop
date=2026

[song1.mp3]
title=Judul 1
track=1/12

[song2.mp3]
title=Judul 2
track=2/12

; cover bisa ditaruh di DEFAULT atau per-file
; cover=D:\\Gambar\\cover.jpg
```

Aturan:

- `[DEFAULT]` akan diterapkan ke semua file.
- Section per file (mis. `[song1.mp3]`) akan override nilai dari DEFAULT.
- Jika sebuah file MP3 tidak punya section di `.txt`, tool akan **skip** file itu.

---

## Troubleshooting

### 1) Dependency tidak bisa diinstall

- Pastikan `winget` atau `choco` ada.
- Jika kamu menolak prompt (Y/N), tool akan kembali ke menu tanpa menginstal.
- Jika instalasi butuh admin, jalankan [ElToolkitDeRWBU-Admin.bat](ElToolkitDeRWBU-Admin.bat).

### 2) Mirror gagal (Invalid argument / Could not write header)

- Error seperti ini sering dipicu file yang punya banyak stream atau format yang kurang cocok.
- Script mirror sudah dibuat lebih aman dengan mapping stream utama (`0:v:0` dan `0:a:0?`) dan pixel format `yuv420p`.

Jika kamu masih menemukan file yang gagal, jalankan ulang dan simpan log error FFmpeg-nya agar bisa dianalisis lebih spesifik.

---

## Catatan Keamanan

- `cookies.txt` berisi data sensitif. Jangan commit file itu ke GitHub.
- Gunakan tool ini di komputer pribadi dan pastikan kamu paham risiko memasukkan cookies dari browser.

---

## Lisensi

Belum ditentukan.
