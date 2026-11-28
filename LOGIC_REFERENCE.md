# ElToolkitDeRWBU — Codebase Logic Reference

This document maps every menu, sub-feature, shared service, global store, Rust Tauri command, and Python utility in the repository to the exact file paths and functions responsible for its business and programming logic.

---

## 1. Application Shell, Navigation & Global State

| Area | File | Responsible Functions / Symbols | Logic Responsibility |
| :--- | :--- | :--- | :--- |
| **Root Shell & Routing** | [src/App.tsx](src/App.tsx) | `MainTab`, `App()` | Manages active tab (`downloader`, `khinsider`, `studio`, `rename`, `settings`), lazy-loads `KhinsiderView` and `AudioStudioView`; toggles `dark` class on `document.documentElement`; syncs `enableKhinsider` with Rust (`set_khinsider_enabled`); dismisses splashscreen after 1s (`close_splashscreen`); bridges Tauri drag-and-drop to `toolkit-drop` window events; tracks `hasTerminalError` via `toolkit-log`. |
| **Global Store & Download Queue** | [src/store/useAppStore.ts](src/store/useAppStore.ts) | `useAppStore`, `normalizeSettings`, `executeDownloadJob`, `addToQueue`, `addBatchToQueue`, `retryItem`, `retryFailed`, `cancelItem`, `cancelAllDownloads`, `clearCompleted`, `resumeQueue`, `updateSettings` | Persists `settings` in `eltoolkit-storage` (`settingsVersion: 2` migrates legacy `h265` defaults once to `'smart'`); enforces concurrency via `pLimit` (`activeLimit`); manages `downloadGeneration` cancellation token; enforces `MAX_PLAYLIST_ITEMS` (500); detects YouTube rate-limits (`429` / `rate-limited`) and auto-pauses the queue (`isQueuePaused`, `pauseReason`). |
| **Custom Window Titlebar** | [src/components/ui/Titlebar.tsx](src/components/ui/Titlebar.tsx) | `Titlebar` (`minimize`, `maximize`, `close`) | Custom frameless window drag region and Tauri window state controls. |
| **Toast Notifications** | [src/components/ui/Toast.tsx](src/components/ui/Toast.tsx) | `showToast`, `ToastHost` | Dispatches and renders deduplicated toast notifications (1.5s dedup window, max 4 visible, 5s auto-dismiss) via `toolkit-toast`. |
| **Events & OS Notifications** | [src/utils/toolkitEvents.ts](src/utils/toolkitEvents.ts) | `dispatchLog`, `notifySuccess` | Emits `toolkit-log` custom events for the terminal drawer and requests/sends native OS notifications via `@tauri-apps/plugin-notification`. |
| **Input Validation** | [src/utils/validation.ts](src/utils/validation.ts) | `normalizeConcurrency`, `normalizeRateLimit`, `isValidMediaUrl` | Clamps concurrency to `1..10`, validates rate-limit strings (`RATE_LIMIT_PATTERN`), and checks `http:`/`https:` URLs. |
| **Path Helpers** | [src/utils/path.ts](src/utils/path.ts) | `basename`, `dirname`, `joinPath` | Cross-separator filename/directory extraction and Windows-style path joining. |
| **Error & Status Formatting** | [src/config/uiText.ts](src/config/uiText.ts) | `getStatusLabel`, `getUserFacingError`, `parseYtDlpError` | Maps internal operation statuses to UI labels and classifies `yt-dlp` errors (rate limits, cookie/auth required, network failures). |

---

## 2. Menu: Media Downloader (`downloader`)

