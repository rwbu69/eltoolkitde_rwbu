import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, X, RotateCcw, Trash2 } from 'lucide-react';
import type { QueueItem } from '../../store/useAppStore';
import { getStatusLabel } from '../../config/uiText';
import { ProgressBar } from '../ui/ProgressBar';

interface QueueItemCardProps {
  item: QueueItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

export const QueueItemCard = React.memo(function QueueItemCard({
  item,
  onCancel,
  onRetry,
  onRemove
}: QueueItemCardProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [item.thumbnail]);

  let statusIcon = <Circle className="w-4 h-4 text-muted" />;
  let statusText = getStatusLabel('pending');
  let cardClass = 'bg-panel border-muted opacity-60';
  let textClass = 'text-muted';
  
  if (item.status === 'done') {
    statusIcon = <CheckCircle2 className="w-4 h-4 text-white dark:text-buttontext" />;
    statusText = getStatusLabel('done');
    cardClass = 'bg-toska border-gameborder text-white dark:text-buttontext opacity-100';
    textClass = 'text-white dark:text-buttontext';
  } else if (item.status === 'expanded') {
    statusIcon = <CheckCircle2 className="w-4 h-4 text-white dark:text-buttontext" />;
    statusText = getStatusLabel('expanded');
    cardClass = 'bg-toska border-gameborder text-white dark:text-buttontext opacity-100';
    textClass = 'text-white dark:text-buttontext';
  } else if (item.status === 'downloading' || item.status === 'fetching' || item.status === 'processing') {
    statusIcon = <Clock className="w-4 h-4 text-ink" />;
    statusText = item.status === 'processing' ? 'Transcoding' : getStatusLabel(item.status);
    cardClass = 'bg-softtoska border-gameborder opacity-100 shadow-game-thin';
    textClass = 'text-ink';
  } else if (item.status === 'error') {
    statusIcon = <X className="w-4 h-4 text-buttontext" />;
    statusText = getStatusLabel('error');
    cardClass = 'bg-oshipink border-gameborder text-buttontext opacity-100';
    textClass = 'text-buttontext';
  } else if (item.status === 'canceled') {
    statusIcon = <X className="w-4 h-4 text-muted" />;
    statusText = getStatusLabel('canceled');
    cardClass = 'bg-panel border-muted opacity-100';
    textClass = 'text-muted';
  }

  const isBusy = item.status === 'downloading' || item.status === 'fetching' || item.status === 'processing' || item.status === 'pending';
  const isFailed = item.status === 'error' || item.status === 'canceled';

  return (
    <div className={`flex flex-col p-3 border-2 rounded-xl transition-all ${cardClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {item.thumbnail && !imgError ? (
            <div className="relative w-14 h-9 rounded-lg overflow-hidden border border-black/20 dark:border-white/15 bg-panel shrink-0">
              <img
                src={item.thumbnail}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="shrink-0 mt-0.5">{statusIcon}</div>
          )}
          <div className="flex-1 min-w-0">
            <span className={`block font-mono font-black text-[9px] tracking-widest mb-0.5 ${textClass}`}>
              {statusText} • {item.format.toUpperCase()}
            </span>
            <span className={`block text-xs font-bold truncate ${textClass}`} title={item.title || item.url}>
              {item.title || item.url}
            </span>
          </div>
        </div>
        
        <button 
          onClick={() => isBusy ? onCancel(item.id) : isFailed ? onRetry(item.id) : onRemove(item.id)}
          className={`shrink-0 p-1 rounded-md opacity-50 hover:opacity-100 transition-opacity ${item.status === 'done' || isFailed ? 'hover:bg-black/20' : 'hover:bg-panel/50 text-ink'}`}
          aria-label={isBusy ? 'Cancel download' : isFailed ? 'Retry download' : 'Remove from queue'}
          title={isBusy ? "Cancel download" : isFailed ? "Retry download" : "Remove from queue"}
        >
          {isBusy ? (
            <X className="w-4 h-4" />
          ) : isFailed ? (
            <RotateCcw className="w-4 h-4" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {(item.status === 'downloading' || item.status === 'processing') && item.progress && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-xs font-bold">{item.progress.speed || '--'}</span>
            <span className="font-mono text-xs font-black">{item.progress.percent}%</span>
          </div>
          <ProgressBar percent={item.progress.percent} status={item.status} />
          <div className="text-right mt-1">
            <span className="font-mono text-[10px] font-bold opacity-70">ETA: {item.progress.eta || '--'}</span>
          </div>
        </div>
      )}
      
      {item.status === 'error' && item.error && (
        <div className="mt-2 text-[10px] font-mono font-bold bg-black/20 p-1.5 rounded-lg break-words max-h-[60px] overflow-y-auto">
          {item.error}
        </div>
      )}
      {item.status === 'expanded' && item.playlistItemCount && (
        <div className="mt-2 text-[10px] font-mono font-bold opacity-75">
          {item.playlistItemCount} child downloads added
        </div>
      )}
      <details className="mt-2 text-[10px] font-mono">
        <summary className="cursor-pointer font-bold opacity-70">Details</summary>
        <div className="mt-1 break-all opacity-70">{item.url}</div>
        <div className="mt-1 opacity-70">Format: {item.format.toUpperCase()}</div>
      </details>
    </div>
  );
});
