import { X, type LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface ActionFooterProps {
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  actionIcon?: LucideIcon;
  onCancel?: () => void;
  cancelLabel?: string;
}

export function ActionFooter({
  actionLabel,
  onAction,
  disabled = false,
  loading = false,
  loadingLabel = 'Processing...',
  actionIcon,
  onCancel,
  cancelLabel = 'Cancel',
}: ActionFooterProps) {
  return (
    <div className="flex gap-2 border-t-4 border-appbg pt-3 mt-3 shrink-0">
      {onCancel && (
        <Button onClick={onCancel} variant="danger" icon={X} className="w-1/3">
          {cancelLabel}
        </Button>
      )}
      <Button
        onClick={onAction}
        variant="primary"
        disabled={disabled || loading}
        icon={actionIcon}
        className={onCancel ? 'w-2/3' : 'w-full'}
      >
        {loading ? loadingLabel : actionLabel}
      </Button>
    </div>
  );
}