| Layer | File | Responsible Functions / Symbols | Logic Responsibility |
| :--- | :--- | :--- | :--- |
| **View & Queue UI** | [src/components/DownloaderView.tsx](src/components/DownloaderView.tsx) | `DownloaderView`, `parseUrls`, `getUniqueUrls`, `handleDownload`, `queueInspectedUrls` | Parses & deduplicates pasted URLs; pre-inspects links via `YtDlpService.fetchVideoInfo` (with 800ms pacing); enforces `MAX_PLAYLIST_ITEMS` (500); prompts confirmation for multi-URL, playlist, or >10-item batches; filters queue (`all`, `active`, `completed`, `failed`); calculates batch progress and exposes pause/resume/retry/cancel/clear controls. |
| **Queue Item Card** | [src/components/downloader/QueueItemCard.tsx](src/components/downloader/QueueItemCard.tsx) | `QueueItemCard` | Renders compact 16:9 item thumbnail (falling back to status icon), status label, speed/ETA/percent progress bar, error details, and contextual cancel/retry/remove button. |
| **yt-dlp & Codec Service** | [src/services/ytdlp.ts](src/services/ytdlp.ts) | `YtDlpService.fetchVideoInfo`, `YtDlpService.downloadMedia`, `YtDlpService.getMediaVideoCodec`, `YtDlpService.updateYtDlp` | Runs `yt-dlp -J --flat-playlist` for metadata/playlists; uses `-S res:<cap>,vcodec:...` sorting with `bv*+ba/b` (`mp4`) or `bv*/b` (`video-only`); parses stdout progress and `[final_path]`/`[Merger]`/`[VideoRemuxer]` paths; probes downloaded video with `ffprobe`, keeps native `h264`/`hevc` in `smart` mode, and transcodes AV1/VP9 (or non-target codecs) using GPU encoders (`nvenc`/`qsv`/`amf`/`videotoolbox`) with CPU fallback, `-pix_fmt yuv420p`, `-movflags +faststart`, and live FFmpeg `time=` progress. |
| **Media Options** | [src/config/mediaSettings.ts](src/config/mediaSettings.ts) | `VIDEO_QUALITY_OPTIONS`, `AUDIO_BITRATE_OPTIONS`, `VIDEO_CODEC_OPTIONS` | Defines supported quality, codec, and bitrate enums/options. |

---

## 3. Menu: Game Music / Khinsider (`khinsider`)

| Layer | File | Responsible Functions / Symbols | Logic Responsibility |
| :--- | :--- | :--- | :--- |
| **Browser & Batch UI** | [src/components/KhinsiderView.tsx](src/components/KhinsiderView.tsx) | `KhinsiderView`, `CoverImage`, `loadPage`, `openAlbum`, `submitSearch`, `downloadTrack`, `cancelTrackDownload`, `toggleTrack`, `toggleAllTracks`, `downloadSelected` | Browses categories/search/albums with in-memory cover caching (`coverCacheRef`); resolves album tracks with `pLimit(2)`; listens to `khinsider-download-progress` events; supports single-track, selected-track, and full-album MP3/FLAC downloads with concurrency limiting and cancellation. |
| **Frontend Bridge** | [src/services/khinsider.ts](src/services/khinsider.ts) | `KhinsiderService` (`fetchPage`, `search`, `resolveTrack`, `downloadFile`, `cancelDownload`) | Thin Tauri `invoke` wrapper for Khinsider backend commands. |
| **Rust Scraper & Downloader** | [src-tauri/src/commands/khinsider.rs](src-tauri/src/commands/khinsider.rs) | `fetch_khinsider_page`, `resolve_khinsider_track`, `download_khinsider_file`, `set_khinsider_enabled`, `clear_khinsider_cache`, `cancel_khinsider_download`, `parse_khinsider_html`, `parse_audio_links`, `fetch_khinsider_html` | Enforces `khinsider_enabled` guard; rate-limits requests (900ms `khinsider_request_gate`); caches HTML (300s TTL, max 100 entries); retries 403/429/5xx with exponential backoff/`Retry-After`; scrapes categories/albums/tracks and `vgmtreasurechest.com` audio/cover URLs; streams MP3/FLAC downloads through a 2-slot semaphore while emitting `khinsider-download-progress` and honoring cancellation. |

---

## 4. Menu: Audio Studio (`studio`)

