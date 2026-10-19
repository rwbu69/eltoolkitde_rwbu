import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export function EmptyState({ title, description, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-ink opacity-50">
      <Icon className="w-7 h-7 text-muted" aria-hidden="true" />
      <span className="font-zen font-bold text-lg">{title}</span>
      <span className="font-mono text-xs text-muted">{description}</span>
    </div>
  );
}
