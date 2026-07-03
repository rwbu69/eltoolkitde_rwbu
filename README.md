# ElToolkitDeRWBU (Tauri v2)

ElToolkitDeRWBU adalah aplikasi GUI modern yang dibangun menggunakan **Tauri v2** dengan antarmuka Vanilla HTML/CSS/JavaScript. Aplikasi ini bertindak sebagai alat bantu (wrapper) canggih untuk mengunduh video menggunakan `yt-dlp` dan `ffmpeg` di balik layar.

## 🚀 Fitur Utama
- **Native & Ringan**: Tidak menggunakan Node.js di backend, sepenuhnya mengandalkan Rust dan WebView untuk performa optimal.
- **Cross-Platform**: Mendukung Windows, macOS (Intel & Apple Silicon), dan Linux.
- **Dynamic Sidecars**: Mengunduh dan menyiapkan file biner statis (`ffmpeg`, `yt-dlp`) secara dinamis sesuai arsitektur OS sesaat sebelum kompilasi.
- **Automated CI/CD**: Terintegrasi penuh dengan GitHub Actions untuk merilis *installer* lintas sistem operasi secara otomatis!

## 🌿 Branch `build` & Proses Rilis (GitHub Actions)
Repositori ini memiliki konfigurasi *Cloud CI/CD* canggih yang terpusat di branch `build`.
Untuk membuat versi rilis baru dari aplikasi ini tanpa harus mengompilasinya secara manual di komputer Anda:
1. Pastikan Anda berada di branch `build` (atau dorong pembaruan Anda ke branch ini).
2. Lakukan `git push` ke GitHub.
3. **GitHub Actions** akan secara otomatis menyala (lihat tab "Actions" di repositori Anda).
4. Bot akan mendeteksi OS target (Mac, Linux, Windows), menyuntikkan *sidecar binaries* secara dinamis, lalu membungkus aplikasi (`.exe`, `.dmg`, `.AppImage`).
5. Hasil akhirnya akan langsung dipublikasikan ke tab **Releases** di GitHub secara otomatis!

## 🛠️ Pengembangan Lokal (Development)

### Persyaratan Sistem
- [Node.js](https://nodejs.org) (v20 ke atas disarankan)
- [Rust](https://www.rust-lang.org/) (Pastikan Anda menggunakan `stable-x86_64-pc-windows-msvc` jika di Windows)
- C++ Build Tools (Visual Studio 2022) untuk Windows.

### Menjalankan Aplikasi
```bash
npm install
npm run tauri dev
```

### Menguji Aplikasi (Unit Testing)
Proyek ini dilengkapi dengan `Vitest` dan `JSDOM` untuk memastikan UI dan alur bisnis bebas dari malfungsi dan kebocoran memori (memory leak).
```bash
npm test
```

## 🏗️ Struktur Proyek
- `src/` - Berisi logika antarmuka pengguna (Vanilla JS, HTML, CSS).
- `src-tauri/` - Berisi konfigurasi Rust, pengaturan izin aplikasi (capabilities), dan jembatan native.
- `scripts/setup-sidecars.cjs` - Skrip krusial untuk mengunduh `yt-dlp` dan `ffmpeg` sesuai OS sebelum proses *build* berjalan.
- `.github/workflows/tauri-build.yml` - Nyawa dari sistem kompilasi rilis otomatis kta.

## 📝 Catatan Khusus MacOS Universal Build
Tauri membutuhkan _3 jenis sidecar_ (aarch64, x86_64, universal) agar sukses membangun file `.dmg` bagi ekosistem Apple. Skrip `setup-sidecars.cjs` telah direkayasa untuk memenuhi persyaratan ekstrim ini secara otomatis.

---
*Dibangun dengan dedikasi tinggi melalui Antigravity IDE.*