[src/components/AudioStudioView.tsx](src/components/AudioStudioView.tsx) hosts three sub-tabs (`converter`, `metadata`, `bpm`) and passes `isActive` so drag-and-drop targets only the active sub-view.

### 4A. Sub-tab: Converter & Trim (`converter`)

| Layer | File | Responsible Functions / Symbols | Logic Responsibility |
| :--- | :--- | :--- | :--- |
| **Converter & Trim UI** | [src/components/FfmpegView.tsx](src/components/FfmpegView.tsx) | `FfmpegView`, `handleSelectFiles`, `handleSelectFolderInput`, `handleProcess`, `adjustTimestamp` | Switches between `mp3`, `trim`, and `mirror` modes; collects files via dialog, folder scan, or `toolkit-drop`; manages trim timestamps and batch progress log. |
| **FFmpeg Service** | [src/services/ffmpeg.ts](src/services/ffmpeg.ts) | `FfmpegService.convertToMp3`, `FfmpegService.mirrorMedia`, `FfmpegService.trimMedia` | `convertToMp3`: converts to `output_mp3/*.mp3` (`libmp3lame`) using `.part` atomic rename and skips existing files. `mirrorMedia`: probes duration via `ffprobe`, applies `-vf hflip` (`libx264`), parses stderr `time=` for percentage. `trimMedia`: stream-copies (`-c copy`) between `-ss` and `-to`. |
| **Waveform Cutter UI** | [src/components/media/WaveformTrimmer.tsx](src/components/media/WaveformTrimmer.tsx) | `WaveformTrimmer`, `handlePlaySelection`, `handlePlayPauseFull`, `handleStop`, `handleZoom`, `adjustRegion` | Initializes WaveSurfer v7 with `RegionsPlugin` and `TimelinePlugin` using Rust peaks + Blob URL; two-way syncs draggable region with `startTime`/`endTime`; supports selection playback, looping, zoom, and ±1s / ±100ms nudges. |
| **Waveform Service** | [src/services/waveform.ts](src/services/waveform.ts) | `WaveformService.getWaveform`, `createMediaBlobUrl`, `formatSecondsToTimestamp`, `parseTimestampToSeconds` | Calls Rust `get_audio_waveform`, creates in-memory Blob URLs for playback, and converts between float seconds and `HH:MM:SS.mmm`. |
| **Rust Waveform Extractor** | [src-tauri/src/commands/audio.rs](src-tauri/src/commands/audio.rs) | `get_audio_waveform` | Decodes audio via Symphonia using streaming 256-sample micro-chunk downsampling into `target_peaks` min/max amplitude pairs. |

### 4B. Sub-tab: Metadata Editor (`metadata`)

| Layer | File | Responsible Functions / Symbols | Logic Responsibility |
| :--- | :--- | :--- | :--- |
| **Metadata UI** | [src/components/MetadataView.tsx](src/components/MetadataView.tsx) | `MetadataView`, `handleProcess` | Supports single-file or batch-folder mode, ID3 tag inputs (`title`, `artist`, `album`, `year`), progress log, and per-file `Restore original` backup action. |
| **Metadata Service** | [src/services/metadata.ts](src/services/metadata.ts) | `MetadataService.readMetadata`, `MetadataService.processMetadata`, `MetadataService.restoreBackup` | Filters supported audio extensions, creates `.metadata-backup.mp3` before writing, invokes `write_audio_tags`, and supports atomic restore from backup. |
| **Rust Tagging Engine** | [src-tauri/src/commands/audio.rs](src-tauri/src/commands/audio.rs) | `read_audio_tags`, `write_audio_tags` | Reads and writes audio metadata tags (`title`, `artist`, `album`, `year`, `track`, `genre`) using `lofty`. |

### 4C. Sub-tab: BPM Tuner (`bpm`)

