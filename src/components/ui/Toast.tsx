import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';
export interface ToastMessage {
  id: number;
  message: string;
  detail?: string;
  tone: ToastTone;
}

let nextToastId = 0;
export function showToast(message: string, tone: ToastTone = 'info', detail?: string) {
  window.dispatchEvent(new CustomEvent<ToastMessage>('toolkit-toast', {
    detail: { id: ++nextToastId, message, detail, tone },
  }));
}

const toneClasses: Record<ToastTone, string> = {
  info: 'border-toska bg-softtoska',
  success: 'border-toska bg-softtoska',
  warning: 'border-oshipink bg-softpink',
  error: 'border-oshipink bg-softpink',
};

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const toast = (event as CustomEvent<ToastMessage>).detail;
      setToasts((current) => [...current, toast].slice(-4));
      window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), 5000);
    };
    window.addEventListener('toolkit-toast', handleToast);
    return () => window.removeEventListener('toolkit-toast', handleToast);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'info' ? Info : AlertTriangle;
        return (
          <div key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border-2 p-3 text-ink shadow-game-thin ${toneClasses[toast.tone]}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-black">{toast.message}</p>
              {toast.detail && <p className="mt-1 break-words font-mono text-[10px] opacity-80">{toast.detail}</p>}
            </div>
            <button className="shrink-0 p-1" aria-label="Close notification" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><X className="h-4 w-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
