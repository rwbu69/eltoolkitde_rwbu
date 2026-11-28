import { dispatchDebug } from '../utils/toolkitEvents';

export type OperationStatus =
  | 'pending'
  | 'fetching'
  | 'downloading'
  | 'detecting'
  | 'processing'
  | 'done'
  | 'error'
  | 'canceled'
  | 'skipped'
  | 'expanded';

const statusLabels: Record<OperationStatus, string> = {
  pending: 'Waiting',
  fetching: 'Checking',
  downloading: 'Downloading',
  detecting: 'Analyzing',
  processing: 'Processing',
  done: 'Completed',
  error: 'Failed',
  canceled: 'Canceled',
  skipped: 'Skipped',
  expanded: 'Added from playlist',
};

export function getStatusLabel(status: string): string {
  return statusLabels[status as OperationStatus] ?? status.replace(/[-_]/g, ' ');
}

export function getUserFacingError(error: unknown, fallback: string): { message: string; detail?: string } {
  const detail = error instanceof Error ? error.message : String(error);
  return {
    message: fallback,
    detail: detail && detail !== fallback ? detail : undefined,
  };
}

export interface FriendlyError {
  message: string;
  detail?: string;
  isRateLimit?: boolean;
  needsCookies?: boolean;
}

export function parseYtDlpError(error: unknown, fallback = 'Operation failed'): FriendlyError {
  const raw = error instanceof Error ? error.message : String(error);

  if (/rate-limited|429|This content isn't available, try again later/i.test(raw)) {
    return {
      message: 'YouTube Rate Limit Detected',
      detail: 'YouTube is temporarily throttling requests from your IP. Wait 15–30 minutes, or attach a cookies file in Settings to bypass.',
      isRateLimit: true,
      needsCookies: true,
    };
  }

  if (/Private video|Sign in if you've been granted access|members-only/i.test(raw)) {
    return {
      message: 'Authentication Required',
      detail: 'This video or playlist requires sign-in. Attach your browser cookies file in Settings to proceed.',
      needsCookies: true,
    };
  }

  if (/getaddrinfo failed|Failed to resolve|Unable to download webpage/i.test(raw)) {
    return {
      message: 'Network Connection Failed',
      detail: 'Unable to reach the media servers. Please check your internet connection.',
    };
  }

  return {
    message: fallback,
    detail: raw && raw !== fallback ? raw : undefined,
  };
}

export function formatFriendlyError(
  error: unknown,
  fallback = 'Something went wrong. Check System Logs (>_ ) for details.'
): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (raw) {
    dispatchDebug('error', raw);
    console.error('[ElToolkit Error]', raw);
  }

  if (/^RATE_LIMIT:\d+|rate-limit|429|Too Many Requests/i.test(raw)) {
    return 'Too many requests. Please wait a moment before trying again.';
  }
  if (/timed out|error sending request|getaddrinfo|Failed to resolve|Connection refused|Failed to fetch|network/i.test(raw)) {
    return 'Could not reach the server. Check your internet connection and try again.';
  }
  if (/HTTP 5\d\d|Service Unavailable|Bad Gateway|Gateway Timeout/i.test(raw)) {
    return 'The service is temporarily unavailable. Please try again shortly.';
  }
  if (/HTTP 403|Access is denied|PermissionDenied|blocking automated requests/i.test(raw)) {
    return 'Access was blocked or denied. Check permissions or try again later.';
  }
  if (/os error 32|NotFound|No such file|ENOENT/i.test(raw)) {
    return 'A required file is missing or currently open in another program.';
  }
  if (/Exit code|Failed to spawn/i.test(raw)) {
    return 'Media processing failed. Check System Logs (>_ ) for details.';
  }

  return fallback;
}
