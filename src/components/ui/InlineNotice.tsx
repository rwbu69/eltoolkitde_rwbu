import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface InlineNoticeProps {
  message: string;
  detail?: string;
  tone?: 'info' | 'warning' | 'error' | 'success';
}

const toneClasses = {
  info: 'bg-softtoska border-toska',
  warning: 'bg-softpink border-oshipink',
  error: 'bg-softpink border-oshipink',
  success: 'bg-softtoska border-toska',
};

export function InlineNotice({ message, detail, tone = 'info' }: InlineNoticeProps) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertTriangle;
  return (
    <div
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-lg border-2 p-2 text-[10px] font-mono font-bold text-ink ${toneClasses[tone]}`}
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <span>{message}</span>
        {detail && (
          <details className="mt-1 font-normal">
            <summary className="cursor-pointer">Technical details</summary>
            <span className="mt-1 block break-words opacity-80">{detail}</span>
          </details>
        )}
      </div>
    </div>
  );
}
