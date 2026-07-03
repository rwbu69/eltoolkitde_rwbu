# ElToolkitDeRWBU

Aplikasi Multi-Tool berbasis **Tauri v2** + **Vanilla JS**.

## Instalasi & Dukungan Lintas Platform (Cross-Platform)

Aplikasi ini di-build secara otomatis untuk Windows, macOS, dan Linux melalui GitHub Actions. Jika Anda menemui kendala saat menjalankan rilis (Release) kami, silakan ikuti panduan berikut sesuai OS Anda:

### 1. Windows (.exe / NSIS)
Aplikasi ini berjalan secara *native* di Windows.
- **Syarat**: Anda memerlukan **WebView2 Runtime** terinstal di PC Anda (secara default sudah terpasang di Windows 11).
- Jika Anda mengunduh *installer* berformat `.exe` (NSIS), proses instalasinya akan secara otomatis mengunduh WebView2 jika belum ada.
- *Catatan: Jika saat membuka aplikasi muncul error aneh, pastikan Anda menggunakan versi Installer `.exe` dari rilis terbaru.*

### 2. macOS (.app / .dmg)
Karena aplikasi ini dibuat melalui GitHub Actions (CI) bersifat *Open Source* dan **belum di-sertifikasi (Unsigned)** menggunakan lisensi Apple Developer berbayar, fitur keamanan *Apple Gatekeeper* mungkin akan memblokir aplikasi dengan pesan:
> *"App is damaged and can't be opened. You should move it to the Trash."*

**Solusi (Bypass Gatekeeper):**
1. Ekstrak atau *Mount* file `.dmg` dan pindahkan `ElToolkitDeRWBU.app` ke folder `Applications` (Aplikasi) Anda.
2. Buka aplikasi **Terminal** bawaan Mac Anda.
3. Jalankan perintah pelepasan karantina (*unquarantine*) berikut:
   ```bash
   xattr -cr /Applications/ElToolkitDeRWBU.app
   ```
4. Selesai! Anda sekarang dapat membuka aplikasi seperti biasa.

### 3. Linux (.deb / .AppImage)
Terdapat dua varian build untuk Linux:
- **.deb (Direkomendasikan untuk Ubuntu/Debian)**: 
  Sangat disarankan mengunduh versi `.deb` karena paket ini akan otomatis mendeteksi dan menginstal pustaka UI yang dibutuhkan (seperti `webkit2gtk`) melalui manajer paket (`apt`).
- **.AppImage (Portabel)**:
  Format mandiri ini dapat dijalankan langsung di berbagai distro. 
  - **Catatan untuk Ubuntu 22.04+**: Sistem Linux modern secara default tidak lagi menyertakan `libfuse2`, yang merupakan syarat wajib berjalannya AppImage. Jika AppImage tidak mau terbuka (klik dua kali tidak terjadi apa-apa), buka terminal dan jalankan:
    ```bash
    sudo apt install libfuse2
    ```
    Lalu pastikan file AppImage Anda diberi izin eksekusi (`chmod +x`).

---

## Development (Pengembangan Lokal)
Jika Anda ingin ikut berkontribusi atau merakit aplikasi ini dari sumber:

```bash
# 1. Install dependencies NPM
npm install

# 2. Jalankan mode pengembangan
npm run tauri dev

# 3. Build aplikasi untuk OS Anda saat ini
npm run tauri build
```
*(Proses build akan secara otomatis mengunduh biner FFmpeg dan YT-DLP sesuai sistem operasi Anda).*
