import { describe, expect, it } from 'vitest';
import { DOWNLOAD_PRESETS } from './downloadPresets';

describe('download presets', () => {
  it('contains the supported common workflows', () => {
    expect(DOWNLOAD_PRESETS.map(preset => preset.id)).toEqual([
      'mp3-high',
      'mp4-1080p',
      'video-1080p',
    ]);
  });

  it('defines compatible output settings', () => {
    expect(DOWNLOAD_PRESETS[0]).toMatchObject({ format: 'mp3', audioBitrate: '320k' });
    expect(DOWNLOAD_PRESETS[1]).toMatchObject({ format: 'mp4', videoQuality: '1080p' });
    expect(DOWNLOAD_PRESETS[2]).toMatchObject({ format: 'video-only', videoQuality: '1080p' });
  });
});
