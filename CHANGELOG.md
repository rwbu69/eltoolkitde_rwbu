# Changelog

## [Unreleased]

### Anime Themes Downloader (`animethemes.moe` + AniList)
- Added opt-in **Anime Themes Downloader** (disabled by default in **Settings → Enable Anime Themes Downloader**).
- Added GraphQL search and lightweight cached autocomplete across **anime titles** (Romaji + English), **song names**, and **artists** via `rs.animethemes.moe/graphql`.
- Added lazy-loaded anime cover thumbnails via AniList (`graphql.anilist.co`, `IntersectionObserver` batching + `AppState` cache) and responsive horizontal strip cards on non-fullscreen windows.
- Added inline `<video>` preview modal (with automatic `$TEMP` + `convertFileSrc` fallback) and WebM → **H.264 MP4** / **H.265 MP4** conversion with clean `<Show Title> - <Theme> (<Res>p NC).mp4` naming and embedded `title`, `artist`, `album`, and `date` metadata.

### Visual Video Trimmer & GIF Maker
- Enabled Tauri v2 `assetProtocol` (`protocol-asset`) to stream local video files into a `<video>` preview synced directly with `WaveSurfer` in **Trim** mode, plus a **Frame-accurate cut** re-encode toggle.
- Added **To GIF** mode in **Converter & Trim** using FFmpeg `fps`, `scale`, and `palettegen=stats_mode=diff` / `paletteuse` with optional start/end clip range.

### UX, Diagnostics & Branded Installer
- Added **Enable debug console logging** in Settings (`dispatchDebug`), modular HTTP `429` cooldown banners (`useRateLimitCooldown` + `RateLimitNotice`), and plain-English `formatFriendlyError` UI messages.
- Customized Tauri v2 NSIS (`nsis-sidebar.bmp`, `nsis-header.bmp`, `LICENSE`) and macOS DMG (`dmg-background.png`) installer assets.

## ElToolkitDeRWBU v0.1.4 — Audio Waveform Studio, UI Declutter & Media Pipeline Overhaul

Date: 2026-11-27

### Interactive Waveform Trimmer & Audio Studio

- Added native audio waveform peak extraction in Rust (`get_audio_waveform` command) using `symphonia` with micro-chunk streaming downsampling (< 4 MB peak RAM, ~800 peak amplitude pairs, < 50ms processing).
- Added interactive `WaveformTrimmer` in Audio Studio powered by `wavesurfer.js` v7 with `RegionsPlugin`: draggable/resizable region handles, timeline ruler, playback controls (`Play Selection`, `Play Full`, `Stop`, `Loop`), zoom slider, and millisecond nudge buttons.
- Integrated bidirectional synchronization between waveform region drag handles and start/end timecode inputs.
- Preserved stream-copy lossless trimming via FFmpeg (`-c copy`).

### Media Downloader & Thumbnail Embedding

- Removed hardcoded `youtube:player_client=android,web` override so all resolutions (`360p`–`4K`) resolve reliably.
- Added `Smart` (`H.264 / H.265 — No AV1/VP9`) as the default video codec (`settingsVersion: 2` migration) to keep native H.264/H.265 downloads instantaneous while auto-transcoding AV1/VP9 streams (e.g., 1440p/4K) with GPU encoder fallback (`nvenc`/`qsv`/`amf`/`videotoolbox` → CPU), stream-scoped Resolume-safe flags (`-pix_fmt:v:0 yuv420p`, `-tag:v:0 hvc1`, `-movflags +faststart`), and live FFmpeg `time=` progress.
- Added compact 16:9 thumbnails inside Active Queue cards (`QueueItemCard`) using existing `yt-dlp` metadata and updated Tauri `img-src` CSP (`https: data:`).
- Added `Transcoding` queue card status, cancellable FFmpeg transcode spawning, session caching for sidecar/encoder probes, and automatic audio stripping (`-an`) if `video-only` falls back to a muxed stream.
- Bundled lightweight QuickJS (`quickjs-ng` / `qjs`) as a Tauri sidecar and passed `--js-runtimes quickjs:...` to `yt-dlp` for YouTube EJS challenge support.
- Switched to embed-only thumbnail handling across MP4, MP3, and video-only downloads by removing `--write-thumbnail` and retaining `--embed-thumbnail` with automatic format conversion to JPEG (`--convert-thumbnails jpg`).
- Fixed post-download FFmpeg video codec optimization to preserve embedded cover art (`-map 0:v:0`, `-map 0:v:1? -c:v:1 copy -disposition:v:1 attached_pic`, `-map 0:a? -c:a copy`), preventing FFmpeg from discarding embedded thumbnail streams when transcoding.
- Ensured no standalone `.jpg` or `.webp` files remain in output folders after downloads complete.

