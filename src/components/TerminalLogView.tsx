import { useState, useEffect, useRef } from 'react';
import { Terminal, Play } from 'lucide-react';

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
      className="fixed bottom-0 left-1/2 w-full max-w-[1400px] px-6 lg:px-12 z-50 pointer-events-none transition-transform duration-300 ease-in-out"
      style={{ transform: `translate(-50%, ${isOpen ? '0px' : '250px'})` }}
    >
      <div className="w-full relative pointer-events-auto h-[250px]">
        {/* Toggle Tab (Nameplate) */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="absolute left-8 lg:left-12 top-[-48px] h-[48px] bg-oshipink border-4 border-b-0 border-ink px-8 rounded-t-2xl z-20 flex items-center gap-2 hover:bg-pink-500 transition-colors"
        >
          <Terminal className="w-5 h-5 text-white" />
          <h2 className="text-lg font-black tracking-widest text-white font-zen uppercase">System</h2>
          {/* Notification dot */}
          {!isOpen && logs.length > 0 && (
            <div className="absolute -top-2 -right-2 bg-toska text-ink text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-ink animate-bounce">
              {logs.length > 99 ? '99+' : logs.length}
            </div>
          )}
        </button>

        {/* The Text Box */}
        <div className="w-full h-full bg-white/95 backdrop-blur-md border-t-4 border-x-4 border-ink rounded-t-3xl shadow-[0_-8px_20px_rgba(58,46,66,0.15)] flex flex-col p-6 pt-8">
          
          {/* Dialogue Text (Logs) */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto text-sm leading-relaxed font-inter text-ink custom-scrollbar pr-4">
            {logs.length === 0 ? (
              <p className="text-muted font-bold italic">No system logs available.</p>
            ) : (
              logs.map((log, i) => {
                const isError = log.includes('ERROR') || log.includes('error');
                const isWarn = log.includes('WARN');
                return (
                  <p key={i} className={`mb-1 ${isError ? 'text-oshipink font-bold' : isWarn ? 'text-muted font-bold' : 'text-ink font-medium'}`}>
                    <span className="opacity-50 text-[10px] font-mono mr-2">[{new Date().toLocaleTimeString()}]</span>
                    {log}
                  </p>
                );
              })
            )}
          </div>

          {/* Blinking Next Indicator (VN Trope) */}
          <div 
            className="absolute bottom-6 right-8 text-oshipink animate-vn-next cursor-pointer"
            onClick={() => setIsOpen(false)}
            title="Close logs"
          >
            <Play className="w-6 h-6 rotate-90 fill-current" />
          </div>

        </div>
      </div>
    </footer>
  );
}
