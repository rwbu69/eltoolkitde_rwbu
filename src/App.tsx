import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Download, Settings, RefreshCcw, FileAudio, Menu, X } from 'lucide-react';
import DownloaderView from './components/DownloaderView';
import FfmpegView from './components/FfmpegView';
import MetadataView from './components/MetadataView';
import SettingsView from './components/SettingsView';

type Tab = 'downloader' | 'ffmpeg' | 'metadata' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('downloader');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      invoke('close_splashscreen').catch(console.error);
    }, 1000); // Give it a second to render cleanly
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-zinc-950 border-r border-zinc-800 p-4 flex flex-col gap-4 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-rose-500" />
            <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">
              ElToolkit
            </h1>
          </div>
          <button 
            className="lg:hidden text-zinc-400 hover:text-zinc-200"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 space-y-1.5">
          <button 
            onClick={() => { setActiveTab('downloader'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors border-l-2 ${
              activeTab === 'downloader' ? 'border-rose-500 bg-zinc-900/50 text-zinc-100' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
            }`}
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Downloader</span>
          </button>
          <button 
            onClick={() => { setActiveTab('ffmpeg'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors border-l-2 ${
              activeTab === 'ffmpeg' ? 'border-rose-500 bg-zinc-900/50 text-zinc-100' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
            }`}
          >
            <FileAudio className="w-4 h-4" />
            <span className="text-sm font-medium">FFmpeg Tools</span>
          </button>
          <button 
            onClick={() => { setActiveTab('metadata'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors border-l-2 ${
              activeTab === 'metadata' ? 'border-rose-500 bg-zinc-900/50 text-zinc-100' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
            }`}
          >
            <RefreshCcw className="w-4 h-4" />
            <span className="text-sm font-medium">Metadata</span>
          </button>
        </nav>

        <button 
          onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mt-auto border-l-2 ${
            activeTab === 'settings' ? 'border-rose-500 bg-zinc-900/50 text-zinc-100' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen bg-zinc-950">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center gap-3 p-4 border-b border-zinc-800 bg-zinc-950">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="text-zinc-400 hover:text-zinc-200"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-medium text-zinc-200 capitalize">{activeTab}</span>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className={activeTab === 'downloader' ? 'block' : 'hidden'}>
              <DownloaderView />
            </div>
            <div className={activeTab === 'ffmpeg' ? 'block' : 'hidden'}>
              <FfmpegView />
            </div>
            <div className={activeTab === 'metadata' ? 'block' : 'hidden'}>
              <MetadataView />
            </div>
            <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
              <SettingsView />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
