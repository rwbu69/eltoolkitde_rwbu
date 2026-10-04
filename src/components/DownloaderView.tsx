import { useState, useEffect } from 'react';
import { Download, FolderOpen, CheckCircle2, Circle, Clock, X, Target, Disc, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PageLayout, Column, SectionHeader, Panel, PanelScrollArea, FormLabel, PanelHeader } from './ui/Layout';
import { CustomSelect } from './ui/CustomSelect';
import { Button } from './ui/Button';
import { PathPicker } from './ui/PathPicker';
import { Tabs } from './ui/Tabs';
import { ProgressBar } from './ui/ProgressBar';

export default function DownloaderView() {
  const { settings, updateSettings, queue, addToQueue, cancelItem, removeFromQueue, clearCompleted } = useAppStore();
  
  const [urlsInput, setUrlsInput] = useState('');
  const [format, setFormat] = useState<'mp4' | 'mp3' | 'video-only'>('mp4');
  const [outputDir, setOutputDir] = useState<string>(settings.defaultOutputDir || '');

  useEffect(() => {
    if (!outputDir && settings.defaultOutputDir) {
      setOutputDir(settings.defaultOutputDir);
    }
  }, [settings.defaultOutputDir]);

  const handleDownload = () => {
    if (!urlsInput.trim() || !outputDir) {
      return;
    }

    // Split by newlines or spaces and filter out empty strings
    const urls = urlsInput
      .split(/[\n\s]+/)
      .map(u => u.trim())
      .filter(u => u.length > 0);

    urls.forEach(url => {
      addToQueue(url, format);
    });

    // Clear input after adding to queue
    setUrlsInput('');
  };

  const pendingCount = queue.filter(q => q.status === 'pending' || q.status === 'fetching').length;
  const downloadingCount = queue.filter(q => q.status === 'downloading').length;

  return (
    <PageLayout>
      {/* LEFT COLUMN: Input & Config */}
      <Column>
        <SectionHeader title="DOWNLOAD QUEUE" />

        <Panel className="flex-1 flex flex-col min-w-0">
          <PanelScrollArea className="flex flex-col gap-4 pr-2">
            {/* Target URL */}
            <div>
              <FormLabel text="MEDIA URL(S)" icon={Target} />
              <textarea
                value={urlsInput}
                onChange={(e) => setUrlsInput(e.target.value)}
                placeholder="Paste youtube link(s) here... Separate multiple links with spaces or newlines to batch download."
                className="game-input min-h-[120px] py-3 resize-y w-full"
              />
            </div>
            
            {/* Format & Quality */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="w-full md:w-1/2 min-w-0 flex flex-col">
                <FormLabel text="FORMAT" icon={Disc} iconColor="text-toska" />
                <Tabs 
                  options={[
                    { value: 'mp4', label: 'MP4' },
                    { value: 'mp3', label: 'MP3' },
                    { value: 'video-only', label: 'VIDEO-ONLY' }
                  ]}
                  value={format}
                  onChange={(val) => setFormat(val as any)}
                />
              </div>

              <div className="w-full md:w-1/2 min-w-0 flex flex-col">
                {format !== 'mp3' ? (
                  <>
                    <FormLabel text="VIDEO RESOLUTION" icon={Disc} iconColor="text-toska" />
                    <CustomSelect 
                      options={[
                        { value: '4k', label: '4K (2160p)' },
                        { value: '1440p', label: '1440p' },
                        { value: '1080p', label: '1080p' },
                        { value: '720p', label: '720p' },
                        { value: '480p', label: '480p' },
                        { value: '360p', label: '360p' },
                      ]}
                      value={settings.defaultVideoQuality}
                      onChange={(val) => updateSettings({ defaultVideoQuality: val as any })}
                      className="shrink-0"
                    />
                    <span className="text-[10px] font-mono text-muted mt-1 px-1">
                      (Falls back to next best if unavailable)
                    </span>
                  </>
                ) : (
                  <>
                    <FormLabel text="AUDIO BITRATE" icon={Disc} iconColor="text-toska" />
                    <CustomSelect 
                      options={[
                        { value: '320k', label: '320 kbps (High)' },
                        { value: '256k', label: '256 kbps (Mid)' },
                        { value: '192k', label: '192 kbps (Low)' },
                      ]}
                      value={settings.defaultAudioBitrate}
                      onChange={(val) => updateSettings({ defaultAudioBitrate: val as any })}
                      className="shrink-0"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Output Dir */}
            <div>
              <FormLabel text="OUTPUT FOLDER" icon={FolderOpen} iconColor="text-muted" />
              <PathPicker 
                value={outputDir} 
                onChange={(path) => { setOutputDir(path); updateSettings({ defaultOutputDir: path }); }} 
                placeholder="Select output folder..." 
                directory={true}
              />
            </div>
          </PanelScrollArea>
            
          {/* Action Buttons */}
          <div className="pt-4 mt-3 border-t-4 border-appbg shrink-0">
            <Button 
              variant="primary"
              fullWidth
              onClick={handleDownload}
              disabled={!urlsInput.trim() || !outputDir}
              icon={Download}
            >
              QUEUE {urlsInput.trim() ? urlsInput.split(/[\n\s]+/).filter(u => u.trim()).length : 0} ITEM(S)
            </Button>
          </div>
        </Panel>
      </Column>

      {/* RIGHT COLUMN: Global Queue Status */}
      <Column isSidebar>
        <SectionHeader title="ACTIVE QUEUE" align="right" variant="secondary" />

        <Panel className="gap-3 bg-appbg" noPadding>
          <PanelHeader>
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="text-xl font-black font-zen text-ink leading-none">{downloadingCount}</span>
                <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-widest mt-1">Active</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-black font-zen text-ink leading-none">{pendingCount}</span>
                <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-widest mt-1">Pending</span>
              </div>
            </div>
            <Button 
              variant="secondary"
              onClick={clearCompleted}
              disabled={!queue.some(q => q.status === 'done' || q.status === 'error')}
              className="px-3 py-1.5 h-auto text-xs font-zen font-black !rounded-xl"
            >
              CLEAR DONE
            </Button>
          </PanelHeader>

          <PanelScrollArea className="flex flex-col gap-2 h-full p-2">
            {queue.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-ink py-10">
                <span className="font-zen font-bold text-lg">Queue is Empty</span>
                <span className="font-mono text-xs mt-1 text-center">Add URLs to start downloading</span>
              </div>
            ) : (
              [...queue].reverse().map((item) => {
                let statusIcon = <Circle className="w-4 h-4 text-muted" />;
                let statusText = 'PENDING';
                let cardClass = 'bg-panel border-muted opacity-60';
                let textClass = 'text-muted';
                
                if (item.status === 'done') {
                  statusIcon = <CheckCircle2 className="w-4 h-4 text-buttontext" />;
                  statusText = 'CLEARED';
                  cardClass = 'bg-toska border-gameborder text-buttontext opacity-100';
                  textClass = 'text-buttontext';
                } else if (item.status === 'downloading' || item.status === 'fetching') {
                  statusIcon = <Clock className="w-4 h-4 text-ink" />;
                  statusText = item.status === 'fetching' ? 'FETCHING' : 'DOWNLOADING';
                  cardClass = 'bg-softtoska border-gameborder opacity-100 shadow-game-thin';
                  textClass = 'text-ink';
                } else if (item.status === 'error') {
                  statusIcon = <X className="w-4 h-4 text-buttontext" />;
                  statusText = 'ERROR';
                  cardClass = 'bg-oshipink border-gameborder text-buttontext opacity-100';
                  textClass = 'text-buttontext';
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
                        onClick={() => item.status === 'downloading' || item.status === 'fetching' ? cancelItem(item.id) : removeFromQueue(item.id)}
                        className={`shrink-0 p-1 rounded-md opacity-50 hover:opacity-100 transition-opacity ${item.status === 'done' || item.status === 'error' ? 'hover:bg-black/20' : 'hover:bg-panel/50 text-ink'}`}
                        title={item.status === 'downloading' || item.status === 'fetching' ? "Cancel Download" : "Remove from Queue"}
                      >
                        {item.status === 'downloading' || item.status === 'fetching' ? (
                          <X className="w-4 h-4" />
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
