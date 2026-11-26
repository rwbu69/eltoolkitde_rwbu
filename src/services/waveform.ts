import { invoke } from '@tauri-apps/api/core';
import { readFile, stat } from '@tauri-apps/plugin-fs';

const MAX_BLOB_PREVIEW_BYTES = 250 * 1024 * 1024;

export interface WaveformData {
  peaks: number[];
  duration_seconds: number;
}

export const WaveformService = {
  /**
   * Invokes the high-speed Rust Symphonia peak extractor.
   * Returns min/max peak amplitude pairs downsampled to ~targetPeaks (default 800).
   */
  async getWaveform(filePath: string, targetPeaks = 800): Promise<WaveformData> {
    return invoke<WaveformData>('get_audio_waveform', {
      path: filePath,
      targetPeaks,
    });
  },

  /**
   * Creates an in-memory blob URL for the local media file so WaveSurfer can preview audio playback.
   */
  async createMediaBlobUrl(filePath: string): Promise<string | null> {
    try {
      const info = await stat(filePath);
      if (info.size > MAX_BLOB_PREVIEW_BYTES) {
        return null;
      }
    } catch {
      // Proceed if stat is unavailable in test/mock environments
    }
    const bytes = await readFile(filePath);
    const ext = filePath.split('.').pop()?.toLowerCase() || '';

    let mimeType = 'audio/mpeg';
    if (ext === 'wav') mimeType = 'audio/wav';
    else if (ext === 'flac') mimeType = 'audio/flac';
    else if (ext === 'm4a' || ext === 'aac') mimeType = 'audio/mp4';
    else if (ext === 'ogg') mimeType = 'audio/ogg';
    else if (ext === 'webm') mimeType = 'audio/webm';
    else if (ext === 'mp4') mimeType = 'video/mp4';

    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  },

  /**
   * Converts float seconds (e.g. 75.32) to HH:MM:SS.mmm format.
   */
  formatSecondsToTimestamp(totalSeconds: number, includeMillis = true): string {
    if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const millis = Math.floor((totalSeconds % 1) * 1000);

    const pad = (n: number, z = 2) => String(n).padStart(z, '0');

    if (includeMillis) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  },

  /**
   * Parses timecode string ("00:01:15", "01:15", "00:01:15.500") into float seconds.
   */
  parseTimestampToSeconds(timestamp: string): number {
    if (!timestamp) return 0;
    const parts = timestamp.trim().split(':');
    if (parts.length === 3) {
      const h = parseFloat(parts[0]) || 0;
      const m = parseFloat(parts[1]) || 0;
      const s = parseFloat(parts[2]) || 0;
      return h * 3600 + m * 60 + s;
    } else if (parts.length === 2) {
      const m = parseFloat(parts[0]) || 0;
      const s = parseFloat(parts[1]) || 0;
      return m * 60 + s;
    } else if (parts.length === 1) {
      return parseFloat(parts[0]) || 0;
    }
    return 0;
  }
};
