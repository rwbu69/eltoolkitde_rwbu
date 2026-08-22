import { FolderOpen, Shield, Code, FileBox } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useSettings } from '../hooks/useSettings';
import { PageLayout, Column, SectionHeader, Panel, FormLabel } from './ui/Layout';

export default function SettingsView() {
  const { settings, updateSettings } = useSettings();

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        updateSettings({ defaultOutputDir: selected });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectCookies = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
      });
      if (selected && typeof selected === 'string') {
        updateSettings({ cookiesFilePath: selected });
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <PageLayout>
      {/* FULL WIDTH COLUMN for Settings */}
      <Column>
        <SectionHeader title="PREFERENCES" />

        <Panel className="space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          
          {/* GENERAL SECTION */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-1.5 font-zen font-black text-ink mb-3 border-b-2 border-ink pb-1.5 text-base">
              <FolderOpen className="w-5 h-5 text-toska" /> GENERAL DEFAULTS
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <FormLabel text="DEFAULT OUTPUT FOLDER" icon={FolderOpen} />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.defaultOutputDir}
                    readOnly
                    placeholder="Not set..."
                    className="game-input"
                  />
                  <button 
                    onClick={handleSelectFolder}
                    className="game-btn-secondary px-4 h-12 flex items-center justify-center shrink-0"
                  >
                    <FolderOpen className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* MEDIA CONFIG SECTION */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-1.5 font-zen font-black text-ink mb-3 border-b-2 border-ink pb-1.5 text-base">
              <FileBox className="w-5 h-5 text-toska" /> MEDIA PRESETS
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <FormLabel text="DEFAULT VIDEO QUALITY" />
                <select 
                  value={settings.defaultVideoQuality}
                  onChange={(e) => updateSettings({ defaultVideoQuality: e.target.value as any })}
                  className="game-select font-bold"
                >
                  <option value="best">BEST</option>
                  <option value="mid">MID</option>
                  <option value="low">LOW</option>
                </select>
              </div>
              
              <div>
                <FormLabel text="DEFAULT AUDIO BITRATE (MP3)" />
                <select 
                  value={settings.defaultAudioBitrate}
                  onChange={(e) => updateSettings({ defaultAudioBitrate: e.target.value as any })}
                  className="game-select font-bold"
                >
                  <option value="320k">320 kbps (High)</option>
                  <option value="256k">256 kbps (Standard)</option>
                  <option value="192k">192 kbps (Good)</option>
                  <option value="128k">128 kbps (Basic)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SYSTEM BEHAVIOR SECTION */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-1.5 font-zen font-black text-ink mb-3 border-b-2 border-ink pb-1.5 text-base">
              <Shield className="w-5 h-5 text-toska" /> SYSTEM BEHAVIOR
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <FormLabel text="CLOSE BUTTON ACTION" />
                <label className="flex items-center gap-3 cursor-pointer group mt-2 select-none">
                  <div className={`relative flex items-center justify-center w-6 h-6 border-4 border-ink rounded-md transition-colors ${settings.closeToTray ? 'bg-white' : 'bg-appbg'}`}>
                    <input 
                      type="checkbox" 
                      className="absolute opacity-0 cursor-pointer w-full h-full"
                      checked={settings.closeToTray}
                      onChange={(e) => updateSettings({ closeToTray: e.target.checked })}
                    />
                    {settings.closeToTray && <div className="w-2.5 h-2.5 bg-toska rounded-sm" />}
                  </div>
                  <span className="font-bold font-mono text-sm text-ink group-hover:text-toska transition-colors">
                    Minimize to System Tray
                  </span>
                </label>
                <p className="mt-2 text-[10px] font-mono font-bold text-muted uppercase">What happens when you click the X button. Uncheck to quit completely.</p>
              </div>
            </div>
          </div>

          {/* AUTHENTICATION SECTION */}
          <div className="space-y-4 bg-appbg border-4 border-ink p-5 rounded-2xl">
            <h3 className="flex items-center gap-1.5 font-zen font-black text-ink mb-3 border-b-2 border-ink pb-1.5 text-base">
              <Shield className="w-5 h-5 text-oshipink" /> AUTHENTICATION (FOR PREMIUM SITES)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <FormLabel text="USE BROWSER COOKIES" />
                <select 
                  value={settings.browserForCookies}
                  onChange={(e) => updateSettings({ browserForCookies: e.target.value, cookiesFilePath: '' })}
                  className="game-select font-bold bg-white"
                >
                  <option value="">None</option>
                  <option value="chrome">Chrome</option>
                  <option value="firefox">Firefox</option>
                  <option value="edge">Edge</option>
                  <option value="brave">Brave</option>
                  <option value="safari">Safari</option>
                  <option value="opera">Opera</option>
                </select>
                <p className="mt-2 text-xs font-mono font-bold text-muted">Use cookies from installed browser</p>
              </div>
              
              <div>
                <FormLabel text="OR USE COOKIES.TXT FILE" />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.cookiesFilePath}
                    readOnly
                    placeholder="No file selected..."
                    className="game-input bg-white"
                  />
                  <button 
                    onClick={handleSelectCookies}
                    disabled={!!settings.browserForCookies}
                    className="game-btn-secondary px-4 h-12 flex items-center justify-center shrink-0 disabled:opacity-50"
                  >
                    <Code className="w-5 h-5" />
                  </button>
                </div>
                <p className="mt-2 text-xs font-mono font-bold text-muted">Exported Netscape cookies.txt format</p>
              </div>
            </div>
          </div>

        </Panel>
      </Column>
    </PageLayout>
  );
}
