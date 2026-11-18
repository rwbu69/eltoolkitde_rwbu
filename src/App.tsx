import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Download, Sliders, Edit3, Settings, Moon, Sun, CheckCircle2 } from 'lucide-react';
import DownloaderHubView from './components/DownloaderHubView';
import AudioStudioView from './components/AudioStudioView';
import RenameView from './components/RenameView';
import SettingsView from './components/SettingsView';
import TerminalLogView from './components/TerminalLogView';
import { Titlebar } from './components/ui/Titlebar';
import { Tooltip } from './components/ui/Tooltip';
import { useAppStore } from './store/useAppStore';
import { ToastHost } from './components/ui/Toast';
import appIcon from './assets/icon.png';

export type MainTab = 'downloader' | 'studio' | 'rename' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<MainTab>('downloader');
  const { settings, updateSettings } = useAppStore();

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  useEffect(() => {
    invoke('set_khinsider_enabled', { enabled: settings.enableKhinsider }).catch(console.error);
  }, [settings.enableKhinsider]);

  useEffect(() => {
    const timer = setTimeout(() => {
      invoke('close_splashscreen').catch(console.error);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let unlisten: () => void;
    getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === 'drop') {
        window.dispatchEvent(new CustomEvent('toolkit-drop', { detail: event.payload.paths }));
      }
    }).then(u => unlisten = u);
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-appbg">
      <Titlebar />
      <ToastHost />

      {/* BODY CONTAINER (Rail + Stage) */}
      <div className="flex flex-1 w-full h-full min-h-0 overflow-hidden">
        {/* DESKTOP ARCADE RAIL (Left, >= 1024px) */}
        <aside className="hidden lg:flex flex-col items-center justify-between w-20 py-5 bg-panel border-r-3 border-gameborder shadow-game-thick z-30 shrink-0">
          {/* Top: App Avatar */}
          <div className="flex flex-col items-center gap-6">
            <div className="w-12 h-12 rounded-2xl border-3 border-gameborder bg-panel shadow-game-thin overflow-hidden p-1 flex items-center justify-center shrink-0">
              <img src={appIcon} alt="ElToolkit" className="w-full h-full object-contain rounded-xl" />
            </div>

            {/* Navigation Icons */}
            <nav className="flex flex-col items-center gap-3">
              <Tooltip text="Downloader" position="right">
                <button
                  onClick={() => setActiveTab('downloader')}
                  className={`w-12 h-12 rounded-2xl border-3 flex items-center justify-center transition-all duration-150 ${
                    activeTab === 'downloader'
                      ? 'bg-oshipink text-buttontext border-gameborder shadow-game-thin scale-105'
                      : 'bg-panel text-ink border-transparent hover:border-gameborder/40 hover:text-ink'
                  }`}
                  aria-label="Downloader"
                >
                  <Download className="w-5 h-5" />
                </button>
              </Tooltip>

              <Tooltip text="Audio Studio" position="right">
                <button
                  onClick={() => setActiveTab('studio')}
                  className={`w-12 h-12 rounded-2xl border-3 flex items-center justify-center transition-all duration-150 ${
                    activeTab === 'studio'
                      ? 'bg-oshipink text-buttontext border-gameborder shadow-game-thin scale-105'
                      : 'bg-panel text-ink border-transparent hover:border-gameborder/40 hover:text-ink'
                  }`}
                  aria-label="Audio Studio"
                >
                  <Sliders className="w-5 h-5" />
                </button>
              </Tooltip>

              <Tooltip text="Batch Renamer" position="right">
                <button
                  onClick={() => setActiveTab('rename')}
                  className={`w-12 h-12 rounded-2xl border-3 flex items-center justify-center transition-all duration-150 ${
                    activeTab === 'rename'
                      ? 'bg-oshipink text-buttontext border-gameborder shadow-game-thin scale-105'
                      : 'bg-panel text-ink border-transparent hover:border-gameborder/40 hover:text-ink'
                  }`}
                  aria-label="Batch Renamer"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              </Tooltip>
            </nav>
          </div>

          {/* Bottom Rail Actions: Settings & Theme */}
          <div className="flex flex-col items-center gap-3">
            <Tooltip text="Settings" position="right">
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-12 h-12 rounded-2xl border-3 flex items-center justify-center transition-all duration-150 ${
                  activeTab === 'settings'
                    ? 'bg-oshipink text-buttontext border-gameborder shadow-game-thin scale-105'
                    : 'bg-panel text-ink border-transparent hover:border-gameborder/40'
                }`}
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>
        </aside>

        {/* WORKSPACE & HUD COLUMN */}
        <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden">
          {/* TOP STATUS HUD */}
          <header className="z-20 flex items-center justify-between flex-none w-full px-4 lg:px-8 py-3 bg-appbg border-b-2 border-gameborder/20">
            <div className="flex items-center gap-3">
              {/* Mobile App Icon */}
              <div className="lg:hidden w-8 h-8 rounded-xl border-2 border-gameborder bg-panel overflow-hidden p-0.5 flex items-center justify-center shrink-0">
                <img src={appIcon} alt="ElToolkit" className="w-full h-full object-contain rounded-lg" />
              </div>

              <div>
                <h1 className="text-base lg:text-lg font-black leading-tight font-zen text-ink">
                  {activeTab === 'downloader' && 'Downloader'}
                  {activeTab === 'studio' && 'Audio Studio'}
                  {activeTab === 'rename' && 'Batch Renamer'}
                  {activeTab === 'settings' && 'Settings'}
                </h1>
                <p className="text-[10px] font-mono text-muted uppercase tracking-wider hidden sm:block">
                  ElToolkit Media Workstation
                </p>
              </div>
            </div>

            {/* Right Status Badges */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl border-2 border-gameborder bg-panel text-ink hover:border-oshipink transition-colors shadow-sm"
                title="Click to configure cookies in Settings"
              >
                {settings.cookiesFilePath || settings.browserForCookies ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-toska shrink-0" />
                    <span className="text-[10px] font-mono font-bold">Cookies Attached</span>
                  </>
                ) : (
                  <span className="text-[10px] font-mono text-muted font-bold">Public Mode</span>
                )}
              </button>

              {/* Theme Toggle */}
              <button
                onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
                className="p-1.5 rounded-xl border-2 border-gameborder bg-panel text-ink hover:text-oshipink transition-colors"
                title="Toggle theme"
                aria-label="Toggle theme"
              >
                {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </header>

          {/* MAIN STAGE */}
          <main className="flex-1 w-full min-h-0 px-3 lg:px-8 py-3 pb-20 lg:pb-4 overflow-hidden">
            <div className="w-full h-full relative">
              <div className={activeTab === 'downloader' ? 'h-full w-full' : 'hidden'}>
                <DownloaderHubView />
              </div>
              <div className={activeTab === 'studio' ? 'h-full w-full' : 'hidden'}>
                <AudioStudioView isActive={activeTab === 'studio'} />
              </div>
              <div className={activeTab === 'rename' ? 'h-full w-full' : 'hidden'}>
                <RenameView isActive={activeTab === 'rename'} />
              </div>
              <div className={activeTab === 'settings' ? 'h-full w-full' : 'hidden'}>
                <SettingsView />
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* MOBILE ARCADE BOTTOM DOCK (< 1024px) */}
      <nav className="flex lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-panel border-t-3 border-gameborder z-40 items-center justify-around safe-pb shadow-[0_-4px_16px_rgba(0,0,0,0.15)] px-2">
        <button
          onClick={() => setActiveTab('downloader')}
          className={`flex-1 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 font-zen text-[10px] font-bold transition-all ${
            activeTab === 'downloader' ? 'text-oshipink font-black scale-105' : 'text-muted hover:text-ink'
          }`}
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>Downloader</span>
        </button>

        <button
          onClick={() => setActiveTab('studio')}
          className={`flex-1 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 font-zen text-[10px] font-bold transition-all ${
            activeTab === 'studio' ? 'text-oshipink font-black scale-105' : 'text-muted hover:text-ink'
          }`}
        >
          <Sliders className="w-4 h-4 shrink-0" />
          <span>Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('rename')}
          className={`flex-1 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 font-zen text-[10px] font-bold transition-all ${
            activeTab === 'rename' ? 'text-oshipink font-black scale-105' : 'text-muted hover:text-ink'
          }`}
        >
          <Edit3 className="w-4 h-4 shrink-0" />
          <span>Rename</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 font-zen text-[10px] font-bold transition-all ${
            activeTab === 'settings' ? 'text-oshipink font-black scale-105' : 'text-muted hover:text-ink'
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Settings</span>
        </button>
      </nav>

      {/* Terminal Log Footer / Drawer */}
      <div className="z-30 flex-none">
        <TerminalLogView />
      </div>
    </div>
  );
}

export default App;
