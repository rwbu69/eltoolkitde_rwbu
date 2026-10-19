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
