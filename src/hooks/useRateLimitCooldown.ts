import { useCallback, useEffect, useState } from 'react';
import { formatFriendlyError } from '../config/uiText';
import { parseRateLimitError } from '../utils/rateLimit';

export function useRateLimitCooldown() {
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleError = useCallback((error: unknown, fallback?: string): string | null => {
    const info = parseRateLimitError(error);
    if (info.isRateLimit) {
      setCooldownSeconds((prev) => Math.max(prev, info.retryAfterSeconds));
      return null;
    }
    return formatFriendlyError(error, fallback);
  }, []);

  const resetCooldown = useCallback(() => {
    setCooldownSeconds(0);
  }, []);

  return {
    cooldownSeconds,
    isRateLimited: cooldownSeconds > 0,
    handleError,
    resetCooldown,
  };
}
