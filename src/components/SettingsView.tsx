import { FolderOpen, Shield, FileBox, Download, Zap } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PageLayout, Column, SectionHeader, Panel, FormLabel } from './ui/Layout';
import { Input } from './ui/Input';
import { PathPicker } from './ui/PathPicker';
import { Toggle } from './ui/Toggle';

export default function SettingsView() {
  const { settings, updateSettings } = useAppStore();

  return (
    <PageLayout>
      {/* FULL WIDTH COLUMN for Settings */}
      <Column>
        <SectionHeader title="PREFERENCES" />

        <Panel className="space-y-6 flex-1 min-w-0 overflow-y-auto custom-scrollbar">
          
          {/* GENERAL SECTION */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-1.5 font-zen font-black text-ink mb-3 border-b-2 border-gameborder pb-1.5 text-base">
              <FolderOpen className="w-5 h-5 text-toska" /> GENERAL DEFAULTS
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <FormLabel text="DEFAULT OUTPUT FOLDER" icon={FolderOpen} />
                <PathPicker 
                  value={settings.defaultOutputDir}
                  onChange={(path) => updateSettings({ defaultOutputDir: path })}
                  placeholder="Not set..."
                  directory={true}
                />
              </div>
              
              <div>
                <FormLabel text="APPEARANCE" />
                <select 
                  value={settings.theme}
                  onChange={(e) => updateSettings({ theme: e.target.value as 'light' | 'dark' })}
                  className="game-select font-bold"
                >
                  <option value="light">LIGHT MODE</option>
                  <option value="dark">DARK MODE (Midnight)</option>
                </select>
                <p className="mt-2 text-[10px] font-mono font-bold text-muted uppercase">Changes apply immediately.</p>
              </div>
            </div>
          </div>

          {/* MEDIA CONFIG SECTION */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-1.5 font-zen font-black text-ink mb-3 border-b-2 border-gameborder pb-1.5 text-base">
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

          {/* DOWNLOAD BEHAVIOR SECTION */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-1.5 font-zen font-black text-ink mb-3 border-b-2 border-gameborder pb-1.5 text-base">
              <Download className="w-5 h-5 text-toska" /> DOWNLOAD BEHAVIOR
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <FormLabel text="CONCURRENT DOWNLOADS" />
                <Toggle 
                  checked={settings.enableConcurrentDownloads}
                  onChange={(checked) => updateSettings({ enableConcurrentDownloads: checked })}
                  label="Enable Parallel Processing"
                  description="Download multiple links or playlist items at once."
                  variant="checkbox"
                />
              </div>

              <div>
                <FormLabel text="MAX CONCURRENT ITEMS" />
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.maxConcurrentDownloads}
                  onChange={(e) => updateSettings({ maxConcurrentDownloads: parseInt(e.target.value) || 1 })}
                  disabled={!settings.enableConcurrentDownloads}
                  className="font-bold disabled:opacity-50"
                />
                <p className="mt-2 text-[10px] font-mono font-bold text-muted uppercase">Keep it low (2-3) to avoid IP bans from YouTube.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <FormLabel text="RATE LIMIT SPEED" icon={Zap} iconColor="text-oshipink" />
                <Input
                  type="text"
                  value={settings.rateLimitSpeed}
                  onChange={(e) => updateSettings({ rateLimitSpeed: e.target.value })}
                  placeholder="e.g. 5M (Leave empty for none)"
                />
                <p className="mt-2 text-[10px] font-mono font-bold text-muted uppercase">Throttle download speed (e.g., 5M = 5 MB/s, 500K = 500 KB/s) to prevent bans.</p>
              </div>
            </div>
          </div>

          {/* SYSTEM BEHAVIOR SECTION */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-1.5 font-zen font-black text-ink mb-3 border-b-2 border-gameborder pb-1.5 text-base">
              <Shield className="w-5 h-5 text-toska" /> SYSTEM BEHAVIOR
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <FormLabel text="CLOSE BUTTON ACTION" />
                <Toggle 
                  checked={settings.closeToTray}
                  onChange={(checked) => updateSettings({ closeToTray: checked })}
                  label="Minimize to System Tray"
                  description="What happens when you click the X button. Uncheck to quit completely."
                  variant="checkbox"
                />
              </div>
            </div>
          </div>

          {/* AUTHENTICATION SECTION */}
          <div className="space-y-4 bg-appbg border-4 border-gameborder p-5 rounded-2xl">
            <h3 className="flex items-center gap-1.5 font-zen font-black text-ink mb-3 border-b-2 border-gameborder pb-1.5 text-base">
              <Shield className="w-5 h-5 text-oshipink" /> AUTHENTICATION (FOR PREMIUM SITES)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <FormLabel text="USE BROWSER COOKIES" />
                <select 
                  value={settings.browserForCookies}
                  onChange={(e) => updateSettings({ browserForCookies: e.target.value, cookiesFilePath: '' })}
                  className="game-select font-bold bg-panel"
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
                <PathPicker 
                  value={settings.cookiesFilePath}
                  onChange={(path) => updateSettings({ cookiesFilePath: path })}
                  placeholder="No file selected..."
                  directory={false}
                  filters={[{ name: 'Text Files', extensions: ['txt'] }]}
                />
                <p className="mt-2 text-xs font-mono font-bold text-muted">Exported Netscape cookies.txt format</p>
              </div>
            </div>
          </div>

        </Panel>
      </Column>
    </PageLayout>
  );
}
