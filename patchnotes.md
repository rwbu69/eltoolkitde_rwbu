# Patch Notes - v__LATEST__

## Fitur & Peningkatan
- **Desain UI Estetika Linear**: Merombak tampilan antarmuka (UI) menjadi lebih bersih dan modern dengan estetika bergaya Linear, sekaligus menambahkan dukungan *cookies*.
- **Struktur Proyek Tauri & CI/CD**: Menginisialisasi proyek Tauri dengan manajemen *sidecar* yang dinamis serta otomatisasi *build* lintas OS. Juga memperbarui *workflow* dengan batasan versi Node.js ke v24.0.0.
- **UI Progress Bar Antrean**: Menambahkan indikator *progress bar* visual langsung di bawah setiap item antrean (dilengkapi informasi persen, kecepatan, dan ETA) dengan *throttling* pintar agar performa tetap ringan.
- **Pilihan Preset Resolusi**: Menambahkan preset resolusi praktis (Best, Higher, Low) yang akan diproses otomatis oleh yt-dlp untuk memilih kualitas video terbaik dalam rentang resolusi yang diminta.
- **Penyesuaian Mode Pintar**: Dropdown resolusi akan disembunyikan otomatis jika memilih mode *Audio Only*.
- **Informasi Audio Bitrate**: Menampilkan estimasi *bitrate* audio mentah dari YouTube langsung di judul antrean.
- **Terminal Konsol Ringkas**: Menambahkan tombol `Toggle` untuk membuka/melipat konsol terminal. Secara *default* konsol disembunyikan agar tampilan lebih rapi. Log yang tidak penting juga telah dihilangkan (hanya menampilkan Error/Warning).
- **Sepenuhnya Mandiri (Standalone)**: Aplikasi kini membundel FFmpeg, FFprobe, dan Node.js secara langsung (cross-platform). Pengguna tidak perlu menginstal apa pun secara manual!
- **Otomatisasi Build**: Konfigurasi GitHub Actions telah dikembalikan untuk membangun dan merilis otomatis setiap kali Anda melakukan *push* (serta memuat isi file ini ke GitHub Releases).

## Perbaikan Bug
- **Perbaikan Build TypeScript**: Menyelesaikan *error* kompilasi TypeScript (TS5101, TS2882, TS6133) yang mengganggu proses integrasi di GitHub Actions.
- **Perbaikan Krusial macOS Sidecars**: Memperbaiki masalah di mana aplikasi gagal menemukan FFmpeg dan Node.js pada perangkat macOS (`.app` bundle) karena Tauri menghilangkan *suffix* nama file pada saat *build*. Sistem kini melakukan penelusuran agresif pada direktori `Contents/MacOS` dan `Contents/Resources`, serta memberikan *permission* eksekusi yang benar.
- **Perbaikan Path Post-Processing**: Menyelesaikan bug di mana yt-dlp gagal menemukan FFmpeg/FFprobe karena perbedaan penamaan *sidecar* Tauri. Sistem menggunakan *symlink* pintar untuk meresolusi path secara otomatis di semua OS.
