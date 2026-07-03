# ElToolkitDeRWBU

ElToolkitDeRWBU adalah toolkit terintegrasi untuk Windows yang dirancang untuk mengotomatisasi alur kerja pengunduhan dan pemrosesan media, memanfaatkan kapabilitas YouTube dan FFmpeg.

Aplikasi ini tersedia dalam **Dua Mode Utama**:
1. **Mode Web GUI** (Direkomendasikan) - Antarmuka berbasis web lokal untuk kemudahan operasional dan multi-tasking.
2. **Mode TUI** (Legacy) - Antarmuka berbasis teks (Text User Interface) yang dijalankan melalui PowerShell.

---

## Fitur Web GUI (Versi Terbaru)

Web GUI berjalan secara lokal menggunakan Node.js dan menyediakan antarmuka modern di browser Anda:

- **Manajemen Dependensi Otomatis**: Menjalankan launcher di sistem baru akan secara otomatis memverifikasi dan menginstal dependensi yang diperlukan (`yt-dlp`, `ffmpeg`, dan `Node.js`) melalui `winget` setelah mendapatkan persetujuan pengguna. Server kemudian akan langsung dijalankan.
- **YT-DLP Queue & Resolusi Dinamis**: Mendukung pemrosesan banyak URL sekaligus. Sebelum mengunduh, sistem mengambil dan menampilkan daftar resolusi yang tersedia (misal: 1080p, 720p) untuk masing-masing video. Antrean akan diproses secara sekuensial.
- **FFmpeg Trimming**: Memungkinkan pemotongan video instan tanpa proses re-encode dengan mendefinisikan Start Time dan End Time (format HH:MM:SS).
- **FFmpeg Mirror**: Melakukan pembalikan video secara horizontal (H-Flip).
- **MP3 Converter**: Memindai direktori yang dipilih dan mengonversi seluruh file media menjadi format MP3 320kbps secara massal, kemudian menyimpannya ke dalam struktur direktori output yang rapi.
- **MP3 Metadata Editor (Batch & Folder)**: Menyematkan ID3 tags (Judul, Artis, Album, Tahun) ke dalam satu file MP3 tunggal atau menerapkannya secara massal ke seluruh file MP3 dalam suatu direktori.

---

## Panduan Penggunaan

### Eksekusi Standar (Direkomendasikan)

1. Buka direktori repositori ini.
2. Jalankan file **[ElToolkitDeRWBU.bat](ElToolkitDeRWBU.bat)**.
3. Tunggu hingga proses pengecekan sistem selesai. Sistem akan meminta Anda memilih mode: **[1] Mode GUI** atau **[2] Mode TUI**.
4. Jika memilih Mode GUI, tentukan browser yang ingin digunakan (Chrome diatur sebagai target default).
5. Aplikasi web akan terbuka secara otomatis di `http://localhost:3000`.

> Catatan: Aplikasi akan meminta persetujuan eksplisit (Y/N) sebelum mengunduh atau menginstal dependensi yang tidak ditemukan via `winget`.

Jika instalasi memerlukan hak akses Administrator:
- Jalankan file **[ElToolkitDeRWBU-Admin.bat](ElToolkitDeRWBU-Admin.bat)**

---

## Mode TUI (Legacy)

Memilih Mode TUI akan menjalankan skrip PowerShell interaktif. Fitur-fitur lama seperti batch rename, konversi media, dan eksekusi YT-DLP secara langsung tetap beroperasi penuh. File skrip utama versi ini sekarang dinamakan `ElToolkitDeRWBU_Legacy.ps1`.

### MetadataWriterDeRWBU (Standalone TUI)

Skrip metadata standalone versi lama tetap dapat dijalankan secara langsung:
```powershell
powershell -ExecutionPolicy Bypass -File .\MetadataWriterDeRWBU.ps1
```
Tool ini mendukung pengeditan interaktif maupun pemrosesan massal menggunakan file `.txt` berformat INI.

---

## Kompatibilitas & Dependensi

- Windows 10/11
- Windows PowerShell 5.1+ atau PowerShell 7 (`pwsh`)
- Dependensi Utama: `yt-dlp`, `ffmpeg`, `node` (Dikelola secara otomatis oleh skrip `CheckDependencies.ps1` via `winget`)
- Tumpukan Teknologi Web: HTML, CSS, Vanilla JS, Node.js (`express`)

---

## Pemecahan Masalah & Keamanan

- **Manajemen Jendela Terminal**: Selama Anda menggunakan antarmuka web, jendela terminal harus tetap dibiarkan terbuka karena berfungsi sebagai backend lokal.
- **Kegagalan Dependensi**: Pastikan sistem Windows Anda mendukung perintah manajer paket `winget`.
- **Keamanan Cookie**: Jika menggunakan metode autentikasi YT-DLP melalui file `cookies.txt`, pastikan file tersebut TIDAK dipublikasikan atau di-commit ke repositori Git, karena file tersebut berisi kredensial sesi yang sangat sensitif.
