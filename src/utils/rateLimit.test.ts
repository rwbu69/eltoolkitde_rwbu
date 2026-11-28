import { describe, expect, it } from 'vitest';
import { parseRateLimitError } from './rateLimit';
import { formatFriendlyError } from '../config/uiText';

describe('rateLimit & friendly errors', () => {
  it('parses RATE_LIMIT:<seconds> and HTTP 429 strings', () => {
    expect(parseRateLimitError('RATE_LIMIT:45')).toEqual({
      isRateLimit: true,
      retryAfterSeconds: 45,
    });
    expect(parseRateLimitError(new Error('Khinsider returned HTTP 429.'))).toEqual({
      isRateLimit: true,
      retryAfterSeconds: 60,
    });
    expect(parseRateLimitError('AnimeThemes returned HTTP 503')).toEqual({
      isRateLimit: false,
      retryAfterSeconds: 0,
    });
  });

  it('maps technical errors to plain-English messages', () => {
    expect(formatFriendlyError('error sending request for url (https://example.com)')).toContain(
      'Check your internet connection'
    );
    expect(formatFriendlyError('AnimeThemes returned HTTP 503')).toContain('temporarily unavailable');
    expect(formatFriendlyError('RATE_LIMIT:30')).toContain('Too many requests');
  });
});
