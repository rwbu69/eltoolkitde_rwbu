# ElToolkitDeRWBU

ElToolkitDeRWBU is a cross-platform desktop utility for common media and file-management workflows. It combines a graphical interface with established command-line tools so that downloading, conversion, metadata editing, renaming, and BPM processing can be performed without using a terminal for normal tasks.

The application is built with Tauri 2, React, TypeScript, Vite, Rust, FFmpeg, yt-dlp, and Python-based BPM sidecars.

![ElToolkitDeRWBU interface](images/screen_awal.png)

## What the application does

### Downloader

The downloader uses yt-dlp and supports:

- MP4 video downloads.
- MP3 audio downloads.
- Video-only downloads.
- Resolution selection from 360p through 4K when the source provides it.
- Configurable audio bitrate.
- Multiple URLs and playlist inspection before queueing.
- Queue progress, cancellation, retry, and cleanup actions.

The requested resolution is treated as a maximum target. If that exact quality is unavailable, yt-dlp falls back to the next suitable quality.

### FFmpeg tools

The FFmpeg menu provides:

- Audio extraction and conversion to MP3.
- Media trimming by start and end time.
- Horizontal or vertical mirroring.
- Batch processing where the selected operation supports it.
- Progress tracking and cancellation.

### Metadata editor

The metadata editor writes the following ID3 fields:

- Title.
- Artist.
- Album.
- Year.

It can process one MP3 file or a folder of MP3 files.

### Batch renamer

The renamer supports:

- Find and replace.
- Case-sensitive matching.
- Prefixes and suffixes.
- Sequential numbering.
- Zero-padded numbers.
- Previewing changes before applying them.
- Collision detection.
- Undoing the last rename operation.

### BPM modifier

The BPM tool uses Python, librosa, soundfile, and FFmpeg sidecars to:

- Analyze BPM candidates.
- Resolve common half-time and double-time ambiguities.
- Display confidence information.
- Allow manual BPM correction.
- Apply a target BPM to multiple files.
- Export WAV or MP3 output.

The detector is designed to improve practical accuracy, but BPM estimation depends on the recording, genre, beat clarity, and source quality. A manual correction field is available for uncertain tracks.

### Settings

Settings include:

- Default output folder.
- Default video quality.
- Default MP3 bitrate.
- Maximum concurrent downloads.
- Download rate limiting.
- Close-to-tray behavior.
- Browser cookies or a cookies.txt file for sites that require authentication.

## Downloading a release

Open the repository's **Releases** page and choose the package that matches the operating system and processor architecture.

| Platform | Recommended release |
| --- | --- |
| Windows 64-bit | `.exe` NSIS installer |
| Linux 64-bit | `.AppImage` |
| Debian or Ubuntu 64-bit | `.deb` |
| Intel Mac | `x86_64-apple-darwin` `.dmg` |
| Apple Silicon Mac | `aarch64-apple-darwin` `.dmg` |

The macOS releases are separate Intel and Apple Silicon builds. Do not install the Intel build on Apple Silicon unless you specifically intend to use Rosetta, and do not install the Apple Silicon build on an Intel Mac.

## Trying the app on macOS without Apple Developer signing

The project is distributed as an unsigned build because Apple Developer signing and notarization require a paid Apple Developer Program membership. The application can still be used by trusted testers.

### First launch

1. Download the correct `.dmg`.
2. Open the disk image and drag `ElToolkitDeRWBU` to `Applications`.
3. Right-click the application and choose **Open**.
4. Confirm **Open** in the security dialog.

If macOS does not offer the **Open** button:

1. Open **System Settings**.
2. Go to **Privacy & Security**.
3. Scroll to the security message for the blocked application.
4. Choose **Open Anyway**.

If Gatekeeper still blocks the application, use Terminal:

```bash
xattr -dr com.apple.quarantine "/Applications/ElToolkitDeRWBU.app"
open "/Applications/ElToolkitDeRWBU.app"
```

These steps may be required again after downloading a newer unsigned release. Only bypass Gatekeeper for a release downloaded from a source you trust.

