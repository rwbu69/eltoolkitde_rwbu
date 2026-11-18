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
    const handleToggle = () => setIsOpen((prev) => !prev);
    window.addEventListener('toolkit-toggle-terminal', handleToggle);
    return () => {
      window.removeEventListener('toolkit-log', handleLog);
      window.removeEventListener('toolkit-toggle-terminal', handleToggle);
    };
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
      className={`fixed bottom-16 lg:bottom-0 left-1/2 w-full max-w-[1400px] px-3 lg:px-12 z-40 transition-all duration-200 ease-in-out ${
        isOpen 
          ? 'translate-x-[-50%] translate-y-0 opacity-100 pointer-events-auto' 
          : 'translate-x-[-50%] translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div className="w-full relative h-[260px] lg:h-[160px]">
        {/* The Text Box (100% Solid Opaque Panel) */}
        <div className="w-full h-full bg-panel border-t-2 border-x-2 border-gameborder rounded-t-2xl shadow-2xl flex flex-col px-4 py-2.5 relative">
          
          {/* Header Row */}
          <div className="flex items-center justify-between pb-2 border-b border-subtleborder shrink-0">
            <div className="flex items-center gap-2 select-none">
              <Terminal className="w-4 h-4 text-oshipink shrink-0" />
              <span className="text-xs font-mono font-bold tracking-wider text-ink uppercase">System Logs</span>
              {logs.length > 0 && (
                <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border shadow-none leading-none ${
                  errorCount > 0
                    ? 'bg-rose-500 text-white border-rose-600'
                    : 'bg-appbg text-muted border-subtleborder'
                }`}>
                  {errorCount > 0 ? `${errorCount} error${errorCount > 1 ? 's' : ''}` : logs.length}
                </span>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5">
              {logs.length > 0 && (
                <>
                  <button
                    onClick={handleCopyLogs}
                    className="flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-1 rounded-lg border border-subtleborder hover:border-oshipink hover:text-oshipink text-muted bg-panel transition-colors"
                    title="Copy logs to clipboard"
                  >
                    <Copy className="w-3 h-3" />
                    <span className="hidden sm:inline">Copy</span>
                  </button>
                  <button
                    onClick={() => setLogs([])}
                    className="flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-1 rounded-lg border border-subtleborder hover:border-oshipink hover:text-oshipink text-muted bg-panel transition-colors"
                    title="Clear in-memory logs"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:text-ink text-muted transition-colors rounded-lg hover:bg-subtleborder/20"
                title="Close terminal drawer"
                aria-label="Close terminal drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Log Lines Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto text-[11px] leading-snug font-mono text-ink custom-scrollbar py-2 space-y-0.5">
            {logs.length === 0 ? (
              <p className="text-muted font-mono italic text-[11px]">No system logs recorded.</p>
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