| Layer | File | Responsible Functions / Symbols | Logic Responsibility |
| :--- | :--- | :--- | :--- |
| **BPM Tuner UI** | [src/components/BpmModifierView.tsx](src/components/BpmModifierView.tsx) | `BpmModifierView`, `handleDetect`, `handleManualBpmEdit`, `handleExecute` | Manages multi-file selection, genre BPM range presets, batch BPM detection, manual BPM override, target BPM validation (`20..300`), WAV/MP3 output selection, and cooperative batch cancellation. |
| **BPM Service** | [src/services/bpm.ts](src/services/bpm.ts) | `buildAtempoFilter`, `BpmService.detectBPM`, `BpmService.batchDetectBPM`, `BpmService.changeTempo`, `BpmService.batchChangeTempo` | Invokes Rust `detect_audio_bpm`; chains FFmpeg `atempo` filters within `[0.5, 2.0]` for arbitrary tempo ratios; outputs `<targetBPM>BPM_<name>.(wav|mp3)` via `.part` atomic rename. |
| **Rust BPM Detector** | [src-tauri/src/commands/audio.rs](src-tauri/src/commands/audio.rs) | `open_symphonia_decoder`, `detect_audio_bpm`, `calculate_tempo_autocorr` | Decodes up to 45s of mono audio via Symphonia, computes RMS energy envelope and onset strength, runs autocorrelation with a 120 BPM log-normal prior, and returns BPM, confidence (`high`/`medium`/`low`), and half/double octave candidates. |

---

## 5. Menu: Batch Renamer (`rename`)

| Layer | File | Responsible Functions / Symbols | Logic Responsibility |
| :--- | :--- | :--- | :--- |
| **Batch Renamer UI** | [src/components/RenameView.tsx](src/components/RenameView.tsx) | `RenameView`, `handleSelectInput`, `handleExecute`, `handleUndo` | Supports `find-replace` (with case sensitivity), `prefix-suffix`, and `numbering` (base name, start number, zero-padding); auto-regenerates live preview table; blocks execution on collisions; supports one-click undo. |
| **Rename Service** | [src/services/rename.ts](src/services/rename.ts) | `RenameService.generatePreview`, `RenameService.executeRename`, `RenameService.undoRename` | Computes new filenames, detects in-memory duplicates (`collision`) and existing-file conflicts (`exists`), executes renames via Rust `safe_rename`, and reverts in reverse order on undo. |
| **Rust Safe Rename** | [src-tauri/src/commands/system.rs](src-tauri/src/commands/system.rs) | `safe_rename` | Validates source exists as a file, destination does not exist, and canonicalized parent directories match (prevents cross-directory moves). |

---

## 6. Menu: Settings (`settings`)

| Layer | File | Responsible Functions / Symbols | Logic Responsibility |
| :--- | :--- | :--- | :--- |
| **Settings UI** | [src/components/SettingsView.tsx](src/components/SettingsView.tsx) | `SettingsView` | Configures `defaultOutputDir`, `closeToTray`, `debugMode`, `defaultVideoQuality`, `defaultVideoCodec`, `defaultAudioBitrate`, `enableConcurrentDownloads`, `maxConcurrentDownloads`, `rateLimitSpeed`, `enableKhinsider`, `enableAnimeThemes`, `browserForCookies`, `cookiesFilePath`; triggers `YtDlpService.updateYtDlp` and `clear_khinsider_cache`. |

---

## 6b. Menu: Anime Themes Downloader (`animethemes`)