### macOS troubleshooting

If a sidecar fails to start:

1. Confirm that the release architecture matches the Mac.
2. Remove the application and copy it from the `.dmg` again.
3. Run the quarantine command above.
4. Launch the application from Finder.
5. Check the application's System Log for the failing tool.

## Trying the app on Linux

### AppImage

The AppImage is the easiest Linux package to try:

```bash
chmod +x ElToolkitDeRWBU*.AppImage
./ElToolkitDeRWBU*.AppImage
```

Some distributions may require additional WebKitGTK or desktop integration packages. The AppImage is built on Ubuntu 22.04 and is primarily intended for modern 64-bit Linux desktop systems.

### Debian or Ubuntu

Install the `.deb` package with:

```bash
sudo apt install ./ElToolkitDeRWBU*.deb
```

If the package reports missing dependencies, install the dependencies suggested by your distribution and retry the command.

## Development setup

### Requirements

For frontend development:

- Node.js 24.
- npm.

For Tauri development:

- Rust stable.
- Platform build tools required by Tauri.
- FFmpeg and related sidecars prepared by the setup script.

For BPM sidecar development:

- Python 3.11 or a compatible Python 3 release.
- PyInstaller.
- librosa.
- soundfile.

### Install dependencies

```bash
npm ci
```

### Run the web interface

```bash
npm run vite:dev
```

### Run the desktop application

```bash
npm run dev
```

The Tauri development command prepares host-specific FFmpeg, FFprobe, Node, and yt-dlp sidecars before starting the application.

### Build locally

```bash
npm run vite:build
npm run build
```

The desktop build uses the sidecar target for the current host. Release builds should be produced on the matching native GitHub Actions runner rather than by copying binaries from Windows to another operating system.

### Validation commands

```bash
npm run lint
npm test -- --run
cargo check --manifest-path src-tauri/Cargo.toml
```

## Cross-platform release process

The GitHub Actions workflow in `.github/workflows/tauri-build.yml` builds each platform on a native runner:

- Windows x64 on `windows-latest`.
- Linux x64 on `ubuntu-22.04`.
- Intel macOS on `macos-13`.
- Apple Silicon macOS on `macos-14`.

Each runner creates sidecars for its exact Rust target. The workflow verifies that all required sidecars exist before packaging:

- FFmpeg.
- FFprobe.
- yt-dlp.
- Node.
- BPM detector.
- BPM modifier.

This is important because renaming an executable does not change its architecture. The release workflow therefore does not create fake universal macOS binaries.

Pushing to the configured release branch or manually starting the workflow creates the platform release artifacts. The workflow uses `npm ci` so the frontend dependency versions come from the lockfile.

## Architecture and packaging limitations

The current release targets are:

- Windows x64.
- Linux x64 using GNU libc.
- macOS Intel x64.
- macOS Apple Silicon arm64.

ARM Linux and a true universal macOS package are not currently release targets. They can be added later, but every native sidecar would need a compatible build for that architecture.

macOS releases are unsigned and unnotarized. Linux packages are built on Ubuntu 22.04 and may require distribution-specific system libraries. These are packaging limitations, not application features.

## Security and privacy notes

- URLs are passed to yt-dlp for processing.
- Browser cookies and cookies.txt files should only be used when necessary and should be treated as sensitive.
- The app includes powerful file and process operations; verify input and output paths before starting a batch job.
- Downloaded media must be used in accordance with the source site's terms and applicable law.

## Project structure

```text
src/                 React and TypeScript interface
src/services/        FFmpeg, yt-dlp, metadata, rename, and BPM bridges
src/components/      Application menus and shared UI components
src/config/          Shared media and UI configuration
src-python/          BPM detector and modifier sidecars
src-tauri/           Rust host, capabilities, icons, and packaged sidecars
scripts/             Host and target-specific sidecar preparation
.github/workflows/   Cross-platform release automation
```

## License

No license file is currently included in the repository. Treat the project as all rights reserved unless a license is added by the repository owner.
