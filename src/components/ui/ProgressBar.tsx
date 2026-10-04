interface ProgressBarProps {
  percent: number;
  status?: 'processing' | 'error' | 'done' | 'pending' | 'skipped' | 'fetching' | 'downloading' | 'detecting';
}

export function ProgressBar({ percent, status }: ProgressBarProps) {
  let colorClass = 'bg-toska';
  if (status === 'error') colorClass = 'bg-oshipink';
  else if (status === 'done') colorClass = 'bg-toska';
  else if (status === 'processing' || status === 'downloading' || status === 'fetching') colorClass = 'bg-ink';
  
  return (
    <div className="w-full h-1.5 bg-appbg rounded-full border border-gameborder/20 overflow-hidden shrink-0 mt-1">
      <div 
        className={`h-full transition-all duration-300 ${colorClass}`}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}
