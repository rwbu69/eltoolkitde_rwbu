import { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

export default function TerminalLogView() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleLog = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setLogs((prev) => {
        const newLogs = [...prev, customEvent.detail];
        // Keep only last 1000 logs to prevent memory issues
        if (newLogs.length > 1000) {
          return newLogs.slice(newLogs.length - 1000);
        }
        return newLogs;
      });
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
    <div className={`fixed bottom-0 left-0 right-0 z-[100] transition-all duration-300 ease-in-out lg:left-64 ${isOpen ? 'h-64' : 'h-10'}`}>
      <div className="flex h-full flex-col bg-zinc-950 border-t border-zinc-800 shadow-2xl">
        {/* Header */}
        <div 
          className="flex h-10 shrink-0 cursor-pointer items-center justify-between bg-zinc-900 px-4 hover:bg-zinc-800/80 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-2 text-zinc-400">
            <Terminal className="h-4 w-4" />
            <span className="text-xs font-medium tracking-wider uppercase">Terminal Log</span>
            {logs.length > 0 && !isOpen && (
              <span className="ml-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-400">
                {logs.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isOpen && (
              <button 
                onClick={(e) => { e.stopPropagation(); setLogs([]); }}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Clear Logs"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Content */}
        {isOpen && (
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto bg-[#0c0c0e] p-4 font-mono text-[11px] text-zinc-300 custom-scrollbar"
          >
            {logs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-zinc-600">
                No logs to display
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {logs.map((log, i) => (
                  <div key={i} className="break-all whitespace-pre-wrap">
                    <span className="text-zinc-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                    <span className={log.includes('ERROR') || log.includes('error') ? 'text-red-400' : log.includes('WARN') ? 'text-amber-400' : 'text-zinc-300'}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
