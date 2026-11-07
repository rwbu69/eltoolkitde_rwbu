const RATE_LIMIT_PATTERN = /^\d+(?:\.\d+)?[KMG]?$/i;

export function normalizeConcurrency(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.min(10, Math.max(1, Math.trunc(value)));
}

export function normalizeRateLimit(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' || RATE_LIMIT_PATTERN.test(trimmed) ? trimmed : '';
}

export function isValidMediaUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
