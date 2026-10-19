# Changelog

## Unreleased

### Cross-platform release support

- Updated the GitHub Actions release workflow to build Windows, Linux, Intel macOS, and Apple Silicon macOS packages on native runners.
- Replaced the previous macOS universal-binary setup with separate architecture-specific builds.
- Made sidecar preparation target-aware for FFmpeg, FFprobe, yt-dlp, Node.js, and the BPM tools.
- Added sidecar existence and executable checks before packaging.
- Switched CI frontend dependency installation from `npm install` to reproducible `npm ci`.
- Added separate macOS `.dmg` artifacts for Intel and Apple Silicon devices.
- Added Linux `.deb` and AppImage release targets.
- Documented unsigned macOS installation, Gatekeeper approval, quarantine removal, Linux installation, architecture selection, development setup, and known packaging limitations in the README.

### UI consistency and interaction improvements

- Standardized user-facing language to English across menus, system notifications, statuses, and action labels.
- Replaced raw browser alerts with inline notices and expandable technical details.
- Added shared status labels for waiting, checking, downloading, analyzing, processing, completed, failed, canceled, skipped, and playlist-expanded states.
- Added shared empty states, inline notices, and action footers for consistent menu behavior.
- Standardized button icon sizing and reduced excessive arcade-style button movement and border weight.
- Improved downloader icon semantics for video format, resolution, and audio bitrate.
- Replaced the downloader's scrolling resolution dropdown with a compact responsive resolution grid.

### Downloader and BPM improvements

- Added playlist inspection and confirmation before queueing large or unexpected download jobs.
- Added queue-wide cancellation that prevents pending items from starting after cancellation.
- Added per-item and batch retry actions for failed or canceled downloads.
- Added targeted cleanup actions for completed items and issues.
- Improved queue summaries, statuses, error details, responsive layout, and accessibility labels.
- Added candidate BPM analysis, half-time and double-time handling, confidence scoring, and manual BPM correction.
- Added WAV and MP3 output support for BPM processing.
- Improved BPM validation and partial-output cleanup.

### Security and maintenance

- Removed the legacy application and its obsolete test and server code.
- Authorized the BPM modifier sidecar in the Tauri capability configuration.
- Removed the yt-dlp certificate-bypass behavior.
- Unified shared media settings and migrated older persisted setting values.

---

## ElToolkitDeRWBU v0.1.2 — Workflow and Aesthetics Update

This update focused on improving the interface, adding a studio-oriented BPM tool, and optimizing download workflows.

### Visual and UI overhaul

- Migrated the interface and color tokens to a Catppuccin-inspired palette with Latte light mode and Mocha dark mode.
- Improved contrast in dark mode, including readable text on bright pastel surfaces.

### New features

- Added a batch BPM modifier powered by Python, librosa, soundfile, and FFmpeg.
- Added onset-envelope and dynamic-programming BPM detection.
- Added BPM range constraints to reduce octave errors.
- Added editable BPM results so users can correct detection drift before processing.
- Added background yt-dlp update checks with output in the System Log.

### Improvements and fixes

- Refactored the Downloader, FFmpeg, Metadata, Rename, and BPM menus around shared UI components.
- Improved layout consistency, spacing, interaction states, and small-window behavior.
- Added configurable concurrent downloads.

---

## ElToolkitDeRWBU v0.1.1 — Visual and Control Update

This update introduced the application's visual-novel-inspired interface and expanded process control.

### Visual and UI overhaul

- Added a visual-novel-inspired design with strong borders, contrasting pink and teal accents, and lightweight micro-animations.
- Replaced the native Windows titlebar with an integrated custom titlebar.
- Simplified empty states and removed distracting version text from the titlebar.
- Added hover and interaction feedback to buttons and toggles.

### New features

- Added a Settings option to either minimize the application to the system tray or fully quit when the close button is pressed.
- Added cancellation controls for FFmpeg conversion, trimming, mirroring, metadata processing, and yt-dlp downloads.
- Added background notifications when the application is minimized to the system tray.

### Improvements and fixes

- Improved MP4 and video-only download compatibility by prioritizing H.264/H.265 video and AAC audio where available.
- Reduced the likelihood of downloads using less compatible VP9/AV1 and Opus combinations for common MP4 workflows.
