import { InlineNotice } from './InlineNotice';

interface RateLimitNoticeProps {
  source: string;
  seconds: number;
}

export function RateLimitNotice({ source, seconds }: RateLimitNoticeProps) {
  if (seconds <= 0) return null;
  return (
    <InlineNotice
      tone="warning"
      message={`${source} rate limit reached.`}
      detail={`Please wait ${seconds}s before trying again.`}
    />
  );
}
