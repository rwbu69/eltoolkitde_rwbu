import { useState, useEffect } from 'react';
import { Download, FolderOpen, CheckCircle2, Circle, Clock, X, Target, FileVideo, Gauge, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { YtDlpService, type VideoInfo } from '../services/ytdlp';
import { PageLayout, Column, SectionHeader, Panel, PanelScrollArea, FormLabel, PanelHeader } from './ui/Layout';
import { CustomSelect } from './ui/CustomSelect';
import { OptionGrid } from './ui/OptionGrid';
import { Button } from './ui/Button';
import { PathPicker } from './ui/PathPicker';
import { Tabs } from './ui/Tabs';
import { ProgressBar } from './ui/ProgressBar';
import { InlineNotice } from './ui/InlineNotice';
import { getStatusLabel, getUserFacingError } from '../config/uiText';
import { AUDIO_BITRATE_OPTIONS, VIDEO_QUALITY_OPTIONS, type AudioBitrate, type VideoQuality } from '../config/mediaSettings';

export default function DownloaderView() {
  const { settings, updateSettings, queue, addToQueue, retryItem, retryFailed, cancelItem, cancelAllDownloads, removeFromQueue, clearCompleted } = useAppStore();
  
  const [urlsInput, setUrlsInput] = useState('');
  const [format, setFormat] = useState<'mp4' | 'mp3' | 'video-only'>('mp4');
  const [outputDir, setOutputDir] = useState<string>(settings.defaultOutputDir || '');
  const [isInspecting, setIsInspecting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ urls: string[]; infos: VideoInfo[]; totalItems: number } | null>(null);
  const [notice, setNotice] = useState<string>('');

  useEffect(() => {
    if (!outputDir && settings.defaultOutputDir) {
      setOutputDir(settings.defaultOutputDir);
    }
  }, [settings.defaultOutputDir]);

  const parseUrls = () => urlsInput
    .split(/[\n\s]+/)
    .map(u => u.trim())
    .filter(u => u.length > 0);

  const queueInspectedUrls = (urls: string[], infos: VideoInfo[]) => {
    urls.forEach((url, index) => {
      addToQueue(url, format, Boolean(infos[index]?.isPlaylist));
    });
    setUrlsInput('');
    setConfirmation(null);
    setNotice('');
  };

  const handleDownload = async () => {
    if (!urlsInput.trim() || !outputDir) {
      setNotice(!outputDir ? 'Select an output folder before queueing downloads.' : 'Paste at least one media URL.');
      return;
    }

    const urls = parseUrls();
    setIsInspecting(true);
    setNotice('');
    try {
      const infos = await Promise.all(urls.map(url => YtDlpService.fetchVideoInfo(
        url,
        settings.cookiesFilePath,
        settings.browserForCookies
      )));
      const totalItems = infos.reduce((total, info) => total + (info.isPlaylist ? info.entries?.length ?? 0 : 1), 0);
      const needsConfirmation = urls.length > 1 || infos.some(info => info.isPlaylist) || totalItems > 10;
      if (needsConfirmation) {
        setConfirmation({ urls, infos, totalItems });
      } else {
        queueInspectedUrls(urls, infos);
      }
    } catch (error) {
      setNotice(getUserFacingError(error, 'The links could not be checked. Verify the URLs and try again.').message);
    } finally {
      setIsInspecting(false);
    }
  };

  const pendingCount = queue.filter(q => q.status === 'pending' || q.status === 'fetching').length;
  const downloadingCount = queue.filter(q => q.status === 'downloading').length;
  const completedCount = queue.filter(q => q.status === 'done').length;
  const failedCount = queue.filter(q => q.status === 'error').length;
  const canceledCount = queue.filter(q => q.status === 'canceled').length;
  const totalCount = queue.length;
  const hasActiveDownloads = queue.some(q => q.status === 'pending' || q.status === 'fetching' || q.status === 'downloading');
  const urlsCount = parseUrls().length;

  return (
    <PageLayout>
      {/* LEFT COLUMN: Input & Config */}
      <Column>
        <SectionHeader title="Download queue" />

        <Panel className="flex-1 flex flex-col min-w-0">
          <PanelScrollArea className="flex flex-col gap-5 pr-2">
            {/* Target URL */}
            <div className="space-y-2">
              <FormLabel text="Media URL(s)" icon={Target} />
              <textarea
                value={urlsInput}
                onChange={(e) => setUrlsInput(e.target.value)}
                placeholder="Paste a video, playlist, or multiple links. Separate multiple links with spaces or newlines."
                className="game-input min-h-[120px] py-3 resize-y w-full"
              />
              <span className="block text-[10px] font-mono text-muted px-1">
                Playlists and batches will be checked before they are added to the queue.
              </span>
            </div>
            
            {/* Format & Quality */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-5">
              <div className="min-w-0 flex flex-col">
                <FormLabel text="Format" icon={FileVideo} iconColor="text-toska" />
                <Tabs 
                  options={[
                    { value: 'mp4', label: 'MP4' },
                    { value: 'mp3', label: 'MP3' },
                    { value: 'video-only', label: 'Video only' }
                  ]}
                  value={format}
                  onChange={(val) => setFormat(val as any)}
                />
              </div>

              <div className="min-w-0 flex flex-col">
                {format !== 'mp3' ? (
                  <>
                    <FormLabel text="Video resolution" icon={FileVideo} iconColor="text-toska" />
                    <OptionGrid
                      options={VIDEO_QUALITY_OPTIONS}
                      value={settings.defaultVideoQuality}
                      onChange={(val) => updateSettings({ defaultVideoQuality: val as VideoQuality })}
                      ariaLabel="Video resolution"
                    />
                    <span className="text-[10px] font-mono text-muted mt-1 px-1">
                      (Falls back to next best if unavailable)
                    </span>
                  </>
                ) : (
                  <>
                    <FormLabel text="Audio bitrate" icon={Gauge} iconColor="text-toska" />
                    <CustomSelect 
                      options={[...AUDIO_BITRATE_OPTIONS]}
                      value={settings.defaultAudioBitrate}
                      onChange={(val) => updateSettings({ defaultAudioBitrate: val as AudioBitrate })}
                      className="shrink-0"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Output Dir */}
            <div className="space-y-2">
              <FormLabel text="Output folder" icon={FolderOpen} iconColor="text-muted" />
              <PathPicker 
                value={outputDir} 
                onChange={(path) => { setOutputDir(path); updateSettings({ defaultOutputDir: path }); }} 
                placeholder="Select output folder..." 
                directory={true}
              />
            </div>
          </PanelScrollArea>
            
          {/* Action Buttons */}
          <div className="pt-4 mt-4 border-t-4 border-appbg shrink-0">
            <Button
              variant="primary"
              fullWidth
              onClick={handleDownload}
              disabled={!urlsInput.trim() || !outputDir || isInspecting}
              icon={Download}
            >
              {isInspecting ? 'Checking links...' : `Check links${urlsCount ? ` (${urlsCount})` : ''}`}
            </Button>
            {notice && (
              <InlineNotice message={notice} tone="error" />
            )}
            {confirmation && (
              <div className="mt-3 rounded-xl border-2 border-toska bg-softtoska p-3 text-ink">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-toska" />
                  <div className="text-[11px] font-mono">
                    <p className="font-black">Review download job</p>
                    <p className="mt-1">
                      This will add approximately {confirmation.totalItems} item(s) from {confirmation.urls.length} link(s).
                    </p>
                    {confirmation.infos.some(info => info.isPlaylist) && (
                      <p className="mt-1 font-bold">
                        Playlist detected. Its entries will be added individually.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmation(null)}
                    className="flex-1 h-9 text-[10px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => queueInspectedUrls(confirmation.urls, confirmation.infos)}
                    className="flex-1 h-9 text-[10px]"
                  >
                    Queue downloads
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </Column>

      {/* RIGHT COLUMN: Global Queue Status */}
      <Column isSidebar>
        <SectionHeader title="Active queue" align="right" variant="secondary" />

        <Panel className="gap-3 bg-appbg h-[520px] xl:h-auto xl:min-h-0" noPadding>
          <PanelHeader className="flex-col items-stretch gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center">
                <span className="text-xl font-black font-zen text-ink leading-none">{downloadingCount}</span>
                <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-widest mt-1">Active</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-black font-zen text-ink leading-none">{pendingCount}</span>
                <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-widest mt-1">Pending</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-black font-zen text-toska leading-none">{completedCount}</span>
                <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-widest mt-1">Done</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-black font-zen text-oshipink leading-none">{failedCount}</span>
                <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-widest mt-1">Failed</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-black font-zen text-muted leading-none">{canceledCount}</span>
                <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-widest mt-1">Canceled</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-black font-zen text-ink leading-none">{totalCount}</span>
                <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-widest mt-1">Total</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="danger"
                onClick={cancelAllDownloads}
                disabled={!hasActiveDownloads}
                className="w-full px-3 py-1.5 h-auto text-xs font-zen font-black !rounded-xl"
                aria-label="Cancel active and pending downloads"
                title="Stops active downloads and prevents pending downloads from starting"
              >
                Cancel active
              </Button>
              <Button
                variant="secondary"
                onClick={retryFailed}
                disabled={failedCount === 0}
                className="w-full px-3 py-1.5 h-auto text-xs font-zen font-black !rounded-xl"
                aria-label={`Retry ${failedCount} failed downloads`}
                title="Adds every failed item back to the queue using its original settings"
              >
                Retry failed
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => clearCompleted(['done', 'expanded'])}
                disabled={!queue.some(q => q.status === 'done' || q.status === 'expanded')}
                className="w-full px-3 py-1.5 h-auto text-xs font-zen font-black !rounded-xl"
                aria-label="Clear completed downloads"
                title="Removes completed downloads and playlist expansion records"
              >
                Clear completed
              </Button>
              <Button
                variant="secondary"
                onClick={() => clearCompleted(['error', 'canceled'])}
                disabled={failedCount === 0 && canceledCount === 0}
                className="w-full px-3 py-1.5 h-auto text-xs font-zen font-black !rounded-xl"
                aria-label="Clear failed and canceled downloads"
                title="Removes failed and canceled queue records"
              >
                Clear issues
              </Button>
            </div>
            <span className="text-center text-[9px] font-mono text-muted">
              Cancel stops active work and prevents pending items from starting.
            </span>
          </PanelHeader>

          <PanelScrollArea className="flex flex-col gap-2 h-full p-2">
            {queue.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-ink py-10">
                <span className="font-zen font-bold text-lg">Queue is empty</span>
                <span className="font-mono text-xs mt-1 text-center">Add URLs to start downloading</span>
              </div>
            ) : (
              [...queue].reverse().map((item) => {
                let statusIcon = <Circle className="w-4 h-4 text-muted" />;
                let statusText = getStatusLabel('pending');
                let cardClass = 'bg-panel border-muted opacity-60';
                let textClass = 'text-muted';
                
                if (item.status === 'done') {
                  statusIcon = <CheckCircle2 className="w-4 h-4 text-buttontext" />;
                  statusText = getStatusLabel('done');
                  cardClass = 'bg-toska border-gameborder text-buttontext opacity-100';
                  textClass = 'text-buttontext';
                } else if (item.status === 'expanded') {
                  statusIcon = <CheckCircle2 className="w-4 h-4 text-buttontext" />;
                  statusText = getStatusLabel('expanded');
                  cardClass = 'bg-toska border-gameborder text-buttontext opacity-100';
                  textClass = 'text-buttontext';
                } else if (item.status === 'downloading' || item.status === 'fetching') {
                  statusIcon = <Clock className="w-4 h-4 text-ink" />;
                  statusText = getStatusLabel(item.status);
                  cardClass = 'bg-softtoska border-gameborder opacity-100 shadow-game-thin';
                  textClass = 'text-ink';
                } else if (item.status === 'error') {
                  statusIcon = <X className="w-4 h-4 text-buttontext" />;
                  statusText = getStatusLabel('error');
                  cardClass = 'bg-oshipink border-gameborder text-buttontext opacity-100';
                  textClass = 'text-buttontext';
                } else if (item.status === 'canceled') {
                  statusIcon = <X className="w-4 h-4 text-muted" />;
                  statusText = getStatusLabel('canceled');
                  cardClass = 'bg-panel border-muted opacity-100';
                  textClass = 'text-muted';
                }

                return (
                  <div key={item.id} className={`flex flex-col p-3 border-2 rounded-xl transition-all ${cardClass}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="shrink-0 mt-0.5">{statusIcon}</div>
                        <div className="flex-1 min-w-0">
                          <span className={`block font-mono font-black text-[9px] tracking-widest mb-0.5 ${textClass}`}>
                            {statusText} • {item.format.toUpperCase()}
                          </span>
                          <span className={`block text-xs font-bold truncate ${textClass}`} title={item.title || item.url}>
                            {item.title || item.url}
                          </span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => item.status === 'downloading' || item.status === 'fetching' || item.status === 'pending'
                          ? cancelItem(item.id)
                          : item.status === 'error' || item.status === 'canceled'
                            ? retryItem(item.id)
                            : removeFromQueue(item.id)}
                        className={`shrink-0 p-1 rounded-md opacity-50 hover:opacity-100 transition-opacity ${item.status === 'done' || item.status === 'error' || item.status === 'canceled' ? 'hover:bg-black/20' : 'hover:bg-panel/50 text-ink'}`}
                        aria-label={item.status === 'downloading' || item.status === 'fetching' || item.status === 'pending'
                          ? 'Cancel download'
                          : item.status === 'error' || item.status === 'canceled' ? 'Retry download' : 'Remove from queue'}
                        title={item.status === 'downloading' || item.status === 'fetching' || item.status === 'pending'
                          ? "Cancel download"
                          : item.status === 'error' || item.status === 'canceled' ? "Retry download" : "Remove from queue"}
                      >
                        {item.status === 'downloading' || item.status === 'fetching' || item.status === 'pending' ? (
                          <X className="w-4 h-4" />
                        ) : item.status === 'error' || item.status === 'canceled' ? (
                          <RotateCcw className="w-4 h-4" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {item.status === 'downloading' && item.progress && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-xs font-bold">{item.progress.speed || '--'}</span>
                          <span className="font-mono text-xs font-black">{item.progress.percent}%</span>
                        </div>
                        <ProgressBar percent={item.progress.percent} status={item.status} />
                        <div className="text-right mt-1">
                          <span className="font-mono text-[10px] font-bold opacity-70">ETA: {item.progress.eta || '--'}</span>
                        </div>
                      </div>
                    )}
                    
                    {item.status === 'error' && item.error && (
                      <div className="mt-2 text-[10px] font-mono font-bold bg-black/20 p-1.5 rounded-lg break-words max-h-[60px] overflow-y-auto">
                        {item.error}
                      </div>
                    )}
                    {item.status === 'expanded' && item.playlistItemCount && (
                      <div className="mt-2 text-[10px] font-mono font-bold opacity-75">
                        {item.playlistItemCount} child downloads added
                      </div>
                    )}
                    <details className="mt-2 text-[10px] font-mono">
                      <summary className="cursor-pointer font-bold opacity-70">Details</summary>
                      <div className="mt-1 break-all opacity-70">{item.url}</div>
                      <div className="mt-1 opacity-70">Format: {item.format.toUpperCase()}</div>
                    </details>
                  </div>
                );
              })
            )}
          </PanelScrollArea>
        </Panel>
      </Column>
    </PageLayout>
  );
}
