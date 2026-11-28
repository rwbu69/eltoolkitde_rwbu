import { describe, expect, it } from 'vitest';
import { buildAnimeThemeFilename, sanitizeAnimeFilenamePart } from './animethemes';

describe('animethemes filename helpers', () => {
  it('sanitizes invalid filesystem characters cleanly', () => {
    expect(sanitizeAnimeFilenamePart('Re:Zero / Starting: Life?*')).toBe('Re Zero Starting Life');
  });

  it('formats show title, theme slug, version, resolution, and NC tag', () => {
    expect(
      buildAnimeThemeFilename({
        showTitle: 'Bocchi the Rock!',
        themeSlug: 'OP1',
        resolution: 1080,
        nc: true,
        format: 'h264',
      })
    ).toBe('Bocchi the Rock! - OP1 (1080p NC).mp4');

    expect(
      buildAnimeThemeFilename({
        showTitle: 'Frieren: Beyond Journey\'s End',
        themeSlug: 'ED2',
        version: 2,
        resolution: 720,
        nc: false,
        format: 'webm',
      })
    ).toBe("Frieren Beyond Journey's End - ED2 v2 (720p).webm");
  });
});
