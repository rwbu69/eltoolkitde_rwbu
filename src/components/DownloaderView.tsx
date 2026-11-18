import { useState, useEffect } from 'react';
import { Download, FolderOpen, Target, Gauge, FileVideo, AlertTriangle, RotateCw, XCircle, Check, Trash2, Globe, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { YtDlpService, type VideoInfo } from '../services/ytdlp';
import { PageLayout, Column, Panel, PanelScrollArea, FormLabel, PanelHeader } from './ui/Layout';
import { CustomSelect } from './ui/CustomSelect';
import { Button } from './ui/Button';
import { PathPicker } from './ui/PathPicker';
import { Tabs } from './ui/Tabs';
import { ProgressBar } from './ui/ProgressBar';
import { InlineNotice } from './ui/InlineNotice';
import { parseYtDlpError } from '../config/uiText';
import { AUDIO_BITRATE_OPTIONS, VIDEO_QUALITY_OPTIONS, type AudioBitrate, type VideoQuality } from '../config/mediaSettings';
import { DOWNLOAD_PRESETS, type DownloadPresetId } from '../config/downloadPresets';
import { showToast } from './ui/Toast';
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
      <div className="flex-1 min-h-0 w-full">
        <PageLayout>
          {/* LEFT COLUMN: Input & Config */}
          <Column>
            <div className="flex items-center justify-between px-1 select-none">
              <div className="flex items-center gap-1.5">
                <Download className="w-4 h-4 text-oshipink" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink">Download Setup</span>
              </div>
            </div>

            <Panel className="flex-1 flex flex-col min-w-0">
              <PanelScrollArea className="flex flex-col gap-4">
                {/* Target URL */}
                <div className="space-y-1.5">
                  <FormLabel text="Media URL(s)" icon={Target} />
                  <textarea
                    value={urlsInput}
                    onChange={(e) => setUrlsInput(e.target.value)}
                    placeholder="Paste YouTube, TikTok, X, Twitch, or media links (separated by spaces or newlines)..."
                    className="game-input !h-auto min-h-[110px] py-2.5 resize-y w-full text-xs font-mono"
                  />
                </div>
                
                {/* 2x2 Unified Media Controls Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Row 1, Col 1: Format */}
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

                  {/* Row 1, Col 2: Resolution / Bitrate */}
                  <div className="min-w-0 flex flex-col">
                    {format !== 'mp3' ? (
                      <>
                        <FormLabel text="Video resolution" icon={Gauge} iconColor="text-toska" />
                        <CustomSelect
                          options={[...VIDEO_QUALITY_OPTIONS]}
                          value={settings.defaultVideoQuality}
                          onChange={(val) => { setPreset('custom'); updateSettings({ defaultVideoQuality: val as VideoQuality }); }}
                          className="w-full shrink-0"
                        />
                      </>
                    ) : (
                      <>
                        <FormLabel text="Audio bitrate" icon={Gauge} iconColor="text-toska" />
                        <CustomSelect 
                          options={[...AUDIO_BITRATE_OPTIONS]}
                          value={settings.defaultAudioBitrate}
                          onChange={(val) => { setPreset('custom'); updateSettings({ defaultAudioBitrate: val as AudioBitrate }); }}
                          className="w-full shrink-0"
                        />
                      </>
                    )}
                  </div>

                  {/* Row 2, Col 1: Download preset */}
                  <div className="min-w-0 flex flex-col">
                    <FormLabel text="Download preset" icon={Gauge} iconColor="text-toska" />
                    <CustomSelect
                      options={[
                        { value: 'custom', label: 'Custom settings' },
                        ...DOWNLOAD_PRESETS.map((option) => ({ value: option.id, label: option.label }))
                      ]}
                      value={preset}
                      onChange={(val) => applyPreset(val as DownloadPresetId | 'custom')}
                      className="w-full shrink-0"
                    />
                  </div>

                  {/* Row 2, Col 2: Output folder */}
                  <div className="min-w-0 flex flex-col">
                    <FormLabel text="Output folder" icon={FolderOpen} iconColor="text-toska" />
                    <PathPicker 
                      value={outputDir} 
                      onChange={(path) => { setOutputDir(path); updateSettings({ defaultOutputDir: path }); }} 
                      placeholder="Select output folder..." 
                      directory={true}
                    />
                  </div>
                </div>
              </PanelScrollArea>
                
              {/* Action Buttons */}
              <div className="pt-3 mt-3 border-t-2 border-subtleborder shrink-0">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleDownload}
                  disabled={!urlsInput.trim() || !outputDir || isInspecting}
                  icon={Download}
                >
                  {isInspecting ? 'Inspecting links...' : `Check links${urlsCount ? ` (${urlsCount})` : ''}`}
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
                            Playlist detected. Entries will be queued individually.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmation(null)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => queueInspectedUrls(confirmation.urls, confirmation.infos)}
                        className="flex-1"
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
            <div className="flex items-center justify-between px-1 select-none">
              <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-toska" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink">Active Queue</span>
              </div>
              {totalCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-panel border-2 border-subtleborder text-oshipink">
                  {finishedCount}/{totalCount} done
                </span>
              )}
            </div>

            <Panel className="gap-3 bg-appbg flex-1 min-h-min xl:min-h-0" noPadding>
              {totalCount > 0 ? (
                <>
                  <PanelHeader className="flex-col items-stretch gap-3">
                    {/* Top Queue Filter and Counts */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-muted uppercase">Filter:</span>
                        <select
                          value={queueFilter}
                          onChange={(event) => setQueueFilter(event.target.value as typeof queueFilter)}
                          className="game-select h-7 py-0.5 px-2 text-[10px] font-bold"
                          aria-label="Filter download queue"
                        >
                          <option value="all">All items ({totalCount})</option>
                          <option value="active">Active ({downloadingCount + pendingCount})</option>
                          <option value="completed">Completed ({completedCount})</option>
                          <option value="failed">Failed ({failedCount + canceledCount})</option>
                        </select>
                      </div>

                      {/* Compact Metrics Row */}
                      <div className="flex items-center gap-2 font-mono text-[10px] font-bold">
                        {downloadingCount > 0 && (
                          <span className="text-toska">{downloadingCount} act</span>
                        )}
                        {pendingCount > 0 && (
                          <span className="text-ink">{pendingCount} pen</span>
                        )}
                        {completedCount > 0 && (
                          <span className="text-toska">{completedCount} ok</span>
                        )}
                        {failedCount > 0 && (
                          <span className="text-oshipink">{failedCount} err</span>
                        )}
                      </div>
                    </div>

                    {/* Batch Progress */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-mono font-bold text-muted uppercase">
                        <span>Batch progress</span>
                        <span>{finishedCount}/{totalCount} · {overallProgress}%</span>
                      </div>
                      <ProgressBar percent={overallProgress} status={overallProgress === 100 ? 'done' : 'downloading'} />
                    </div>

                    {/* Batch Controls */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={cancelAllDownloads}
                        disabled={!hasActiveDownloads}
                        className="w-full"
                        icon={XCircle}
                        title="Stops active downloads and prevents pending downloads from starting"
                      >
                        Cancel active
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={retryFailed}
                        disabled={failedCount === 0}
                        className="w-full"
                        icon={RotateCw}
                        title="Retries failed items"
                      >
                        Retry failed
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => clearCompleted(['done', 'expanded'])}
                        disabled={!queue.some(q => q.status === 'done' || q.status === 'expanded')}
                        className="w-full"
                        icon={Check}
                        title="Removes completed downloads"
                      >
                        Clear finished
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => clearCompleted(['error', 'canceled'])}
                        disabled={failedCount === 0 && canceledCount === 0}
                        className="w-full"
                        icon={Trash2}
                        title="Removes failed and canceled queue records"
                      >
                        Clear issues
                      </Button>
                    </div>
                  </PanelHeader>

                  <PanelScrollArea className="flex flex-col gap-2 h-full p-2.5">
                    {isQueuePaused && (
                      <div className="rounded-xl border-2 border-oshipink bg-softpink p-3 text-ink shadow-game-thin animate-pulse">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-oshipink mt-0.5" />
                            <div className="text-[11px] font-mono">
                              <p className="font-bold text-oshipink uppercase tracking-wider">Queue Paused</p>
                              <p className="mt-0.5 text-ink font-medium">{pauseReason || 'Rate limit detected. Queue paused to protect your IP.'}</p>
                              <p className="mt-1 text-[10px] text-muted">Wait a few minutes, or attach cookies in Settings to resume.</p>
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
                      <div className="flex-1 flex flex-col items-center justify-center opacity-40 text-ink py-10">
                        <span className="font-zen font-bold text-sm">No items match this filter</span>
                        <span className="font-mono text-[10px] mt-1">Switch filter to 'All items' to view the queue.</span>
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
                </>
              ) : (
                /* Information & Quick Reference Panel when Queue is Idle */
                <div className="flex flex-col h-full p-4 sm:p-5 justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-xl bg-panel border-2 border-subtleborder flex items-center justify-center text-toska shrink-0">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-zen font-bold text-xs text-ink">Supported Platforms</h4>
                        <p className="font-mono text-[10px] text-muted">Powered by yt-dlp media engine</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="p-2 rounded-xl bg-panel border border-subtleborder text-center">
                        <span className="block font-zen font-bold text-[11px] text-ink">YouTube</span>
                        <span className="block font-mono text-[9px] text-muted">Videos & Playlists</span>
                      </div>
                      <div className="p-2 rounded-xl bg-panel border border-subtleborder text-center">
                        <span className="block font-zen font-bold text-[11px] text-ink">TikTok</span>
                        <span className="block font-mono text-[9px] text-muted">Direct media</span>
                      </div>
                      <div className="p-2 rounded-xl bg-panel border border-subtleborder text-center">
                        <span className="block font-zen font-bold text-[11px] text-ink">Twitter / X</span>
                        <span className="block font-mono text-[9px] text-muted">HD Video clips</span>
                      </div>
                      <div className="p-2 rounded-xl bg-panel border border-subtleborder text-center">
                        <span className="block font-zen font-bold text-[11px] text-ink">Twitch</span>
                        <span className="block font-mono text-[9px] text-muted">Clips & VODs</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-panel border border-subtleborder space-y-1.5">
                      <div className="flex items-center gap-1.5 text-toska text-[11px] font-mono font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Ready to download</span>
                      </div>
                      <p className="font-mono text-[10px] text-muted leading-relaxed">
                        Paste any link on the left and click <strong className="text-ink">Check links</strong>. Real-time download progress, bitrate, and status will appear right here.
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-subtleborder flex items-center justify-between text-[10px] font-mono text-muted">
                    <span>Queue status: Idle</span>
                    <span>0 items</span>
                  </div>
                </div>
              )}
            </Panel>
          </Column>
        </PageLayout>
      </div>
    </div>
  );
}
