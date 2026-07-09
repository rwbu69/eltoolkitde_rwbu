import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { open } from '@tauri-apps/plugin-dialog';
import { YtDlpService } from '../services/ytdlp';
import { FolderOpen, Save, RefreshCw, FileText } from 'lucide-react';

export default function SettingsView() {
  const { settings, updateSettings } = useSettings();
  
  const [outputDir, setOutputDir] = useState(settings.defaultOutputDir);
  const [videoQuality, setVideoQuality] = useState(settings.defaultVideoQuality);
  const [audioBitrate, setAudioBitrate] = useState(settings.defaultAudioBitrate);
  const [cookiesFilePath, setCookiesFilePath] = useState(settings.cookiesFilePath || '');

  const [isUpdating, setIsUpdating] = useState(false);
  const [updateLog, setUpdateLog] = useState<string>('');

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        setOutputDir(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectCookies = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Text', extensions: ['txt'] }]
      });
      if (selected && typeof selected === 'string') {
        setCookiesFilePath(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = () => {
    updateSettings({
      defaultOutputDir: outputDir,
      defaultVideoQuality: videoQuality,
      defaultAudioBitrate: audioBitrate,
      cookiesFilePath: cookiesFilePath
    });
    alert('Settings saved successfully!');
  };

  const handleUpdateYtdlp = async () => {
    setIsUpdating(true);
    setUpdateLog('Starting yt-dlp update...\n');
    try {
      await YtDlpService.updateYtDlp((log) => {
        setUpdateLog(prev => prev + log + '\n');
      });
    } catch (e: any) {
      setUpdateLog(prev => prev + `\nError: ${e.message || String(e)}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div>
      <header className="mb-8">
        <h2 className="text-2xl font-semibold text-zinc-100">Settings</h2>
        <p className="text-zinc-400 mt-1">Configure your preferences and maintenance tools.</p>
      </header>
      
      <div className="space-y-6">
        <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-lg space-y-6">
          <h3 className="text-lg font-medium text-zinc-200 border-b border-zinc-800/80 pb-2">Global Preferences</h3>
          
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Default Output Directory
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={outputDir}
                readOnly
                placeholder="No default folder selected..."
                className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none placeholder:text-zinc-600 transition-colors"
              />
              <button 
                onClick={handleSelectFolder}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors flex items-center justify-center text-zinc-300"
              >
                <FolderOpen className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">If set, this folder will be automatically used in Downloader and FFmpeg tools.</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Default Video Quality
              </label>
              <select 
                value={videoQuality}
                onChange={(e) => setVideoQuality(e.target.value as any)}
                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:border-rose-500 appearance-none transition-colors"
              >
                <option value="best">Best (Highest Available)</option>
                <option value="mid">Mid (Max 720p)</option>
                <option value="low">Low (Max 480p/360p)</option>
              </select>
              <p className="text-xs text-zinc-500 mt-1">Default resolution when downloading MP4/Video.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Default Audio Bitrate
              </label>
              <select 
                value={audioBitrate}
                onChange={(e) => setAudioBitrate(e.target.value as any)}
                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:border-rose-500 appearance-none transition-colors"
              >
                <option value="320k">320 kbps (High Quality)</option>
                <option value="256k">256 kbps (Standard Quality)</option>
                <option value="192k">192 kbps (Smaller File Size)</option>
              </select>
              <p className="text-xs text-zinc-500 mt-1">Default bitrate when downloading or converting to MP3.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Cookies File (cookies.txt)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cookiesFilePath}
                readOnly
                placeholder="Select cookies.txt to bypass age-restrictions..."
                className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none placeholder:text-zinc-600 transition-colors"
              />
              <button 
                onClick={handleSelectCookies}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors flex items-center justify-center text-zinc-300"
              >
                <FileText className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">Optional. Required for age-restricted or members-only videos.</p>
          </div>

          <div className="flex justify-end pt-4">
            <button 
              onClick={handleSave}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>
          </div>
        </div>

        <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-lg space-y-4">
          <h3 className="text-lg font-medium text-zinc-200 border-b border-zinc-800/80 pb-2">Maintenance</h3>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-zinc-300">Update yt-dlp</h4>
              <p className="text-sm text-zinc-500">YouTube frequently breaks third-party downloaders. Run this if downloads start failing.</p>
            </div>
            <button 
              onClick={handleUpdateYtdlp}
              disabled={isUpdating}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium rounded-lg transition-colors border border-zinc-800 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Updating...' : 'Update Now'}
            </button>
          </div>

          {updateLog && (
            <div className="mt-4 p-4 bg-zinc-950/50 border border-zinc-800 rounded-lg max-h-48 overflow-y-auto font-mono text-xs text-zinc-400 whitespace-pre-wrap">
              {updateLog}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
