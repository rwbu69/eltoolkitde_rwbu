export const VIDEO_QUALITY_OPTIONS = [
  { value: '4k', label: '4K (2160p)' },
  { value: '1440p', label: '1440p' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
  { value: '360p', label: '360p' },
] as const;

export const AUDIO_BITRATE_OPTIONS = [
  { value: '320k', label: '320 kbps (High)' },
  { value: '256k', label: '256 kbps (Standard)' },
  { value: '192k', label: '192 kbps (Good)' },
] as const;

export type VideoQuality = typeof VIDEO_QUALITY_OPTIONS[number]['value'];
export type AudioBitrate = typeof AUDIO_BITRATE_OPTIONS[number]['value'];