### UI Decluttering & Sizing Standardization

- Removed redundant in-stage section titles and subheaders across Downloader, Batch Renamer, Audio Studio, and Settings, using the Top HUD as the single source of truth.
- Removed duplicate cookie/authentication status badges inside view cards, preserving the HUD indicator.
- Standardized layout to the strict 3-Tier Height System:
  - Tier 1 (`h-10` / 40px): Standard form inputs, selectors, and secondary buttons.
  - Tier 2 (`h-11` / 44px): Primary hero action buttons (`Check links`, `Apply to N files`, etc.).
  - Tier 3 (`h-8` / 32px): Utility actions and toolbar buttons.
- Simplified Downloader's setup grid (Format, Video Resolution / Audio Bitrate, and full-width Output Folder) by removing the redundant Download Preset selector.
- Fixed `CustomSelect` dark-mode hover contrast and standardized dropdowns in `DownloaderView`, `BpmModifierView`, and `SettingsView` on `<CustomSelect>`.
- Pre-filled existing ID3 tags in `MetadataView` and expanded its single-file picker to all 7 supported audio formats (`.mp3`, `.flac`, `.m4a`, `.ogg`, `.wav`, `.opus`, `.aac`), preserving source extensions in `.metadata-backup.<ext>`.
- Auto-filled `defaultOutputDir` in `BpmModifierView`, refreshed `RenameView` previews after rename/undo, preserved per-line timestamps in `TerminalLogView`, and made `joinPath` separator-aware.
- Eliminated blurry inset shadows and fuzzy drop shadows on pill buttons and inputs, establishing crisp, solid flat arcade surfaces with `border-2 border-subtleborder` and explicit `box-border`.

### Responsive Layout & Terminal Drawer Redesign

- Removed the floating `>_ SYSTEM LOGS` tab button from the bottom viewport edge, eliminating layout overlap with the Active Queue and mobile bottom navigation dock.
- Integrated system log toggling into the dedicated Top HUD Terminal button, with unread error indicators.
- Added mobile safe bottom padding (`pb-20`) to prevent scrolling content from being hidden behind the bottom navigation dock on narrow screens.

### CI/CD & Cross-Platform Release Reliability

- Made scripts/setup-sidecars.cjs target-aware with explicit architecture mapping (bin/darwin/arm64/ffprobe vs bin/darwin/x64/ffprobe), preventing Mach-O CPU architecture mismatch on Intel and Apple Silicon macOS builds.
- Added non-zero file size validation in sidecar copying to prevent empty cache artifacts from failing build verification.
- Integrated Apple quarantine flag purge (xattr -dr com.apple.quarantine) in macOS CI build verification to prevent Gatekeeper bundle packaging errors.
- Added Swatinem/rust-cache@v2 to GitHub Actions ci.yml Rust checks, speeding up PR verification cycles.
- Synchronized version 0.1.4 across package.json, Cargo.toml, and tauri.conf.json.
- Removed *.test.ts pattern from .gitignore so all 6 test suites (31 unit tests) are tracked by Git and executed in CI.

### Cleanups & Maintenance

- Added [USER_GUIDE.md](USER_GUIDE.md) and [LOGIC_REFERENCE.md](LOGIC_REFERENCE.md) covering user workflows and code locations for every menu, service, and Rust command.
- Updated `README.md` with new visual assets (`images/header.png`, refreshed `images/downloader.png`) and synced `.github/` release workflows and templates.
- Made `update_ytdlp` asynchronous (`tokio::task::spawn_blocking`) so updates do not block the Tauri IPC thread.
- Lazy-loaded `KhinsiderView` and `AudioStudioView` in `App.tsx`, deduplicated FFmpeg/Symphonia helpers, and removed dead `useSettings.ts` and unused `src-python/` scripts.
- Removed technical runtime log annotations ("via native Rust...") across BPM detection, metadata tagging, and yt-dlp codec verification.
- Updated Vitest unit test suite to assert `yt-dlp` resolution sorting, playlist thumbnails, QuickJS runtime wiring, and embed-only thumbnail configurations (6 test files, 31 unit tests passing).

---

## ElToolkitDeRWBU v0.1.3 — Release Readiness Update

Released: 2026-10-29

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
