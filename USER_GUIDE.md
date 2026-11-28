# ElToolkitDeRWBU — User Guide

> _"Everything lives inside one window—no terminal flags required. Here is where every button hides and how to get around."_

---

## 1. Navigating the Interface

### Left Navigation Rail (Desktop) & Bottom Dock (Compact Window)
From top to bottom on the left rail (or left to right on the bottom dock):

1. **Downloader (`Media Downloader`)** — Paste video/audio URLs, pick format & resolution, and watch downloads in the Active Queue.
2. **Game Music (`Khinsider`)** — *Hidden by default.* Enable it under **Settings → Game music (Khinsider)** to make this icon appear.
3. **Audio Studio** — Houses three audio tools in its top switcher:
   - **Converter & Trim**
   - **Metadata Editor**
   - **BPM Tuner**
4. **Batch Renamer** — Preview and apply bulk filename edits in a folder with one-click undo.
5. **Settings** (bottom of the left rail) — Defaults, video codec mode, concurrency, `yt-dlp` updates, Khinsider toggle, and cookies.

### Top Status HUD (Top-Right Corner)
- **Cookies / Public Mode pill**: Shows `Public Mode` or `Cookies Attached`. Clicking it jumps straight to **Settings** so you can attach or clear cookies.
- **Theme toggle (Sun / Moon)**: Switches instantly between **Catppuccin Latte** (Light) and **Catppuccin Mocha** (Dark).
- **System Logs (`>_`)**: Opens or closes the bottom **System Logs** drawer to inspect live `yt-dlp`, `FFmpeg`, and audio engine output.
  - A pulsing red dot on the icon means an error was logged (and the drawer auto-opens on errors).
  - Use **Copy** or **Clear** in the drawer header to grab logs for bug reports.

### Window Shortcuts & System Tray
- **Drag-and-Drop**: Drag media files or folders directly onto the window while **Audio Studio** or **Batch Renamer** is open to load them immediately.
- **Minimize to Tray**: By default, closing the window minimizes ElToolkitDeRWBU to the system tray (configurable in **Settings**). Left-click the tray icon to bring the window back, or right-click → **Keluar** to quit completely.

---

## 2. Media Downloader

1. **Paste links**: Paste one or more URLs (YouTube, TikTok, X/Twitter, Twitch, etc.) into **Media URL(s)**, separated by spaces or new lines. Duplicate links are stripped automatically.
2. **Choose Format & Quality**:
   - **MP4**: Video + Audio merged into `.mp4` with embedded thumbnail and metadata.
   - **MP3**: Audio extracted and tagged (`Artist - Title.mp3`) using your configured bitrate (`320k` / `256k` / `192k`).
   - **Video only**: Video stream saved as `<Title>-VIDEO.mp4` with no audio.
   - **Video resolution**: Choose from `4K (2160p)`, `1440p`, `1080p`, `720p`, `480p`, or `360p`.
3. **Select Output folder**: Pick where files are saved (also updates your default output folder).
4. **Click `Check links`**:
   - Single links start queueing immediately.
   - Multiple links, playlists, or batches over 10 items show a **Review download job** confirmation box first (up to 500 items per batch).
5. **Track Progress in the Active Queue (Right Panel)**:
   - Each card displays its thumbnail (when available), status, speed, progress bar, ETA, and expandable **Details**.
   - Use **Filter** (`All items`, `Active`, `Completed`, `Failed`) to narrow the list.
   - Cancel, retry, or remove individual items using the button on the right of each card, or use **Cancel active**, **Retry failed**, **Clear finished**, and **Clear issues** at the top.
   - If YouTube throttles requests (`429`), the queue pauses automatically with a **Queue Paused** banner—wait a few minutes or attach cookies in Settings, then click **Resume**.

> **Codec Tip (Resolume / Editors):** By default, **Settings → Default video codec** uses **`H.264 / H.265 (No AV1/VP9 — Fastest)`**. That keeps native H.264/H.265 streams untouched (`0s` re-encode) while automatically converting AV1/VP9 streams (like 1440p/4K) to H.264 using GPU hardware acceleration when available.

---

## 3. Game Music Browser (Khinsider)

1. **Enable the tab**: Open **Settings → Game music (Khinsider)** and check **Enable Game Music navigation**.
2. **Find a soundtrack**: Type a game, album, or artist into the search bar, or click any **Category** button.
3. **Download tracks**:
   - Click an album card to view its tracklist (links resolve automatically with polite pacing).
   - Confirm your download **Folder** at the top of the album view.
   - Click **MP3** or **FLAC** on a single track (click **X** while downloading to cancel), **OR** check multiple tracks and use **Download selected (N)**, **OR** click **Download all (MP3 / FLAC)**.
   - Tracks are saved inside an album subfolder with track numbering (`01 - Track Title.mp3`).

---

## 3b. Anime Themes Downloader

