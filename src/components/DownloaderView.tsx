import { useState, useEffect } from 'react';
import { Download, FolderOpen, ChevronDown, ChevronUp, CheckCircle2, Circle, Clock, X, Target, Disc } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { YtDlpService, DownloadProgress, VideoInfo } from '../services/ytdlp';
import { useSettings } from '../hooks/useSettings';
import { PageLayout, Column, SectionHeader, Panel, PanelScrollArea, FormLabel } from './ui/Layout';

export default function DownloaderView() {
  const { settings } = useSettings();
  
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<'mp4' | 'mp3' | 'video-only'>('mp4');
  
  const [outputDir, setOutputDir] = useState<string>(settings.defaultOutputDir || '');
  const [videoQuality, setVideoQuality] = useState<'best' | 'mid' | 'low'>(settings.defaultVideoQuality);

  useEffect(() => {
    if (!outputDir && settings.defaultOutputDir) {
      setOutputDir(settings.defaultOutputDir);
    }
  }, [settings.defaultOutputDir]);
  
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [cancelFn, setCancelFn] = useState<(() => void) | null>(null);
  const [isPlaylistExpanded, setIsPlaylistExpanded] = useState(false);

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
      const data = await YtDlpService.fetchVideoInfo(url, settings.cookiesFilePath, settings.browserForCookies);
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
      const { task, cancel } = await YtDlpService.downloadMedia(
        { 
          url, 
          format, 
          outputDir,
          videoQuality,
          audioBitrate: settings.defaultAudioBitrate,
          cookiesFilePath: settings.cookiesFilePath,
          browserForCookies: settings.browserForCookies
        },
        (prog) => setProgress(prog)
      );
      setCancelFn(() => cancel);
      await task;
      setCancelFn(null);
    } catch (e: any) {
      const errMsg = e.message || String(e);
      if (errMsg.includes('killed') || errMsg.includes('exit') || errMsg.includes('1')) {
        setErrorMsg('Download canceled.');
        setProgress(null);
      } else {
        setErrorMsg(errMsg);
        setProgress(p => p ? { ...p, status: 'error' } : null);
      }
      setCancelFn(null);
    }
  };

  const handleCancel = () => {
    if (cancelFn) {
      cancelFn();
      setCancelFn(null);
      setProgress(null);
      setErrorMsg('Download canceled by user.');
    }
  };

  return (
    <PageLayout>
      {/* LEFT COLUMN: Input & Config */}
      <Column>
        <SectionHeader title="DOWNLOADER" />

        <Panel className="flex flex-col">
          <PanelScrollArea className="flex flex-col gap-4 pr-2">
            {/* Target URL */}
            <div>
              <FormLabel text="MEDIA URL" icon={Target} />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste youtube link here..."
                className="game-input"
              />
            </div>
            
            {/* Format & Quality */}
            <div className="flex flex-col xl:flex-row gap-4">
              <div className="flex-1 min-w-0">
                <FormLabel text="FORMAT" icon={Disc} iconColor="text-toska" />
                <div className="flex bg-appbg border-4 border-ink rounded-2xl p-1 shadow-[inset_0_4px_0_0_rgba(165,151,176,0.1)] h-12">
                  {(['mp4', 'mp3', 'video-only'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`flex-1 text-[11px] font-bold rounded-xl transition-all font-zen uppercase tracking-wide truncate ${
                        format === f 
                          ? 'bg-oshipink text-white shadow-sm border-2 border-transparent' 
                          : 'text-ink hover:bg-white border-2 border-transparent'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {format !== 'mp3' && (
                <div className="w-full xl:w-1/3 shrink-0">
                  <FormLabel text="QUALITY" icon={Disc} iconColor="text-toska" />
                  <select 
                    value={videoQuality} 
                    onChange={(e) => setVideoQuality(e.target.value as any)}
                    className="game-select font-bold"
                  >
                    <option value="best">BEST</option>
                    <option value="mid">MID</option>
                    <option value="low">LOW</option>
                  </select>
                </div>
              )}
            </div>

            {/* Output Dir */}
            <div>
              <FormLabel text="OUTPUT FOLDER" icon={FolderOpen} iconColor="text-muted" />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={outputDir}
                  readOnly
                  placeholder="Select output folder..."
                  className="game-input"
                />
                <button 
                  onClick={handleSelectFolder}
                  className="game-btn-secondary px-4 h-12 flex items-center justify-center shrink-0"
                  title="Select Folder"
                >
                  <FolderOpen className="w-5 h-5" />
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-softpink border-4 border-ink font-bold flex items-start gap-2 text-xs shrink-0">
                <X className="w-4 h-4 text-oshipink shrink-0 mt-0.5" />
                <span className="text-ink">{errorMsg}</span>
              </div>
            )}
          </PanelScrollArea>
            
          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 mt-3 border-t-4 border-appbg shrink-0">
            {progress?.status === 'downloading' || progress?.status === 'starting' ? (
              <button 
                onClick={handleCancel}
                className="game-btn-secondary w-full h-[48px] font-zen font-black text-base flex justify-center items-center gap-2 text-oshipink"
              >
                <X className="w-5 h-5" /> ABORT
              </button>
            ) : (
              <>
                <button 
                  onClick={handleFetch}
                  disabled={isFetching || !url}
                  className="game-btn-secondary px-6 h-[48px] font-zen font-black text-sm flex items-center gap-2"
                >
                  {isFetching ? '...' : 'FETCH'}
                </button>
                <button 
                  onClick={handleDownload}
                  disabled={!url || !outputDir || progress?.status === 'downloading' || progress?.status === 'starting'}
                  className="game-btn-primary flex-1 h-[48px] font-zen font-black text-base flex justify-center items-center gap-2"
                >
                  <Download className="w-5 h-5" /> DOWNLOAD
                </button>
              </>
            )}
          </div>
        </Panel>
      </Column>

      {/* RIGHT COLUMN: Quest Board / Status */}
      <Column isSidebar>
        <SectionHeader title="MEDIA_INFO" align="right" variant="secondary" />

        <Panel className="gap-4">
          {!info && !progress && (
            <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-ink">
              <span className="font-zen font-bold text-lg">No Media Selected</span>
              <span className="font-mono text-xs mt-1 text-center">Fetch a URL to see media information</span>
            </div>
          )}

          {/* Progress Banner */}
          {progress && (
            <div className="bg-softtoska border-4 border-ink rounded-[1.5rem] p-5 relative overflow-hidden shrink-0">
              <div className="flex items-center justify-between mb-4 relative z-10">
                <span className="text-xl font-black font-zen text-ink capitalize">{progress.status}...</span>
                <span className="font-mono text-3xl font-black text-toska">{progress.percent}<span className="text-lg">%</span></span>
              </div>
              
              <div className="relative w-full h-6 p-1 overflow-hidden border-4 rounded-full bg-appbg border-ink z-10">
                <div className="h-full bg-toska rounded-full relative overflow-hidden transition-all duration-300" style={{ width: `${progress.percent}%` }}>
                  <div className="absolute top-0 left-0 w-full h-1/3 bg-white/30"></div>
                </div>
              </div>
              
              <div className="flex justify-between text-xs font-mono font-bold text-ink mt-3 relative z-10">
                <span>{progress.speed || '--'}</span>
                <span>{progress.eta || '--'}</span>
              </div>
              
              {progress.status === 'done' && (
                <div className="absolute -right-4 -bottom-4 opacity-20 pointer-events-none">
                  <CheckCircle2 className="w-24 h-24 text-toska" />
                </div>
              )}
            </div>
          )}

          {/* Video Info Panel */}
          {info && (
            <div className="bg-appbg border-4 border-ink rounded-2xl p-4 flex flex-col gap-2 shrink-0">
              <h4 className="text-sm font-bold font-inter text-ink line-clamp-2" title={info.title}>{info.title}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono font-black text-[10px] bg-ink text-white px-2 py-0.5 rounded-full border border-ink tracking-widest">TARGET</span>
                <span className="text-xs font-bold text-muted">{info.isPlaylist ? `Playlist (${info.entries?.length || 0} items)` : 'Single Media'}</span>
              </div>

              {/* Playlist Details */}
              {info.isPlaylist && (
                <div className="mt-2 flex flex-col min-h-0">
                  <button 
                    onClick={() => setIsPlaylistExpanded(!isPlaylistExpanded)}
                    className="w-full flex items-center justify-between text-xs font-bold font-mono text-ink bg-white border-2 border-ink rounded-lg px-3 py-2 shrink-0"
                  >
                    <span>VIEW PLAYLIST ITEMS</span>
                    {isPlaylistExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  {isPlaylistExpanded && info.entries && (
                    <PanelScrollArea className="mt-2 flex flex-col gap-2">
                      {info.entries.map((item, idx) => {
                        let statusIcon = <Circle className="w-4 h-4 text-muted" />;
                        let statusText = 'PENDING';
                        let cardClass = 'bg-white border-muted opacity-60';
                        let textClass = 'text-muted';
                        
                        if (progress?.playlistCurrent) {
                          const currentIdx = progress.playlistCurrent;
                          if (idx + 1 < currentIdx || progress.status === 'done') {
                            statusIcon = <CheckCircle2 className="w-4 h-4 text-white" />;
                            statusText = 'CLEARED';
                            cardClass = 'bg-toska border-ink text-white opacity-100';
                            textClass = 'text-white';
                          } else if (idx + 1 === currentIdx && progress.status !== 'error') {
                            statusIcon = <Clock className="w-4 h-4 text-ink" />;
                            statusText = 'PROCESSING';
                            cardClass = 'bg-softtoska border-ink opacity-100 shadow-game-thin';
                            textClass = 'text-ink';
                          }
                        }

                        return (
                          <div key={item.id || idx} className={`flex items-center gap-3 p-3 border-2 rounded-xl transition-all ${cardClass}`}>
                            <div className="shrink-0">
                              {statusIcon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={`block font-mono font-black text-[10px] tracking-widest mb-0.5 ${textClass}`}>{statusText}</span>
                              <span className={`block text-xs font-bold truncate ${textClass}`} title={item.title}>
                                {item.title}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </PanelScrollArea>
                  )}
                </div>
              )}
            </div>
          )}

        </Panel>
      </Column>
    </PageLayout>
  );
}
