import { Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function Titlebar() {
  const minimize = () => getCurrentWindow().minimize();
  const maximize = async () => {
    const win = getCurrentWindow();
    if (await win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  };
  const close = () => getCurrentWindow().close();

  return (
    <div 
      onContextMenu={(e) => e.preventDefault()}
      className="h-10 bg-white border-b-4 border-ink flex justify-between items-center shrink-0 shadow-game-thin z-[9999] select-none"
    >
      
      {/* Drag Region & Title */}
      <div 
        data-tauri-drag-region 
        className="flex-1 h-full flex items-center pl-4 cursor-default"
      >
        <span className="font-zen font-black tracking-widest text-ink text-sm mt-0.5 pointer-events-none">
          ElToolkitDeRWBU
        </span>
      </div>
      
      {/* Window Controls (Outside drag region) */}
      <div className="flex items-center gap-1 pr-2 shrink-0">
        <button 
          onClick={minimize}
          className="w-8 h-8 flex items-center justify-center hover:bg-appbg rounded text-ink transition-colors"
          title="Minimize"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button 
          onClick={maximize}
          className="w-8 h-8 flex items-center justify-center hover:bg-appbg rounded text-ink transition-colors"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button 
          onClick={close}
          className="w-8 h-8 flex items-center justify-center hover:bg-oshipink hover:text-white rounded text-ink transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
