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
