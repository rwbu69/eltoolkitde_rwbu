import { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, X } from 'lucide-react';

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

  return (
    <footer 
      className="fixed bottom-0 left-1/2 w-full max-w-[1400px] px-6 lg:px-12 z-50 pointer-events-none transition-transform duration-250 ease-in-out"
      style={{ transform: `translate(-50%, ${isOpen ? '0px' : '140px'})` }}
    >
      <div className="w-full relative pointer-events-auto h-[140px]">
        {/* Toggle Tab (Nameplate) */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="absolute left-6 lg:left-10 top-[-28px] h-[28px] bg-oshipink border-2 border-b-0 border-gameborder px-3.5 rounded-t-lg z-20 flex items-center gap-1.5 hover:bg-pink-500 transition-colors shadow-sm"
          title={isOpen ? 'Minimize terminal' : 'Open system logs'}
        >
          <Terminal className="w-3.5 h-3.5 text-buttontext shrink-0" />
          <span className="text-xs font-mono font-bold tracking-wider text-buttontext uppercase">System Logs</span>
          {/* Notification badge when closed */}
          {!isOpen && logs.length > 0 && (
            <span className="ml-1 bg-toska text-ink text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full border border-gameborder">
              {logs.length > 99 ? '99+' : logs.length}
            </span>
          )}
        </button>

        {/* The Text Box (100% Solid Opaque Panel) */}
        <div className="w-full h-full bg-panel border-t-2 border-x-2 border-gameborder rounded-t-xl shadow-[0_-6px_16px_rgba(0,0,0,0.15)] flex flex-col px-4 py-2.5 relative">
          
          {/* Quick Actions (Floating Top-Right) */}
          <div className="absolute top-2 right-3 flex items-center gap-1.5 z-10">
            {logs.length > 0 && (
              <button
                onClick={() => setLogs([])}
                className="flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-gameborder/30 hover:border-oshipink hover:text-oshipink text-muted bg-panel transition-colors"
                title="Clear in-memory logs"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:text-ink text-muted transition-colors rounded hover:bg-gameborder/10"
              title="Close terminal drawer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dialogue Text (Logs) */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto text-[11px] leading-snug font-mono text-ink custom-scrollbar pr-16 space-y-0.5">
            {logs.length === 0 ? (
              <p className="text-muted font-mono italic text-[11px]">No system logs available.</p>
            ) : (
              logs.map((log, i) => {
                const isError = log.includes('ERROR') || log.includes('error');
                const isWarn = log.includes('WARN');
                return (
                  <p key={i} className={`break-words ${isError ? 'text-oshipink font-bold' : isWarn ? 'text-toska font-bold' : 'text-ink'}`}>
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
