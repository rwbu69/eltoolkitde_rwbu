# ElToolkitDeRWBU

ElToolkitDeRWBU adalah toolkit *All-in-One* untuk Windows yang menggabungkan berbagai workflow pengunduhan dan manipulasi media (YouTube & FFmpeg). 

Kini hadir dalam **Dua Mode Utama**:
1. **Mode Web GUI** (Baru, Modern, Multi-tasking) - Direkomendasikan
2. **Mode TUI** (Text UI berbasis PowerShell Lama)

---

## 🔥 Fitur Web GUI (Versi Terbaru)

Web GUI berjalan secara lokal menggunakan Node.js dan menyediakan antarmuka modern di *browser* Anda:

- **Auto-Dependency Checker & Installer**: Hanya dengan *double-click* launcher di PC baru, script akan mengecek ketersediaan `yt-dlp`, `ffmpeg`, dan `Node.js`, meminta persetujuan untuk menginstall via `winget`, lalu langsung menjalankan server! (Bebas repot).
- **YT-DLP Queue & Resolusi Dinamis**: Anda bisa memasukkan puluhan URL sekaligus. Sebelum mengunduh, sistem akan mengecek YouTube untuk menampilkan **daftar resolusi (mis. 1080p, 720p)** yang tersedia *untuk masing-masing video*. Antrean (Queue) diproses berurutan secara otomatis.
- **FFmpeg Trimming**: Memotong video dengan instan tanpa *re-encode* hanya dengan mengisikan *Start Time* dan *End Time* (HH:MM:SS).
- **FFmpeg Mirror**: Membalikkan video secara horizontal (H-Flip).
- **MP3 Converter**: Memindai sebuah folder dan secara masal mengubah seluruh file media/video menjadi MP3 berkualitas 320kbps ke direktori output yang rapi.
- **MP3 Metadata Editor (Batch & Folder)**: Tambahkan tag *Title, Artist, Album, Year* ke dalam satu file MP3 tunggal ATAU ke seluruh file MP3 di dalam sebuah folder sekaligus secara otomatis.

---

## 🚀 Cara Menjalankan

### Paling Mudah: Double-click launcher

1. Buka folder repo ini.
2. Jalankan **[ElToolkitDeRWBU.bat](ElToolkitDeRWBU.bat)**.
3. Tunggu pengecekan sistem. Tool akan bertanya apakah kamu ingin menjalankan **[1] Mode GUI** atau **[2] Mode TUI**.
4. Pilih browser yang kamu inginkan (Chrome otomatis dijadikan target default).
5. Web akan terbuka di `http://localhost:3000`.

> Catatan penting: tool ini akan **meminta persetujuan (Y/N)** sebelum mengunduh/menginstal dependency yang belum ada via `winget`.

Jika instalasi butuh izin admin, jalankan:
- **[ElToolkitDeRWBU-Admin.bat](ElToolkitDeRWBU-Admin.bat)**

---

## 💻 Mode TUI (Legacy)

Jika kamu memilih Mode TUI (Terminal Lama), kamu akan diarahkan ke script PowerShell interaktif. Fitur-fitur lama seperti batch rename, konversi media, dan eksekusi YT-DLP masih tersedia secara utuh. File utama script lama kini bernama `ElToolkitDeRWBU_Legacy.ps1`.

### MetadataWriterDeRWBU (Standalone TUI)

Kamu juga masih bisa menjalankan *script standalone* lama:
```powershell
powershell -ExecutionPolicy Bypass -File .\MetadataWriterDeRWBU.ps1
```
Tool ini mendukung pengeditan interaktif atau massal lewat file `.txt` (INI-style).

---

## 🛠️ Kompatibilitas & Dependency

- Windows 10/11
- Windows PowerShell 5.1+ atau PowerShell 7 (`pwsh`)
- Dependency utama: `yt-dlp`, `ffmpeg`, `node` (Diurus otomatis oleh skrip `CheckDependencies.ps1` via `winget`)
- UI Web: HTML, CSS, Vanilla JS, Node.js (`express`)

---

## ⚠️ Troubleshooting & Keamanan

- **Terminal GUI Jangan Ditutup**: Selama kamu menggunakan antarmuka web di browser, jendela terminal (hitam) harus tetap terbuka sebagai *backend* lokal.
- **Dependency Gagal**: Pastikan PC Windows kamu mendukung perintah `winget`.
- **Keamanan Cookies**: Jika kamu memakai metode otentikasi YT-DLP via file `cookies.txt`, pastikan untuk TIDAK mempublikasikan file tersebut (jangan *commit* ke Git) karena berisi kredensial sensitif.

---
*Didesain untuk kecepatan, tanpa kompromi.*