| Layer | File | Responsible Functions / Symbols | Logic Responsibility |
| :--- | :--- | :--- | :--- |
| **AnimeThemes UI** | [src/components/AnimeThemesView.tsx](src/components/AnimeThemesView.tsx) | `AnimeThemesView`, `CoverImage` | Debounced search/autocomplete across anime, song, and artist names; responsive horizontal strip cards (`< lg`) & poster grid (`lg:`); `IntersectionObserver` lazy cover loading; inline `<video>` preview modal with `$TEMP` fallback; batch/single download. |
| **AnimeThemes Service** | [src/services/animethemes.ts](src/services/animethemes.ts) | `AnimeThemesService`, `buildAnimeThemeFilename` | Calls `animethemes_search`, `animethemes_suggest`, `animethemes_fetch_covers`, `animethemes_download`; formats `<Show> - <Theme> (<Res>p NC).<ext>`; transcodes WebM → H.264/H.265 MP4 with `-metadata` (`title`, `artist`, `album`, `date`). |
| **Rust AnimeThemes** | [src-tauri/src/commands/animethemes.rs](src-tauri/src/commands/animethemes.rs) | `set_animethemes_enabled`, `animethemes_search`, `animethemes_suggest`, `animethemes_fetch_covers`, `animethemes_download` | Enforces opt-in `AtomicBool`/Mutex guard; queries `rs.animethemes.moe/graphql`; batches AniList `Page.media` covers (`s4.anilist.co`); streams `.webm` from `v.animethemes.moe` with `Referer`; maps `429` `Retry-After` to `RATE_LIMIT:<seconds>`. |
| **Rate-Limit & Errors** | [src/utils/rateLimit.ts](src/utils/rateLimit.ts), [src/hooks/useRateLimitCooldown.ts](src/hooks/useRateLimitCooldown.ts), [src/components/ui/RateLimitNotice.tsx](src/components/ui/RateLimitNotice.tsx), [src/config/uiText.ts](src/config/uiText.ts) | `parseRateLimitError`, `useRateLimitCooldown`, `RateLimitNotice`, `formatFriendlyError` | Shared cooldown countdown UX across `AnimeThemesView` and `KhinsiderView`; logs raw technical errors to console (`>_`) while showing plain-English UI messages. |

---

## 7. Global Drawer: System Logs (`TerminalLogView`)

| Layer | File | Responsible Functions / Symbols | Logic Responsibility |
| :--- | :--- | :--- | :--- |
| **Terminal Drawer UI** | [src/components/TerminalLogView.tsx](src/components/TerminalLogView.tsx) | `TerminalLogView`, `handleCopyLogs` | Buffers up to 200 `toolkit-log` entries, auto-opens on `ERROR`/`error`, toggles via `toolkit-toggle-terminal`, and provides Copy/Clear actions. |

---

## 8. Rust Backend Core, System & Build Infrastructure

| File | Responsible Functions / Symbols | Logic Responsibility |
| :--- | :--- | :--- |
| [src-tauri/src/lib.rs](src-tauri/src/lib.rs) | `run` | Registers Tauri plugins (`notification`, `fs`, `dialog`, `shell`, `opener`, `single_instance`), sets up system tray (`show`, `quit`), intercepts `CloseRequested` for close-to-tray + notification, and registers all Tauri `invoke_handler` commands. |
| [src-tauri/src/state.rs](src-tauri/src/state.rs) | `AppState`, `CachedKhinsiderHtml` | Holds `close_to_tray`, `canceled_khinsider_downloads`, `khinsider_request_gate`, `khinsider_html_cache`, `khinsider_enabled`, `khinsider_download_slots`, `animethemes_enabled`, and `animethemes_cover_cache`. |
| [src-tauri/src/commands/system.rs](src-tauri/src/commands/system.rs) | `set_close_behavior`, `safe_rename`, `close_splashscreen`, `setup_ffmpeg_location` | Updates tray close behavior, performs safe same-directory rename, transitions splashscreen to main window, and provisions `ffmpeg`/`ffprobe`/`qjs` into `%TEMP%/eltoolkit_ffmpeg`. |
| [src-tauri/src/commands/updater.rs](src-tauri/src/commands/updater.rs) | `update_ytdlp` | Downloads latest `yt-dlp` binary via `curl`, validates `--version`, and performs atomic backup-and-swap. |
| [scripts/setup-sidecars.cjs](scripts/setup-sidecars.cjs) & [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) | `setup-sidecars.cjs` | Provisions target-triple-suffixed `ffmpeg`, `ffprobe`, `yt-dlp`, and `qjs` (QuickJS) sidecars before dev/build; configures Tauri windows, CSP, and `externalBin`. |
