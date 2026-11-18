import React from 'react';
import { CheckCircle2, Circle, Clock, X, Trash2 } from 'lucide-react';
import { ProgressBar } from './ProgressBar';
import { getStatusLabel } from '../../config/uiText';

export interface BatchProgressItemProps {
  title: string;
  status: string;
  percent?: number;
  log?: string;
  onRemove?: () => void;
  extraBadge?: React.ReactNode;
  children?: React.ReactNode;
}

export const BatchProgressItem = React.memo(function BatchProgressItem({
  title,
  status,
  percent,
  log,
  onRemove,
  extraBadge,
  children
}: BatchProgressItemProps) {
  let statusIcon = <Circle className="w-4 h-4 text-muted shrink-0" />;
  let cardClass = 'bg-panel border-muted';
  let tagClass = 'bg-panel text-muted';

  if (status === 'done') {
    statusIcon = <CheckCircle2 className="w-4 h-4 text-toska shrink-0" />;
    cardClass = 'bg-softtoska border-gameborder';
    tagClass = 'bg-toska text-white dark:text-buttontext';
  } else if (status === 'error') {
    statusIcon = <X className="w-4 h-4 text-oshipink shrink-0" />;
    cardClass = 'bg-softpink border-oshipink';
    tagClass = 'bg-oshipink text-buttontext';
  } else if (status === 'processing' || status === 'detecting' || status === 'modifying') {
    statusIcon = <Clock className="w-4 h-4 text-ink animate-spin-slow shrink-0" />;
    cardClass = 'bg-panel border-gameborder shadow-game-thin';
    tagClass = 'bg-gameborder text-white';
  } else if (status === 'skipped' || status === 'canceled') {
    statusIcon = <Circle className="w-4 h-4 text-muted shrink-0" />;
    cardClass = 'bg-appbg border-muted';
    tagClass = 'bg-muted text-white dark:text-buttontext';
  }

  return (
    <div className={`flex flex-col gap-2 border-2 p-3 rounded-xl transition-all shrink-0 ${cardClass}`}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex gap-2 items-start overflow-hidden flex-1 min-w-0">
          <div className="mt-0.5">{statusIcon}</div>
          <span className="text-ink font-mono font-bold text-xs truncate leading-tight flex-1" title={title}>
            {title}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 shrink-0">
          {extraBadge}
          <span className={`px-2 py-0.5 border-2 border-gameborder rounded-full font-mono text-[10px] font-black tracking-widest whitespace-nowrap leading-none ${tagClass}`}>
            {getStatusLabel(status)}
          </span>
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1 hover:text-oshipink text-muted transition-colors rounded hover:bg-black/10"
              title="Remove file"
              aria-label="Remove file"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {(status === 'processing' || status === 'detecting' || status === 'modifying') && percent !== undefined && (
        <ProgressBar percent={percent} status="processing" />
      )}

      {log && (
        <p className="text-[10px] font-mono opacity-60 truncate">{log}</p>
      )}

      {children}
    </div>
  );
});
