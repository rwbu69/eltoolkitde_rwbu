import { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, X, Copy } from 'lucide-react';
import { showToast } from './ui/Toast';

export default function TerminalLogView() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleLog = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setLogs((prev) => {
        const newLogs = [...prev, customEvent.detail];
        if (newLogs.length > 200) {
          return newLogs.slice(newLogs.length - 200);
        }
        return newLogs;
      });
      // Auto-open on error
      if (customEvent.detail.includes('ERROR') || customEvent.detail.includes('error')) {
        setIsOpen(true);
      }
    };

    window.addEventListener('toolkit-log', handleLog);
    return () => window.removeEventListener('toolkit-log', handleLog);
  }, []);

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const handleCopyLogs = () => {
    if (logs.length === 0) return;
    navigator.clipboard.writeText(logs.join('\n'));
    showToast('Logs copied to clipboard', 'info');
  };

  const errorCount = logs.filter(l => l.includes('ERROR') || l.includes('error')).length;

  return (
    <footer 
      className="fixed bottom-16 lg:bottom-0 left-1/2 w-full max-w-[1400px] px-3 lg:px-12 z-40 pointer-events-none transition-transform duration-250 ease-in-out"
      style={{ transform: `translate(-50%, ${isOpen ? '0px' : 'calc(100% + 4px)'})` }}
    >
      <div className="w-full relative pointer-events-auto h-[260px] lg:h-[140px]">
        {/* Toggle Tab (Nameplate) */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="absolute left-4 lg:left-10 top-[-28px] h-[28px] bg-oshipink border-2 border-b-0 border-gameborder px-3.5 rounded-t-lg z-20 flex items-center gap-1.5 hover:bg-pink-500 transition-colors shadow-sm select-none"
          title={isOpen ? 'Minimize terminal' : 'Open system logs'}
        >
          <Terminal className="w-3.5 h-3.5 text-buttontext shrink-0" />
          <span className="text-xs font-mono font-bold tracking-wider text-buttontext uppercase">System Logs</span>

          {/* High-Contrast Pill Badge */}
          {!isOpen && logs.length > 0 && (
            <span
              className={`ml-1.5 text-[10px] font-mono font-black px-2 py-0.5 rounded-full border shadow-sm leading-none flex items-center ${
                errorCount > 0
                  ? 'bg-rose-600 text-white border-rose-700'
                  : 'bg-toska text-white dark:text-buttontext border-gameborder/30'
              }`}
            >
              {errorCount > 0 ? `${errorCount} error${errorCount > 1 ? 's' : ''}` : logs.length > 99 ? '99+' : logs.length}
            </span>
          )}
        </button>

        {/* The Text Box (100% Solid Opaque Panel) */}
        <div className="w-full h-full bg-panel border-t-3 border-x-3 border-gameborder rounded-t-2xl shadow-[0_-6px_20px_rgba(0,0,0,0.18)] flex flex-col px-4 py-2.5 relative">
          
          {/* Mobile Drag Pill */}
          <div 
            onClick={() => setIsOpen(false)}
            className="lg:hidden w-10 h-1.5 rounded-full bg-gameborder/40 mx-auto mb-2 shrink-0 cursor-pointer"
            title="Swipe down or tap to close"
          />

          {/* Quick Actions (Floating Top-Right) */}
          <div className="absolute top-2.5 right-3 flex items-center gap-1.5 z-10">
            {logs.length > 0 && (
              <>
                <button
                  onClick={handleCopyLogs}
                  className="flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-gameborder/30 hover:border-oshipink hover:text-oshipink text-muted bg-panel transition-colors"
                  title="Copy logs to clipboard"
                >
                  <Copy className="w-3 h-3" />
                  <span className="hidden sm:inline">Copy</span>
                </button>
                <button
                  onClick={() => setLogs([])}
                  className="flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-gameborder/30 hover:border-oshipink hover:text-oshipink text-muted bg-panel transition-colors"
                  title="Clear in-memory logs"
                >
                  <Trash2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:text-ink text-muted transition-colors rounded hover:bg-gameborder/10"
              title="Close terminal drawer"
              aria-label="Close terminal drawer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Log Lines Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto text-[11px] leading-snug font-mono text-ink custom-scrollbar pr-16 space-y-0.5">
            {logs.length === 0 ? (
              <p className="text-muted font-mono italic text-[11px]">No system logs available.</p>
            ) : (
              logs.map((log, i) => {
                const isError = log.includes('ERROR') || log.includes('error');
                const isWarn = log.includes('WARN');
                return (
                  <p
                    key={i}
                    className={`break-words ${
                      isError
                        ? 'text-rose-600 dark:text-oshipink font-black'
                        : isWarn
                        ? 'text-amber-700 dark:text-amber-400 font-bold'
                        : 'text-ink'
                    }`}
                  >
                    <span className="opacity-40 text-[10px] mr-1.5 select-none">[{new Date().toLocaleTimeString()}]</span>
                    {log}
                  </p>
                );
              })
            )}
          </div>

        </div>
      </div>
    </footer>
  );
}
