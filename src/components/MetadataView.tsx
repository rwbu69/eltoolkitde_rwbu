import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { MetadataService, MetadataProgress, MetadataOptions } from '../services/metadata';
import { FolderOpen, Tag, Target, FileAudio, Folder, X } from 'lucide-react';
import { PageLayout, Column, SectionHeader, Panel, PanelScrollArea, FormLabel } from './ui/Layout';

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

  const handleSelectInput = async () => {
    try {
      const selected = await open({
        directory: mode === 'folder',
        multiple: false,
        filters: mode === 'file' ? [{ name: 'MP3 Files', extensions: ['mp3'] }] : undefined
      });
      if (selected && typeof selected === 'string') {
        setInputPath(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleProcess = async () => {
    if (!inputPath) return;
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
      alert(e.message || String(e));
    } finally {
      setIsProcessing(false);
      setCancelFn(null);
    }
  };

  return (
    <PageLayout>
      {/* LEFT COLUMN: Input & Config */}
      <Column>
        <SectionHeader title="METADATA_EDITOR" />

        <div className="flex gap-2 shrink-0 mb-2">
          <button 
            onClick={() => { setMode('file'); setInputPath(''); setProgresses([]); }}
            className={`flex-1 h-[44px] text-xs font-bold flex items-center justify-center shrink-0 ${mode === 'file' ? 'game-btn-primary' : 'game-btn-secondary text-ink'}`}
          >
            <FileAudio className="w-4 h-4 mr-1.5" /> SINGLE FILE
          </button>
          <button 
            onClick={() => { setMode('folder'); setInputPath(''); setProgresses([]); }}
            className={`flex-1 h-[44px] text-xs font-bold flex items-center justify-center shrink-0 ${mode === 'folder' ? 'game-btn-primary' : 'game-btn-secondary text-ink'}`}
          >
            <Folder className="w-4 h-4 mr-1.5" /> BATCH (FOLDER)
          </button>
        </div>

        <Panel className="flex flex-col">
          <PanelScrollArea className="flex flex-col gap-4 pr-2">
          {/* Target Path */}
          <div>
            <FormLabel text={mode === 'file' ? 'TARGET MP3 FILE' : 'TARGET DIRECTORY'} icon={Target} />
            <div className="flex gap-2">
              <input 
                type="text" 
                value={inputPath} 
                readOnly 
                className="game-input" 
                placeholder={`Select target ${mode}...`} 
              />
              <button 
                onClick={handleSelectInput} 
                className="game-btn-secondary px-4 h-12 flex items-center justify-center shrink-0"
              >
                <FolderOpen className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ID3 Tag Inputs */}
          <div className="bg-appbg border-4 border-ink rounded-2xl p-4 space-y-4 shrink-0">
            <h3 className="font-zen font-black text-ink mb-3 border-b-2 border-ink pb-1.5 text-base">ID3 TAG CONFIG</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormLabel text="TITLE" />
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Leave blank to skip" className="game-input bg-white" />
              </div>
              <div>
                <FormLabel text="ARTIST" />
                <input type="text" value={artist} onChange={e => setArtist(e.target.value)} placeholder="Leave blank to skip" className="game-input bg-white" />
              </div>
              <div>
                <FormLabel text="ALBUM" />
                <input type="text" value={album} onChange={e => setAlbum(e.target.value)} placeholder="Leave blank to skip" className="game-input bg-white" />
              </div>
              <div>
                <FormLabel text="YEAR" />
                <input type="text" value={year} onChange={e => setYear(e.target.value)} placeholder="Leave blank to skip" className="game-input bg-white" />
              </div>
            </div>
          </div>
          </PanelScrollArea>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-3 mt-3 border-t-4 border-appbg shrink-0">
            {isProcessing && cancelFn && (
              <button 
                onClick={() => cancelFn()}
                className="game-btn-secondary w-1/3 h-[48px] font-zen font-black text-base flex justify-center items-center gap-2 border-oshipink text-oshipink hover:bg-oshipink hover:text-white border-2"
              >
                <X className="w-5 h-5" /> CANCEL
              </button>
            )}
            <button 
              onClick={handleProcess}
              disabled={!inputPath || isProcessing}
              className={`game-btn-primary ${isProcessing && cancelFn ? 'w-2/3' : 'w-full'} h-[48px] font-zen font-black text-base flex justify-center items-center gap-2`}
            >
              <Tag className="w-5 h-5" />
              {isProcessing ? 'PROCESSING...' : 'APPLY METADATA'}
            </button>
          </div>
        </Panel>
      </Column>

      {/* RIGHT COLUMN: Quest Board / Status */}
      <Column isSidebar>
        <SectionHeader title="METADATA_LOGS" align="right" variant="secondary" />

        <Panel className="gap-4">
          {progresses.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-ink">
              <span className="font-zen font-bold text-lg">No Recent Actions</span>
              <span className="font-mono text-xs mt-1 text-center">Apply metadata to see results</span>
            </div>
          ) : (
            <PanelScrollArea className="flex flex-col gap-3">
              {progresses.map((p, i) => {
                let cardClass = 'bg-white border-muted';
                let tagClass = 'bg-ink-muted text-white';

                if (p.status === 'done') {
                  cardClass = 'bg-softtoska border-ink';
                  tagClass = 'bg-toska text-ink';
                } else if (p.status === 'error') {
                  cardClass = 'bg-softpink border-oshipink';
                  tagClass = 'bg-oshipink text-white';
                } else {
                  cardClass = 'bg-white border-ink shadow-game-thin';
                  tagClass = 'bg-ink text-white';
                }

                return (
                  <div key={i} className={`flex flex-col gap-2 border-2 p-3 rounded-xl transition-all shrink-0 ${cardClass}`}>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-ink font-mono font-bold text-xs truncate flex-1 leading-tight" title={p.file}>{p.file}</span>
                      <span className={`px-2 py-0.5 border-2 border-ink rounded-full font-mono text-[10px] font-black tracking-widest whitespace-nowrap uppercase ${tagClass}`}>
                        {p.status}
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
