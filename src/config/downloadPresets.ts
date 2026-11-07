import type { AudioBitrate, VideoQuality } from './mediaSettings';

export type DownloadPresetId = 'mp3-high' | 'mp4-1080p' | 'video-1080p';

export interface DownloadPreset {
  id: DownloadPresetId;
  label: string;
  format: 'mp4' | 'mp3' | 'video-only';
  videoQuality?: VideoQuality;
  audioBitrate?: AudioBitrate;
}

export const DOWNLOAD_PRESETS: DownloadPreset[] = [
  { id: 'mp3-high', label: 'MP3 · 320 kbps', format: 'mp3', audioBitrate: '320k' },
  { id: 'mp4-1080p', label: 'MP4 · 1080p', format: 'mp4', videoQuality: '1080p' },
  { id: 'video-1080p', label: 'Video only · 1080p', format: 'video-only', videoQuality: '1080p' },
];
