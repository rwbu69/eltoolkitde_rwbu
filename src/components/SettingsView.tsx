import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FolderOpen, Shield, FileBox, Download, Zap, RefreshCcw, Library } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Panel, PanelScrollArea, FormLabel } from './ui/Layout';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { PathPicker } from './ui/PathPicker';
import { Toggle } from './ui/Toggle';
import { AUDIO_BITRATE_OPTIONS, VIDEO_CODEC_OPTIONS, VIDEO_QUALITY_OPTIONS, type AudioBitrate, type VideoCodec, type VideoQuality } from '../config/mediaSettings';
import { YtDlpService } from '../services/ytdlp';
import { InlineNotice } from './ui/InlineNotice';
import { showToast } from './ui/Toast';

export default function SettingsView() {
  const { settings, updateSettings } = useAppStore();
  const [isUpdatingYtDlp, setIsUpdatingYtDlp] = useState(false);
  const [updateNotice, setUpdateNotice] = useState('');

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <Panel className="flex-1 flex flex-col min-w-0" noPadding>
        <PanelScrollArea className="p-4 flex flex-col gap-5">
          {/* 1. GENERAL & OUTPUT */}
          <div className="bg-appbg border border-subtleborder rounded-2xl p-4 space-y-4">
            <h3 className="flex items-center gap-2 font-zen font-black text-ink text-sm border-b border-subtleborder pb-2">
              <FolderOpen className="w-4 h-4 text-toska" /> General defaults & output
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FormLabel text="Default output folder" icon={FolderOpen} />
                <PathPicker 
                  value={settings.defaultOutputDir}
                  onChange={(path) => updateSettings({ defaultOutputDir: path })}
                  placeholder="Not set..."
                  directory={true}
                />
              </div>

              <div className="flex items-center pt-6">
                <Toggle 
                  checked={settings.closeToTray}
                  onChange={(checked) => updateSettings({ closeToTray: checked })}
                  label="Minimize to system tray on close"
                  description="Keep running in background when closed."
                  variant="checkbox"
                />
              </div>
            </div>
          </div>

          {/* 2. MEDIA PRESETS */}
          <div className="bg-appbg border border-subtleborder rounded-2xl p-4 space-y-4">
            <h3 className="flex items-center gap-2 font-zen font-black text-ink text-sm border-b border-subtleborder pb-2">
              <FileBox className="w-4 h-4 text-toska" /> Media quality presets
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <FormLabel text="Default video resolution" />
                <select 
                  value={settings.defaultVideoQuality}
                  onChange={(e) => updateSettings({ defaultVideoQuality: e.target.value as VideoQuality })}
                  className="game-select font-bold text-xs"
                >
                  {VIDEO_QUALITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <FormLabel text="Default video codec" />
                <select 
                  value={settings.defaultVideoCodec}
                  onChange={(e) => updateSettings({ defaultVideoCodec: e.target.value as VideoCodec })}
                  className="game-select font-bold text-xs"
                >
                  {VIDEO_CODEC_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <FormLabel text="Default audio bitrate (MP3)" />
                <select 
                  value={settings.defaultAudioBitrate}
                  onChange={(e) => updateSettings({ defaultAudioBitrate: e.target.value as AudioBitrate })}
                  className="game-select font-bold text-xs"
                >
                  {AUDIO_BITRATE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3. DOWNLOAD & NETWORK BEHAVIOR */}
          <div className="bg-appbg border border-subtleborder rounded-2xl p-4 space-y-4">
            <h3 className="flex items-center gap-2 font-zen font-black text-ink text-sm border-b border-subtleborder pb-2">
              <Download className="w-4 h-4 text-toska" /> Download & network behavior
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Toggle 
                  checked={settings.enableConcurrentDownloads}
                  onChange={(checked) => updateSettings({ enableConcurrentDownloads: checked })}
                  label="Enable parallel downloads"
                  description="Download multiple links or batch items concurrently."
                  variant="checkbox"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold text-muted mb-1">Max concurrent downloads</label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.maxConcurrentDownloads}
                  onChange={(e) => updateSettings({ maxConcurrentDownloads: parseInt(e.target.value) || 1 })}
                  disabled={!settings.enableConcurrentDownloads}
                  className="font-bold text-xs bg-panel disabled:opacity-50"
                />
                <p className="mt-1 text-[10px] font-mono text-muted">Keep between 2-3 to avoid rate limits from strict hosts.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-subtleborder">
              <div>
                <FormLabel text="Speed limit throttle" icon={Zap} iconColor="text-oshipink" />
                <Input
                  type="text"
                  value={settings.rateLimitSpeed}
                  onChange={(e) => updateSettings({ rateLimitSpeed: e.target.value })}
                  placeholder="e.g. 5M (Leave empty for max)"
                  className="bg-panel text-xs"
                />
                <p className="mt-1 text-[10px] font-mono text-muted">Optional download speed throttle (e.g. 5M = 5 MB/s, 500K = 500 KB/s).</p>
              </div>

              <div>
                <FormLabel text="Engine binary updates" icon={RefreshCcw} iconColor="text-toska" />
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isUpdatingYtDlp}
                    onClick={async () => {
                      setIsUpdatingYtDlp(true);
                      setUpdateNotice('');
                      try {
                        await YtDlpService.updateYtDlp(setUpdateNotice);
                        showToast('yt-dlp updated successfully.', 'success');
                      } catch (error) {
                        const detail = String(error);
                        setUpdateNotice(detail);
                        showToast('yt-dlp update failed.', 'error', detail);
                      } finally {
                        setIsUpdatingYtDlp(false);
                      }
                    }}
                    className="h-10 text-xs self-start"
                    size="md"
                    icon={RefreshCcw}
                  >
                    {isUpdatingYtDlp ? 'Updating engine...' : 'Check for yt-dlp update'}
                  </Button>
                  {updateNotice && <InlineNotice message={updateNotice} tone={updateNotice.startsWith('Update failed') ? 'error' : 'success'} />}
                </div>
              </div>
            </div>
          </div>

          {/* 4. KHINSIDER BROWSER */}
          <div className="bg-appbg border border-subtleborder rounded-2xl p-4 space-y-4">
            <h3 className="flex items-center gap-2 font-zen font-black text-ink text-sm border-b border-subtleborder pb-2">
              <Library className="w-4 h-4 text-toska" /> Game music (Khinsider)
            </h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <Toggle
                checked={settings.enableKhinsider}
                onChange={(checked) => updateSettings({ enableKhinsider: checked })}
                label="Enable Game Music navigation"
                description="Shows the Game Music tab on the navigation rail."
                variant="checkbox"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  void invoke('clear_khinsider_cache')
                    .then(() => showToast('Khinsider cache cleared.', 'success'))
                    .catch((error) => showToast('Could not clear Khinsider cache.', 'error', String(error)));
                }}
                className="shrink-0"
              >
                Clear music cache
              </Button>
            </div>
          </div>

          {/* 5. AUTHENTICATION & COOKIES */}
          <div className="bg-appbg border border-subtleborder rounded-2xl p-4 space-y-4">
            <div className="border-b border-subtleborder pb-2">
              <h3 className="flex items-center gap-2 font-zen font-black text-ink text-sm">
                <Shield className="w-4 h-4 text-oshipink" /> Authentication & cookies
              </h3>
            </div>
            <p className="text-xs font-mono text-muted leading-relaxed">
              Use cookies from an installed browser or export a Netscape format <code className="text-ink font-bold">cookies.txt</code> to download private or restricted streams.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FormLabel text="Browser session cookies" />
                <select 
                  value={settings.browserForCookies}
                  onChange={(e) => updateSettings({ browserForCookies: e.target.value, cookiesFilePath: '' })}
                  className="game-select font-bold text-xs bg-panel"
                >
                  <option value="">None (Public mode)</option>
                  <option value="chrome">Google Chrome</option>
                  <option value="firefox">Mozilla Firefox</option>
                  <option value="edge">Microsoft Edge</option>
                  <option value="brave">Brave Browser</option>
                  <option value="safari">Apple Safari</option>
                  <option value="opera">Opera</option>
                </select>
                <p className="mt-1 text-[10px] font-mono text-muted">Automatically reads session cookies from installed browser profile.</p>
              </div>
              
              <div>
                <FormLabel text="Or Netscape cookies.txt file" />
                <PathPicker 
                  value={settings.cookiesFilePath}
                  onChange={(path) => updateSettings({ cookiesFilePath: path })}
                  placeholder="No cookies file selected..."
                  directory={false}
                  filters={[{ name: 'Text Files', extensions: ['txt'] }]}
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] font-mono text-muted">Standard cookies.txt exported file</p>
                  {settings.cookiesFilePath && (
                    <button
                      type="button"
                      onClick={() => {
                        updateSettings({ cookiesFilePath: '' });
                        showToast('Cookies file path cleared.', 'info');
                      }}
                      className="text-[10px] font-mono font-bold text-oshipink underline hover:opacity-80"
                    >
                      Clear cookies file
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </PanelScrollArea>
      </Panel>
    </div>
  );
}
