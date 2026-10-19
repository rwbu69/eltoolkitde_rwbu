# Legacy Removal and Downloader/BPM Solutions

## Legacy code removal

The obsolete PowerShell and Express implementations under `legacy/` were removed. The supported application is now the Tauri + React implementation under `src/` and `src-tauri/`.

This removes duplicate downloader, FFmpeg, metadata, and UI behavior that could otherwise drift from the current application.

## Downloader cancellation

### Problem

Playlist URLs were expanded into independent queue items without a batch identity. A user could cancel one item, but could not reliably stop the entire playlist expansion or all pending downloads.

### Solution

- Added a **CANCEL ALL** queue action.
- Added a download-generation token in the Zustand store.
- Cancelling all:
  - kills active yt-dlp processes,
  - marks pending and active queue items as canceled,
  - prevents queued tasks from starting,
  - stops playlist expansion when cancellation occurs.
- Playlist parents now remain visible as completed expansion records instead of disappearing.
- Individual cancellation remains available.
- Canceled items are visually distinct from failed items and can be cleared.

### Trade-offs

- `CANCEL ALL` cancels every active/pending downloader operation, not only one playlist.
- A process that is between startup and child-process assignment may finish its startup handshake before the cancellation reaches it.
- Playlist children are still separate queue items, which keeps progress and retry behavior simple.

## BPM accuracy and robustness

### Problem

The previous modifier detected local beats and stretched each beat segment independently. This could introduce discontinuities, ignore the manually detected original BPM, and write WAV data to paths that could have non-WAV extensions.

### Solution

- BPM detection now:
  - uses stable positive tempo candidates,
  - treats “Any” as genuinely unconstrained,
  - validates explicit ranges,
  - fails clearly when no reliable tempo is found.
- BPM modification now:
  - uses the detected or manually corrected original BPM,
  - calculates `target / original` tempo ratio,
  - applies one pitch-preserving librosa time-stretch operation,
  - validates target BPM between 20 and 300,
  - writes an explicitly named `.wav` output.
- The sidecar receives `--original-bpm` so manual corrections affect the output.

### Trade-offs

- WAV output is larger than compressed MP3 output.
- The transform is more predictable than beat-by-beat warping, but it does not quantize individual beat drift to a rigid grid.
- Audio quality still depends on librosa’s time-stretch algorithm and the quality of the BPM estimate.
- Very complex material with tempo changes may need a future specialized beat-grid workflow.

## Validation

- Frontend production build: passed.
- Focused service tests: passed.
- Rust type check: passed.
- Lint: passed with existing non-blocking warnings.
