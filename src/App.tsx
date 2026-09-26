import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Download, Settings, RefreshCcw, FileAudio, Edit3, Activity } from 'lucide-react';
import DownloaderView from './components/DownloaderView';
import FfmpegView from './components/FfmpegView';
import MetadataView from './components/MetadataView';
import RenameView from './components/RenameView';
import BpmModifierView from './components/BpmModifierView';
import SettingsView from './components/SettingsView';
import TerminalLogView from './components/TerminalLogView';
import { Titlebar } from './components/ui/Titlebar';
import { Tooltip } from './components/ui/Tooltip';
import { useAppStore } from './store/useAppStore';

import appIcon from './assets/icon.png';

type Tab = 'downloader' | 'ffmpeg' | 'metadata' | 'rename' | 'bpm' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('downloader');
  const { settings } = useAppStore();

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  useEffect(() => {
    const timer = setTimeout(() => {
      invoke('close_splashscreen').catch(console.error);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let unlisten: () => void;
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().onDragDropEvent((event) => {
        if (event.payload.type === 'drop') {
          window.dispatchEvent(new CustomEvent('toolkit-drop', { detail: event.payload.paths }));
        }
      }).then(u => unlisten = u);
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-appbg">
      <Titlebar />
      
      {/* TOP HUD BAR */}
      <header className="z-50 flex items-start justify-between flex-none w-full p-4 pointer-events-none">
        
        {/* "Player" Profile */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Avatar */}
          <div className="relative z-10 flex items-center justify-center w-12 h-12 overflow-hidden border-4 rounded-full bg-panel border-gameborder shadow-game-thin shrink-0">
            <img src={appIcon} alt="Avatar" className="object-cover w-full h-full" />
          </div>
          
          {/* Player Name & Info Bar */}
          <div className="py-1.5 pl-8 pr-5 -ml-6 border-4 bg-panel/90 backdrop-blur-sm border-gameborder rounded-r-xl rounded-l-md shadow-game-thin shrink-0 hidden sm:block">
            <h1 className="text-lg font-black leading-tight font-zen text-ink">ElToolkit</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-[9px] font-bold text-muted uppercase w-[70px] truncate inline-block">{activeTab}</span>
              <div className="w-12 h-2 overflow-hidden border-2 rounded-full bg-appbg border-gameborder shrink-0">
                <div className="w-full h-full bg-toska"></div>
              </div>
              <span className="font-mono text-[9px] font-bold text-toska shrink-0">READY</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap justify-end gap-2 pointer-events-auto shrink-0">
          <Tooltip text="DOWNLOADER">
            <button 
              onClick={() => setActiveTab('downloader')} 
              className={`flex items-center justify-center h-10 w-10 px-0 lg:w-auto lg:px-4 gap-2 ${activeTab === 'downloader' ? 'game-btn-primary' : 'game-btn-secondary text-ink'}`}
            >
              <Download className="w-4 h-4 shrink-0" />
              <span className="hidden text-xs font-bold lg:inline">Downloader</span>
            </button>
          </Tooltip>
          <Tooltip text="FFMPEG">
            <button 
              onClick={() => setActiveTab('ffmpeg')} 
              className={`flex items-center justify-center h-10 w-10 px-0 lg:w-auto lg:px-4 gap-2 ${activeTab === 'ffmpeg' ? 'game-btn-primary' : 'game-btn-secondary text-ink'}`}
            >
              <FileAudio className="w-4 h-4 shrink-0" />
              <span className="hidden text-xs font-bold lg:inline">FFmpeg</span>
            </button>
          </Tooltip>
          <Tooltip text="METADATA">
            <button 
              onClick={() => setActiveTab('metadata')} 
              className={`flex items-center justify-center h-10 w-10 px-0 lg:w-auto lg:px-4 gap-2 ${activeTab === 'metadata' ? 'game-btn-primary' : 'game-btn-secondary text-ink'}`}
            >
              <RefreshCcw className="w-4 h-4 shrink-0" />
              <span className="hidden text-xs font-bold lg:inline">Metadata</span>
            </button>
          </Tooltip>
          <Tooltip text="RENAME">
            <button 
              onClick={() => setActiveTab('rename')} 
              className={`flex items-center justify-center h-10 w-10 px-0 lg:w-auto lg:px-4 gap-2 ${activeTab === 'rename' ? 'game-btn-primary' : 'game-btn-secondary text-ink'}`}
            >
              <Edit3 className="w-4 h-4 shrink-0" />
              <span className="hidden text-xs font-bold lg:inline">Rename</span>
            </button>
          </Tooltip>
          <Tooltip text="BPM MODIFIER">
            <button 
              onClick={() => setActiveTab('bpm')} 
              className={`flex items-center justify-center h-10 w-10 px-0 lg:w-auto lg:px-4 gap-2 ${activeTab === 'bpm' ? 'game-btn-primary' : 'game-btn-secondary text-ink'}`}
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span className="hidden text-xs font-bold lg:inline">BPM</span>
            </button>
          </Tooltip>
          <div className="hidden w-px h-10 mx-1 bg-ink/20 lg:block"></div>
          <Tooltip text="SETTINGS">
            <button 
              onClick={() => setActiveTab('settings')} 
              className={`flex items-center justify-center h-10 w-10 px-0 lg:w-auto lg:px-4 gap-2 ${activeTab === 'settings' ? 'game-btn-primary' : 'game-btn-secondary text-oshipink hover:text-oshipink'}`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span className="hidden text-xs font-bold lg:inline">Prefs</span>
            </button>
          </Tooltip>
        </nav>
      </header>

      {/* Main Content (Stage Area) */}
      <main className="z-10 flex flex-col flex-1 w-full min-h-0 px-6 pt-2 pb-4 overflow-hidden lg:px-12">
        <div className="max-w-[1400px] mx-auto w-full flex-1 min-h-0 overflow-hidden relative">
          <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === 'downloader' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <DownloaderView />
          </div>
          <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === 'ffmpeg' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <FfmpegView isActive={activeTab === 'ffmpeg'} />
          </div>
          <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === 'metadata' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <MetadataView isActive={activeTab === 'metadata'} />
          </div>
          <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === 'rename' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <RenameView isActive={activeTab === 'rename'} />
          </div>
          <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === 'bpm' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <BpmModifierView isActive={activeTab === 'bpm'} />
          </div>
          <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === 'settings' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <SettingsView />
          </div>
        </div>
      </main>

      {/* VN Terminal Log Footer */}
      <div className="z-20 flex-none">
        <TerminalLogView />
      </div>
    </div>
  );
}

export default App;
