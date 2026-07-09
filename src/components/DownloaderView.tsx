import { useState, useEffect } from 'react';
import { Download, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { YtDlpService, DownloadProgress, VideoInfo } from '../services/ytdlp';
import { useSettings } from '../hooks/useSettings';

export default function DownloaderView() {
  const { settings } = useSettings();
  
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<'mp4' | 'mp3' | 'video-only'>('mp4');
  
  // Use default from settings if available
  const [outputDir, setOutputDir] = useState<string>(settings.defaultOutputDir || '');
  const [videoQuality, setVideoQuality] = useState<'best' | 'mid' | 'low'>(settings.defaultVideoQuality);

  // If settings change, sync them up if outputDir is empty
  useEffect(() => {
    if (!outputDir && settings.defaultOutputDir) {
      setOutputDir(settings.defaultOutputDir);
    }
  }, [settings.defaultOutputDir]);
  
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

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

  const handleFetch = async () => {
    if (!url) return;
    setIsFetching(true);
    setErrorMsg('');
    try {
      const data = await YtDlpService.fetchVideoInfo(url, settings.cookiesFilePath);
      setInfo(data);
    } catch (e: any) {
      setErrorMsg(e.message || String(e));
    } finally {
      setIsFetching(false);
    }
  };

  const handleDownload = async () => {
    if (!url || !outputDir) {
      setErrorMsg('URL and Output Directory are required.');
      return;
    }
    
    setErrorMsg('');
    try {
      await YtDlpService.downloadMedia(
        { 
          url, 
          format, 
          outputDir,
          videoQuality,
          audioBitrate: settings.defaultAudioBitrate,
          cookiesFilePath: settings.cookiesFilePath
        },
        (prog) => setProgress(prog)
      );
    } catch (e: any) {
      setErrorMsg(e.message || String(e));
      setProgress(p => p ? { ...p, status: 'error' } : null);
    }
  };

  return (
    <>
      <header className="mb-8">
        <h2 className="text-2xl font-semibold text-zinc-100">Media Downloader</h2>
        <p className="text-zinc-400 mt-1">Download videos and audio using yt-dlp.</p>
      </header>

      <div className="max-w-2xl bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-6">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Video URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/..."
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none focus:border-rose-500 transition-colors placeholder:text-zinc-600"
            />
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Format
              </label>
              <div className="flex bg-zinc-950/50 border border-zinc-800 rounded-lg p-1">
                {(['mp4', 'mp3', 'video-only'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      format === f 
                        ? 'bg-rose-600 text-white shadow-sm' 
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {format !== 'mp3' && (
              <div className="w-full md:w-1/3">
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Video Quality
                </label>
                <div className="flex bg-zinc-950/50 border border-zinc-800 rounded-lg p-1">
                  <button
                    onClick={() => setVideoQuality('best')}
                    title="Best (Highest Available)"
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${videoQuality === 'best' ? 'bg-rose-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
                  >
                    Best
                  </button>
                  <button
                    onClick={() => setVideoQuality('mid')}
                    title="Mid (Max 720p)"
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${videoQuality === 'mid' ? 'bg-rose-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
                  >
                    Mid
                  </button>
                  <button
                    onClick={() => setVideoQuality('low')}
                    title="Low (Max 480p/360p)"
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${videoQuality === 'low' ? 'bg-rose-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
                  >
                    Low
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Output Directory
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={outputDir}
                readOnly
                placeholder="Select output folder..."
                className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none placeholder:text-zinc-600"
              />
              <button 
                onClick={handleSelectFolder}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors flex items-center justify-center text-zinc-300"
                title="Select Folder"
              >
                <FolderOpen className="w-5 h-5" />
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {errorMsg}
            </div>
          )}

          {info && (
            <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-zinc-200 truncate" title={info.title}>{info.title}</h4>
                <p className="text-xs text-zinc-500 mt-0.5">Ready to download</p>
              </div>
            </div>
          )}

          {progress && (
            <div className="p-4 rounded-lg bg-zinc-950/50 border border-zinc-800">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-300 capitalize">{progress.status}...</span>
                <span className="text-rose-400 font-medium">{progress.percent}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${progress.status === 'error' ? 'bg-red-500' : progress.status === 'done' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-zinc-500 mt-2">
                <span>{progress.speed}</span>
                <span>{progress.eta}</span>
              </div>
            </div>
          )}
            
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800/50 mt-2">
            <button 
              onClick={handleFetch}
              disabled={isFetching || !url}
              className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium rounded-lg border border-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFetching ? 'Fetching Info...' : 'Fetch Info'}
            </button>
            <button 
              onClick={handleDownload}
              disabled={!url || !outputDir || progress?.status === 'downloading' || progress?.status === 'starting'}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
