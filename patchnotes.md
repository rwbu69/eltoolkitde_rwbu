## ElToolkitDeRWBU v0.1.1 - The "Visual & Control" Update

Update kali ini berfokus pada perombakan estetika antarmuka secara keseluruhan agar selaras dengan tema "Visual Novel / Game" serta menambahkan kontrol penuh bagi pengguna terhadap proses-proses di balik layar.

### Visual & UI Overhaul (Perombakan Visual)
- **Tema Visual Novel Premium**: Seluruh elemen UI (tombol, input, panel) sekarang menggunakan gaya desain visual novel yang tegas (garis tebal, warna kontras *pink* dan toska) yang memberikan pengalaman premium.
- **Custom Titlebar Terintegrasi**: Bilah judul (Titlebar) Windows bawaan telah dihilangkan dan diganti dengan desain kustom yang menyatu dengan tema aplikasi. Menu klik kanan bawaan Windows pada titlebar kini telah dinonaktifkan sepenuhnya.
- **Pembersihan Elemen Mengganggu**: Nomor versi dihilangkan dari titlebar untuk menjaga estetika, serta ikon-ikon pudar yang mengganggu di layar kosong (*empty state*) pada kolom sebelah kanan kini telah dihilangkan untuk tampilan yang lebih bersih.
- **Elemen Interaktif**: Menambahkan *micro-animations* dan efek *hover* yang responsif pada semua tombol dan *checkbox*.

### Fitur Baru (New Features)
- **Close Button Action Config**: Anda kini memegang kendali penuh atas tombol "X". Melalui menu **Settings**, Anda bisa mengatur apakah tombol *Close* akan me-minimize aplikasi ke System Tray (membiarkan proses berjalan di latar belakang) atau menutup mati (Quit / Kill) aplikasi secara keseluruhan beserta semua prosesnya. Pengaturan menggunakan UI *checkbox* bergaya game.
- **Universal Process Cancellation**: Menambahkan kemampuan untuk membatalkan proses *background* kapan saja! Tombol **CANCEL / ABORT** kini tersedia di:
  - **FFmpeg Tool**: Untuk membatalkan konversi, *trimming*, atau *mirroring*.
  - **Metadata Editor**: Untuk menghentikan proses *batch ID3 tagging* secara instan.
  - **Downloader (yt-dlp)**: Terintegrasi dengan pembatalan unduhan yang aman.
- **Notifikasi Latar Belakang Kustom**: Saat aplikasi di-minimize ke System Tray, notifikasi Windows yang muncul kini menggunakan teks Bahasa Indonesia ("ElToolkit Disembunyikan") agar lebih relevan dan sesuai identitas aplikasi.

### Perbaikan & Peningkatan (Improvements & Fixes)
- **Kompatibilitas Format MP4 (yt-dlp)**: Unduhan untuk opsi format `mp4` dan `video-only` kini secara otomatis memprioritaskan *codec* video **H.264 / H.265** dan *codec* audio **AAC**. Perbaikan ini memastikan video MP4 yang diunduh bersifat "Native" dan dapat diputar langsung di hampir semua pemutar media, perangkat Apple (QuickTime/iOS), maupun *software video editing* tanpa masalah, menghindari penggunaan VP9/AV1+Opus yang sering memicu isu kompatibilitas.
