export interface RateLimitInfo {
  isRateLimit: boolean;
  retryAfterSeconds: number;
}

export function parseRateLimitError(error: unknown): RateLimitInfo {
  const raw = error instanceof Error ? error.message : String(error ?? '');

  const taggedMatch = raw.match(/RATE_LIMIT:(\d+)/i);
  if (taggedMatch) {
    const secs = Math.max(1, parseInt(taggedMatch[1], 10) || 60);
    return { isRateLimit: true, retryAfterSeconds: secs };
  }

  if (/429|rate.?limit|too many requests/i.test(raw)) {
    const retryMatch = raw.match(/retry[- ]after[:\s]+(\d+)/i);
    const secs = retryMatch ? Math.max(1, parseInt(retryMatch[1], 10) || 60) : 60;
    return { isRateLimit: true, retryAfterSeconds: secs };
  }

  return { isRateLimit: false, retryAfterSeconds: 0 };
}
