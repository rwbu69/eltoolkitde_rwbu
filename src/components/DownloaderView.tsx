import { useState, useEffect } from 'react';
import { Download, FolderOpen, Target, Gauge, CheckCircle2, FileVideo, AlertTriangle } from 'lucide-react';
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
import { parseYtDlpError } from '../config/uiText';
import { AUDIO_BITRATE_OPTIONS, VIDEO_QUALITY_OPTIONS, type AudioBitrate, type VideoQuality } from '../config/mediaSettings';
import { DOWNLOAD_PRESETS, type DownloadPresetId } from '../config/downloadPresets';
import { showToast } from './ui/Toast';
import { SegmentedDeck } from './ui/SegmentedDeck';
import { QueueItemCard } from './downloader/QueueItemCard';

const MAX_PLAYLIST_ITEMS = 500;

export default function DownloaderView() {
  const settings = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);
  const queue = useAppStore(s => s.queue);
  const isQueuePaused = useAppStore(s => s.isQueuePaused);
  const pauseReason = useAppStore(s => s.pauseReason);
  const resumeQueue = useAppStore(s => s.resumeQueue);
  const addToQueue = useAppStore(s => s.addToQueue);
  const addBatchToQueue = useAppStore(s => s.addBatchToQueue);
  const retryItem = useAppStore(s => s.retryItem);
  const retryFailed = useAppStore(s => s.retryFailed);
  const cancelItem = useAppStore(s => s.cancelItem);
  const cancelAllDownloads = useAppStore(s => s.cancelAllDownloads);
  const removeFromQueue = useAppStore(s => s.removeFromQueue);
  const clearCompleted = useAppStore(s => s.clearCompleted);
  
  const [urlsInput, setUrlsInput] = useState('');
  const [format, setFormat] = useState<'mp4' | 'mp3' | 'video-only'>('mp4');
  const [preset, setPreset] = useState<DownloadPresetId | 'custom'>('custom');
  const [outputDir, setOutputDir] = useState<string>(settings.defaultOutputDir || '');
  const [isInspecting, setIsInspecting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ urls: string[]; infos: VideoInfo[]; totalItems: number } | null>(null);
  const [notice, setNotice] = useState<string>('');
  const [queueFilter, setQueueFilter] = useState<'all' | 'active' | 'failed' | 'completed'>('all');
  const [mobileDeck, setMobileDeck] = useState<'setup' | 'queue'>('setup');

  useEffect(() => {
    if (!outputDir && settings.defaultOutputDir) {
      setOutputDir(settings.defaultOutputDir);
    }
  }, [outputDir, settings.defaultOutputDir]);

  const parseUrls = () => urlsInput
    .split(/[\n\s]+/)
    .map(u => u.trim())
    .filter(u => u.length > 0);

  const getUniqueUrls = (urls: string[]) => [...new Set(urls)];

  const applyPreset = (presetId: DownloadPresetId | 'custom') => {
    setPreset(presetId);
    if (presetId === 'custom') return;
    const selected = DOWNLOAD_PRESETS.find(item => item.id === presetId);
    if (!selected) return;
    setFormat(selected.format);
    if (selected.videoQuality) updateSettings({ defaultVideoQuality: selected.videoQuality });
    if (selected.audioBitrate) updateSettings({ defaultAudioBitrate: selected.audioBitrate });
  };

  const queueInspectedUrls = (urls: string[], infos: VideoInfo[]) => {
    infos.forEach((info, index) => {
      const url = urls[index];
      if (info.isPlaylist && info.entries && info.entries.length > 0) {
        addBatchToQueue(
          info.entries.map(e => ({
            url: e.url || (e.id && e.id.length === 11 ? `https://www.youtube.com/watch?v=${e.id}` : e.id),
            title: e.title || e.id
          })),
          format,
          undefined,
          info.title
        );
      } else {
        addToQueue(url, format, false, undefined, info.title);
      }
    });
    setUrlsInput('');
    setConfirmation(null);
    setNotice('');
    setMobileDeck('queue');
  };

  const handleDownload = async () => {
    if (!urlsInput.trim() || !outputDir) {
      showToast(!outputDir ? 'Select an output folder before queueing downloads.' : 'Paste at least one media URL.', 'warning');
      return;
    }

    const enteredUrls = parseUrls();
    const urls = getUniqueUrls(enteredUrls);
    if (urls.length === 0) {
      showToast('Enter at least one valid-looking URL.', 'warning');
      return;
    }
    setIsInspecting(true);
    setNotice(enteredUrls.length !== urls.length
      ? `${enteredUrls.length - urls.length} duplicate URL(s) removed before inspection.`
      : '');
    try {
      const infos: VideoInfo[] = [];
      for (let i = 0; i < urls.length; i++) {
        const info = await YtDlpService.fetchVideoInfo(
          urls[i],
          settings.cookiesFilePath,
          settings.browserForCookies
        );
        infos.push(info);
        if (urls.length > 1 && i < urls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
      const totalItems = infos.reduce((total, info) => total + (info.isPlaylist ? info.entries?.length ?? 0 : 1), 0);
      if (totalItems > MAX_PLAYLIST_ITEMS) {
        showToast(`This batch contains ${totalItems} items.`, 'warning', `The maximum supported playlist size is ${MAX_PLAYLIST_ITEMS}.`);
        return;
      }
      const needsConfirmation = urls.length > 1 || infos.some(info => info.isPlaylist) || totalItems > 10;
      if (needsConfirmation) {
        setConfirmation({ urls, infos, totalItems });
      } else {
        queueInspectedUrls(urls, infos);
      }
    } catch (error) {
      const friendly = parseYtDlpError(error, 'The links could not be checked.');
      showToast(friendly.message, 'error', friendly.detail);
      if (friendly.isRateLimit) {
        setNotice(friendly.detail || friendly.message);
      }
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
  const finishedCount = queue.filter(q => q.status === 'done' || q.status === 'error' || q.status === 'canceled' || q.status === 'expanded').length;
  const overallProgress = totalCount === 0 ? 0 : Math.round((finishedCount / totalCount) * 100);
  const visibleQueue = queue.filter((item) => {
    if (queueFilter === 'active') return item.status === 'pending' || item.status === 'fetching' || item.status === 'downloading';
    if (queueFilter === 'failed') return item.status === 'error' || item.status === 'canceled';
    if (queueFilter === 'completed') return item.status === 'done' || item.status === 'expanded';
    return true;
  });
  const hasActiveDownloads = queue.some(q => q.status === 'pending' || q.status === 'fetching' || q.status === 'downloading');
  const urlsCount = parseUrls().length;

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      {/* Mobile-only Segmented Deck Switcher */}
      <div className="xl:hidden mb-3 flex-none">
        <SegmentedDeck<'setup' | 'queue'>
          options={[
            { id: 'setup', label: 'Add Links', icon: Download },
            { id: 'queue', label: 'Queue', icon: Target, count: queue.length },
          ]}
          activeId={mobileDeck}
          onChange={setMobileDeck}
        />
      </div>

      <div className="flex-1 min-h-0 w-full">
        <PageLayout>
          {/* LEFT COLUMN: Input & Config */}
          <Column className={mobileDeck === 'setup' ? 'flex' : 'hidden xl:flex'}>
            <SectionHeader title="Download setup" />

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
              <div className="flex items-center justify-between text-[10px] font-mono px-1">
                <span className="text-muted">
                  Playlists and batches will be checked before they are added to the queue.
                </span>
                {settings.cookiesFilePath || settings.browserForCookies ? (
                  <span className="text-toska font-bold flex items-center gap-1" title="Cookies configured in settings">
                    <CheckCircle2 className="w-3 h-3" /> Authenticated mode
                  </span>
                ) : (
                  <span className="text-muted opacity-70" title="No cookies configured in Settings">
                    Public mode (No cookies)
                  </span>
                )}
              </div>
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
                  onChange={(val) => { setPreset('custom'); setFormat(val as any); }}
                />
              </div>

              <div className="min-w-0 flex flex-col">
                {format !== 'mp3' ? (
                  <>
                    <FormLabel text="Video resolution" icon={FileVideo} iconColor="text-toska" />
                    <OptionGrid
                      options={VIDEO_QUALITY_OPTIONS}
                      value={settings.defaultVideoQuality}
                      onChange={(val) => { setPreset('custom'); updateSettings({ defaultVideoQuality: val as VideoQuality }); }}
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
                      onChange={(val) => { setPreset('custom'); updateSettings({ defaultAudioBitrate: val as AudioBitrate }); }}
                      className="shrink-0"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Output Dir */}
            <div className="space-y-2">
              <FormLabel text="Quick preset" icon={Gauge} iconColor="text-toska" />
              <select
                value={preset}
                onChange={(event) => applyPreset(event.target.value as DownloadPresetId | 'custom')}
                className="game-select font-bold"
                aria-label="Download preset"
              >
                <option value="custom">Custom</option>
                {DOWNLOAD_PRESETS.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>

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
      <Column isSidebar className={mobileDeck === 'queue' ? 'flex' : 'hidden xl:flex'}>
        <SectionHeader title="Active queue" align="right" variant="secondary" />

        <Panel className="gap-3 bg-appbg h-[520px] xl:h-auto xl:min-h-0" noPadding>
          <PanelHeader className="flex-col items-stretch gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono font-bold text-muted uppercase">Show queue</span>
              <select
                value={queueFilter}
                onChange={(event) => setQueueFilter(event.target.value as typeof queueFilter)}
                className="game-select h-8 py-1 text-[10px] font-bold"
                aria-label="Filter download queue"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="failed">Failed / canceled</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center">
                <span className="text-xl font-black font-zen text-ink leading-none">{downloadingCount}</span>
                <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-widest mt-1">Active</span>
              </div>
              {totalCount > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-mono font-bold text-muted uppercase">
                    <span>Batch progress</span>
                    <span>{finishedCount}/{totalCount} · {overallProgress}%</span>
                  </div>
                  <ProgressBar percent={overallProgress} status={overallProgress === 100 ? 'done' : 'downloading'} />
                </div>
              )}
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
            {isQueuePaused && (
              <div className="rounded-xl border-2 border-oshipink bg-softpink p-3 text-ink shadow-game-thin animate-pulse">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-oshipink mt-0.5" />
                    <div className="text-[11px] font-mono">
                      <p className="font-bold text-oshipink uppercase tracking-wider">Queue Paused</p>
                      <p className="mt-0.5 text-ink font-medium">{pauseReason || 'Rate limit detected. Queue paused to protect your IP.'}</p>
                      <p className="mt-1 text-[10px] text-muted">Wait a few minutes, or attach a cookies file in Settings to continue.</p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    onClick={resumeQueue}
                    className="h-8 text-[10px] px-3 shrink-0"
                  >
                    Resume
                  </Button>
                </div>
              </div>
            )}
            {visibleQueue.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-ink py-10">
                <span className="font-zen font-bold text-lg">Queue is empty</span>
                <span className="font-mono text-xs mt-1 text-center">
                  {queue.length === 0 ? 'Add URLs to start downloading' : 'No items match this filter'}
                </span>
              </div>
            ) : (
              [...visibleQueue].reverse().map((item) => (
                <QueueItemCard
                  key={item.id}
                  item={item}
                  onCancel={cancelItem}
                  onRetry={retryItem}
                  onRemove={removeFromQueue}
                />
              ))
            )}
          </PanelScrollArea>
        </Panel>
      </Column>
    </PageLayout>
      </div>
    </div>
  );
}
