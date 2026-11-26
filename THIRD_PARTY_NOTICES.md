# Third-Party Software Notices and Information

This project, **ElToolkitDeRWBU**, bundles or prepares standalone third-party binaries and dependencies to enable media downloading, conversion, and tempo processing out of the box.

This document lists each bundled component, its license, and where its source code can be obtained.

---

## 1. FFmpeg and FFprobe

### Overview and Licensing
- **Project**: FFmpeg
- **Website**: [https://ffmpeg.org](https://ffmpeg.org)
- **Version**: FFmpeg 6.1.1 (via `ffmpeg-static` v5.3.0) and FFprobe 4.0.2 (via `ffprobe-static` v3.1.0)
- **License**: **GNU General Public License v3.0 or later (GPL-3.0-or-later)**

While upstream FFmpeg is fundamentally licensed under the LGPL v2.1 or later, the precompiled static binaries prepared by `scripts/setup-sidecars.cjs` (via the `ffmpeg-static` package) are built with GPL-licensed libraries enabled (notably `libx264` for H.264 video compression). Under the terms of the GPL, enabling these libraries causes the combined binary to be licensed as **GPL-3.0-or-later**.

### Source Code Availability
In compliance with the GNU General Public License, the source code for FFmpeg and its build configurations can be obtained from the following locations:
- **Upstream FFmpeg source code**: [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html) and git repository `git clone https://git.ffmpeg.org/ffmpeg.git`
- **Binary distribution recipes & packaging**: [https://github.com/eugeneware/ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) and [https://github.com/joshwnj/ffprobe-static](https://github.com/joshwnj/ffprobe-static)
- **Static build providers**:
  - Windows x64: [Gyan.dev](https://www.gyan.dev/ffmpeg/builds/)
  - Linux x64: [John Van Sickle](https://www.johnvansickle.com/ffmpeg/)
  - macOS (Intel & Apple Silicon): [Helmut K. C. Tessarek (Evermeet)](https://evermeet.cx/ffmpeg/) and [OSXExperts](https://osxexperts.net/)

---

## 2. yt-dlp

- **Project**: yt-dlp
- **Website / Repository**: [https://github.com/yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp)
- **License**: **The Unlicense (Public Domain Dedication)**
- **Source Code**: [https://github.com/yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp)

*yt-dlp is dedicated to the public domain under The Unlicense. You can copy, modify, distribute, or run the software without restriction.*

---

## 3. QuickJS (`quickjs-ng`)

- **Project**: QuickJS (`quickjs-ng`)
- **Website / Repository**: [https://github.com/quickjs-ng/quickjs](https://github.com/quickjs-ng/quickjs)
- **Role in App**: Bundled into `src-tauri/` as a lightweight external sidecar runtime (`qjs`) passed to `yt-dlp` via `--js-runtimes quickjs:...` to evaluate JavaScript challenges for media extraction.
- **License**: **MIT License**
- **Source Code**: [https://github.com/quickjs-ng/quickjs](https://github.com/quickjs-ng/quickjs)
