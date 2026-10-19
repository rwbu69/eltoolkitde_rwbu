import { useState, useEffect } from 'react';
import { MetadataService, MetadataProgress, MetadataOptions } from '../services/metadata';
import { Tag, Target, FileAudio, Folder } from 'lucide-react';
import { PageLayout, Column, SectionHeader, Panel, PanelScrollArea, FormLabel } from './ui/Layout';
import { PathPicker } from './ui/PathPicker';
import { Tabs } from './ui/Tabs';
import { Input } from './ui/Input';
import { EmptyState } from './ui/EmptyState';
import { InlineNotice } from './ui/InlineNotice';
import { ActionFooter } from './ui/ActionFooter';
import { getStatusLabel, getUserFacingError } from '../config/uiText';

export default function MetadataView({ isActive = false }: { isActive?: boolean }) {
  const [mode, setMode] = useState<'file' | 'folder'>('file');
  const [inputPath, setInputPath] = useState('');
  
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [year, setYear] = useState('');

  const [progresses, setProgresses] = useState<MetadataProgress[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cancelFn, setCancelFn] = useState<(() => void) | null>(null);
  const [notice, setNotice] = useState<string>('');

  useEffect(() => {
    if (!isActive) return;
    const handleDrop = (e: any) => {
      const paths = e.detail as string[];
      if (paths && paths.length > 0) {
        setInputPath(paths[0]);
        setProgresses([]);
      }
    };
    window.addEventListener('toolkit-drop', handleDrop);
    return () => window.removeEventListener('toolkit-drop', handleDrop);
  }, [isActive]);

  // handleSelectInput handled by PathPicker

  const handleProcess = async () => {
    if (!inputPath) return;
    setNotice('');
    setIsProcessing(true);
    setProgresses([]);
    
    try {
      const opts: MetadataOptions = { mode, inputPath };
      if (title) opts.title = title;
      if (artist) opts.artist = artist;
      if (album) opts.album = album;
      if (year) opts.year = year;

      const { task, cancel } = await MetadataService.processMetadata(opts, (p) => {
        setProgresses(prev => {
          const idx = prev.findIndex(x => x.file === p.file);
          if (idx >= 0) { const next = [...prev]; next[idx] = p; return next; }
          return [...prev, p];
        });
      });
      setCancelFn(() => cancel);
      await task;
    } catch (e: any) {
      console.error(e);
      setNotice(getUserFacingError(e, 'The metadata could not be applied. Check the selected input and try again.').message);
    } finally {
      setIsProcessing(false);
      setCancelFn(null);
    }
  };

  return (
    <PageLayout>
      {/* LEFT COLUMN: Input & Config */}
      <Column>
        <SectionHeader title="Metadata Editor" />

        <Tabs
          options={[
            { value: 'file', label: 'Single file', icon: FileAudio },
            { value: 'folder', label: 'Batch folder', icon: Folder }
          ]}
          value={mode}
          onChange={(val) => { setMode(val as any); setInputPath(''); setProgresses([]); }}
        />

        <Panel className="flex-1 flex flex-col min-w-0">
          <PanelScrollArea className="flex flex-col gap-4 pr-2">
            <div>
              <FormLabel text={mode === 'file' ? 'Target MP3 file' : 'Target directory'} icon={Target} />
              <PathPicker 
                value={inputPath}
                onChange={setInputPath}
                placeholder={`Select target ${mode}...`}
                directory={mode === 'folder'}
                filters={mode === 'file' ? [{ name: 'MP3 Files', extensions: ['mp3'] }] : undefined}
              />
            </div>

          {/* ID3 Tag Inputs */}
          <div className="bg-appbg border-4 border-gameborder rounded-2xl p-4 space-y-4 shrink-0">
            <h3 className="font-zen font-black text-ink mb-3 border-b-2 border-gameborder pb-1.5 text-base">ID3 tag configuration</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormLabel text="TITLE" />
                <Input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Leave blank to skip" className="bg-panel" />
              </div>
              <div>
                <FormLabel text="ARTIST" />
                <Input type="text" value={artist} onChange={e => setArtist(e.target.value)} placeholder="Leave blank to skip" className="bg-panel" />
              </div>
              <div>
                <FormLabel text="ALBUM" />
                <Input type="text" value={album} onChange={e => setAlbum(e.target.value)} placeholder="Leave blank to skip" className="bg-panel" />
              </div>
              <div>
                <FormLabel text="YEAR" />
                <Input type="text" value={year} onChange={e => setYear(e.target.value)} placeholder="Leave blank to skip" className="bg-panel" />
              </div>
            </div>
          </div>
          </PanelScrollArea>

          {/* Action Buttons */}
          <ActionFooter
            onAction={handleProcess}
            actionLabel="Apply metadata"
            disabled={!inputPath}
            loading={isProcessing}
            actionIcon={Tag}
            onCancel={isProcessing && cancelFn ? cancelFn : undefined}
          />
          {notice && <InlineNotice message={notice} tone="error" />}
        </Panel>
      </Column>

      {/* RIGHT COLUMN: Quest Board / Status */}
      <Column isSidebar>
        <SectionHeader title="Metadata Logs" align="right" variant="secondary" />

        <Panel className="gap-4">
          {progresses.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-ink">
              <EmptyState title="No recent actions" description="Apply metadata to see results" />
            </div>
          ) : (
            <PanelScrollArea className="flex flex-col gap-3">
              {progresses.map((p, i) => {
                let cardClass = 'bg-panel border-muted';
                let tagClass = 'bg-ink-muted text-buttontext';

                if (p.status === 'done') {
                  cardClass = 'bg-softtoska border-gameborder';
                  tagClass = 'bg-toska text-ink';
                } else if (p.status === 'error') {
                  cardClass = 'bg-softpink border-oshipink';
                  tagClass = 'bg-oshipink text-buttontext';
                } else {
                  cardClass = 'bg-panel border-gameborder shadow-game-thin';
                  tagClass = 'bg-ink text-buttontext';
                }

                return (
                  <div key={i} className={`flex flex-col gap-2 border-2 p-3 rounded-xl transition-all shrink-0 ${cardClass}`}>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-ink font-mono font-bold text-xs truncate flex-1 leading-tight" title={p.file}>{p.file}</span>
                      <span className={`px-2 py-0.5 border-2 border-gameborder rounded-full font-mono text-[10px] font-black tracking-widest whitespace-nowrap uppercase ${tagClass}`}>
                        {getStatusLabel(p.status)}
                      </span>
                    </div>
                    {p.log && <span className="text-[10px] font-mono text-muted line-clamp-2">{p.log}</span>}
                  </div>
                );
              })}
            </PanelScrollArea>
          )}

        </Panel>
      </Column>
    </PageLayout>
  );
}
