import { describe, expect, it } from 'vitest';
import { isValidMediaUrl, normalizeConcurrency, normalizeRateLimit } from './validation';

describe('validation helpers', () => {
  it('accepts only HTTP media URLs', () => {
    expect(isValidMediaUrl('https://example.com/video')).toBe(true);
    expect(isValidMediaUrl('file:///tmp/video.mp4')).toBe(false);
    expect(isValidMediaUrl('not a url')).toBe(false);
  });

  it('clamps concurrent downloads to the supported range', () => {
    expect(normalizeConcurrency(0)).toBe(1);
    expect(normalizeConcurrency(4.9)).toBe(4);
    expect(normalizeConcurrency(99)).toBe(10);
  });

  it('accepts yt-dlp rate limit formats and clears invalid values', () => {
    expect(normalizeRateLimit(' 5M ')).toBe('5M');
    expect(normalizeRateLimit('500K')).toBe('500K');
    expect(normalizeRateLimit('fast')).toBe('');
  });
});