1. **Enable the tab**: Open **Settings → Game music (Khinsider)** section and check **Enable Anime Themes Downloader**.
2. **Search**: Type an anime title (Romaji or English), song name, or artist name—or pick a match from the autocomplete dropdown.
3. **Preview & Download**:
   - Click an anime card to view all OP/ED/Insert themes with resolution (`1080p`), creditless (`NC`), and `Subbed` badges.
   - Click **Preview** to watch the theme inline before downloading.
   - Choose your output format (**H.264 MP4**, **H.265 / HEVC MP4**, or **Original WebM**) and **Output folder**, then click **Download** (or select multiple themes).
   - Converted MP4 files are named `<Show Title> - <Theme> (<Res>p NC).mp4` with song **Title**, **Contributing Artist**, **Album**, and **Year** tags embedded.

---

## 4. Audio Studio

Switch between the three tools using the top deck inside **Audio Studio**:

### A. Converter & Trim
- **To MP3**: Click **Select file(s)**, **Batch (folder)**, or drag-and-drop media files, pick your **Output folder**, and click **Process**. Outputs save to `<Output folder>/output_mp3/*.mp3` (existing files are skipped).
- **Trim**: Select a single audio or video file to load the **Waveform Cutter** (and synced `<video>` preview for video files):
  - Drag or resize the pink selection region on the waveform, or fine-tune with **Start / End** `±1s` / `±100ms` buttons and `HH:MM:SS` text boxes.
  - Preview with **Play Selection**, **Full**, **Stop**, **Loop**, and the **Zoom** slider.
  - Leave **Frame-accurate cut** unchecked for instant lossless `-c copy` trimming, or check it for exact frame-accurate H.264/AAC cuts.
- **To GIF**: Pick **Frame rate** (`10`, `15`, or `24 fps`), **Width** (`480 px`, `720 px`, or `Original`), and optionally enable **Clip range (Start / End)** to convert video clips to high-quality `.gif` files (`palettegen` + `paletteuse`).
- **Mirror**: Flips video left-to-right horizontally (`<Name>-MIRROR.<ext>`) with live percentage progress.

### B. Metadata Editor
1. Choose **Single file** (`.mp3`, `.flac`, `.m4a`, `.ogg`, `.wav`, `.opus`, `.aac`) or **Batch folder**.
2. When you pick a single file, its existing **Title**, **Artist**, **Album**, and **Year** tags load automatically.
3. Edit the fields you want to change and click **Apply metadata**.
4. Before modifying any file, a backup (`<Name>.metadata-backup.<ext>`) is created automatically. Click **Restore original** next to any file in the **Metadata Log** to revert it.

### C. BPM Tuner
1. **Detect tempo**: Add audio files (or drag-and-drop), optionally pick an **Expected genre range** (`Any`, `70–150`, `90–180`, `120–200`) to avoid half-time/double-time confusion, and click **Detect BPM**.
2. **Review or edit**: Low/medium confidence results show a warning icon; click the detected BPM number on any card to adjust it manually.
3. **Adjust tempo**: Enter a **Target BPM** (`20–300`), pick **WAV (Lossless)** or **MP3 (Compressed)**, verify **Output folder**, and click **Apply target BPM** (`<targetBPM>BPM_<Name>.<ext>`).

---

## 5. Batch Renamer

1. Select a **Target folder** (or drag-and-drop a folder onto the window).
2. Pick a **Rename mode**:
   - **Find & replace**: Replace matching text (with optional **Match case** toggle).
   - **Affixes**: Add a **Prefix** and/or **Suffix** around each filename stem while keeping extensions intact.
   - **Numbering**: Rename files sequentially using an optional **Base name**, **Start number**, and **Padding digits** (e.g., `Track_001`).
3. **Review the live preview table**:
   - Every row shows its status: green checkmark (`OK`), `Collision` (duplicate target name), `Exists` (already on disk), or `Invalid` (empty stem or illegal characters). **Apply** remains disabled until conflicts are fixed.
4. Click **Apply to N files**. To revert the last batch, click **Undo last rename** in the bottom footer.

---

## 6. Settings

- **General defaults & output**: Set your default output folder, toggle **Minimize to system tray on close**, and toggle **Enable debug console logging** (sends API, FFmpeg, and preview diagnostics to the `>_` System Logs drawer).
- **Media quality presets**:
  - **Default video resolution**: `4K (2160p)` down to `360p`.
  - **Default video codec**:
    - `H.264 / H.265 (No AV1/VP9 — Fastest)` *(default)*
    - `H.264 / AVC (Always H.264 — Resolume Safe)`
    - `H.265 / HEVC (Always H.265 — Smaller Files)`
  - **Default audio bitrate (MP3)**: `320k`, `256k`, or `192k`.
- **Download & network behavior**:
  - Toggle **Enable parallel downloads** and set **Max concurrent downloads** (`1–10`; keeping `2–3` helps avoid host rate limits).
  - Set an optional **Speed limit throttle** (e.g., `5M` or `500K`).
  - Click **Check for yt-dlp update** to download and validate the latest `yt-dlp` binary cleanly.
- **Game music (Khinsider) & Anime Themes Downloader**: Show/hide the Khinsider and Anime Themes Downloader navigation tabs and clear cached Khinsider pages.
- **Authentication & cookies**: Read session cookies from an installed browser (`Chrome`, `Firefox`, `Edge`, `Brave`, `Safari`, `Opera`) or attach a Netscape `cookies.txt` file for restricted/member streams.
