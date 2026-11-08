# Changelog

## ElToolkitDeRWBU v0.1.3 — Release Readiness Update

Released: 2026-11-08

### Repository maintenance

- Added contribution guidelines, code of conduct, security reporting guidance,
  issue and pull request templates, and CODEOWNERS.
- Added pull request CI for frontend tests, linting, production builds, and
  Rust checks.

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
- Added a shared bottom-right toast notification system for application feedback.
- Added native OS notifications for successful single downloads and completed
  Khinsider batches, while keeping partial or failed batches in-app.
- Added shared status labels for waiting, checking, downloading, analyzing, processing, completed, failed, canceled, skipped, and playlist-expanded states.
- Added shared empty states, inline notices, and action footers for consistent menu behavior.
- Simplified section headers by removing decorative icons and left-side color
  accents for a more consistent application-wide layout.
- Standardized button icon sizing and reduced excessive arcade-style button movement and border weight.
- Improved downloader icon semantics for video format, resolution, and audio bitrate.
- Replaced the downloader's scrolling resolution dropdown with a compact responsive resolution grid.
- Added download queue filters for active, failed/canceled, and completed items.

### Khinsider browser and downloader

- Added native Khinsider browsing, search, category navigation, album details,
  track inspection, and album artwork display.
- Added individual and batch MP3/FLAC downloads with progress reporting,
  cancellation, retry handling, sanitized filenames, and album subfolders.
- Added consistent right-aligned track controls for MP3, FLAC, and source-link
  actions.
- Refactored the Album Details toolbar into separate storage and selection/action
  zones, with an indeterminate select-all checkbox, contextual selection count,
  format choices for selected downloads, and clearer download-all actions.
- Standardized Khinsider control dimensions, typography, spacing, container
  styling, disabled states, and denser track-row spacing across light and dark
  themes without changing download behavior.
- Added selected-row highlighting, a sticky selection toolbar for active
  selections, compact folder-path presentation, and accessible source-link
  labels.
- Added viewport-aware album artwork loading with `IntersectionObserver`,
  placeholder artwork, a 300px preload margin, and a failure fallback for
  fast scrolling.
- Improved album artwork parsing to use the exact lazy/source URL from each
  Khinsider result row, preserve VGMTreasureChest hosts and filenames, cache
  detail-page fallbacks, and expose explicit cover loading states for diagnosis.
- Added conservative Khinsider request pacing, five-minute in-memory HTML
  caching, request deduplication through the cache, `Retry-After` support, and
  exponential backoff for rate-limited or temporary server errors.
- Made Khinsider an explicit opt-in feature, disabled by default, with no
  source requests while disabled and automatic cache clearing when turned off.
- Added a visible cache-clear action in Settings, a two-download concurrency
  limit, honest application identification, and bounded retry handling for
  audio downloads.
- Added safeguards that restrict direct audio downloads to HTTPS MP3/FLAC
  resources hosted by `vgmtreasurechest.com` or its subdomains.

### Downloader and BPM improvements

- Added playlist inspection and confirmation before queueing large or unexpected download jobs.
- Added queue-wide cancellation that prevents pending items from starting after cancellation.
- Added per-item and batch retry actions for failed or canceled downloads.
- Added targeted cleanup actions for completed items and issues.
- Improved queue summaries, statuses, error details, responsive layout, and accessibility labels.
- Added candidate BPM analysis, half-time and double-time handling, confidence scoring, and manual BPM correction.
- Added WAV and MP3 output support for BPM processing.
- Improved BPM validation and partial-output cleanup.
- Added quick download presets for common MP3, MP4, and video-only workflows.

### Security and maintenance

- Removed the legacy application and its obsolete test and server code.
- Authorized the BPM modifier sidecar in the Tauri capability configuration.
- Removed the yt-dlp certificate-bypass behavior.
- Unified shared media settings and migrated older persisted setting values.
- Stopped persisting browser-cookie and cookies.txt authentication settings.
- Disabled automatic yt-dlp self-updates during application startup.
- Added validation for media URLs, concurrency limits, and download rate limits.
- Prevented file rename overwrites and cross-directory rename operations.
- Added metadata backups with a restore action in the Metadata Editor.
- Added atomic manual yt-dlp updates with executable validation and rollback.

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
