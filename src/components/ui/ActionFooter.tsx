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
  className?: string;
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
  className = '',
}: ActionFooterProps) {
  return (
    <div className={`flex gap-2 w-full ${className}`}>
      {onCancel && (
        <Button onClick={onCancel} variant="danger" size="lg" icon={X} className="w-1/3">
          {cancelLabel}
        </Button>
      )}
      <Button
        onClick={onAction}
        variant="primary"
        size="lg"
        disabled={disabled || loading}
        icon={actionIcon}
        className={onCancel ? 'w-2/3' : 'w-full'}
      >
        {loading ? loadingLabel : actionLabel}
      </Button>
    </div>
  );
}
