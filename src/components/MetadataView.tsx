import { useState, useEffect } from 'react';
import { MetadataService, MetadataProgress, MetadataOptions } from '../services/metadata';
import { Tag, Target, FileAudio, Folder } from 'lucide-react';
import { PageLayout, Column, Panel, PanelScrollArea, FormLabel } from './ui/Layout';
import { PathPicker } from './ui/PathPicker';
import { Tabs } from './ui/Tabs';
import { Input } from './ui/Input';
import { BatchProgressItem } from './ui/BatchProgressItem';
import { InlineNotice } from './ui/InlineNotice';
import { ActionFooter } from './ui/ActionFooter';
import { getUserFacingError } from '../config/uiText';
import { showToast } from './ui/Toast';

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
  const [restoringFile, setRestoringFile] = useState<string | null>(null);

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
      showToast('The metadata could not be applied.', 'error', getUserFacingError(e, 'Check the selected input and try again.').detail);
    } finally {
      setIsProcessing(false);
      setCancelFn(null);
    }
  };

  const doneCount = progresses.filter(p => p.status === 'done').length;

  return (
    <PageLayout>
      {/* LEFT COLUMN: Input & Config */}
      <Column>
        <div className="flex items-center justify-between px-1 select-none">
          <div className="flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-oshipink" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink">Metadata Setup</span>
          </div>
        </div>

        <Panel className="flex-1 flex flex-col min-w-0">
          <PanelScrollArea className="flex flex-col gap-4">
            <div>
              <FormLabel text="Selection mode" icon={Tag} iconColor="text-toska" />
              <Tabs
                options={[
                  { value: 'file', label: 'Single file', icon: FileAudio },
                  { value: 'folder', label: 'Batch folder', icon: Folder }
                ]}
                value={mode}
                onChange={(val) => { setMode(val as any); setInputPath(''); setProgresses([]); }}
              />
            </div>

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
            <div className="bg-appbg border border-subtleborder rounded-2xl p-4 space-y-3 shrink-0">
              <h3 className="font-zen font-bold text-ink text-xs border-b border-subtleborder pb-1">
                ID3 tag fields
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <FormLabel text="Title" />
                  <Input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Track Title" className="bg-panel text-xs h-10" />
                </div>
                <div>
                  <FormLabel text="Artist" />
                  <Input type="text" value={artist} onChange={e => setArtist(e.target.value)} placeholder="e.g. Artist Name" className="bg-panel text-xs h-10" />
                </div>
                <div>
                  <FormLabel text="Album" />
                  <Input type="text" value={album} onChange={e => setAlbum(e.target.value)} placeholder="e.g. Album Name" className="bg-panel text-xs h-10" />
                </div>
                <div>
                  <FormLabel text="Year" />
                  <Input type="text" value={year} onChange={e => setYear(e.target.value)} placeholder="e.g. 2024" className="bg-panel text-xs h-10" />
                </div>
              </div>
            </div>
          </PanelScrollArea>

          {/* Action Buttons */}
          <div className="pt-3 mt-3 border-t-2 border-subtleborder shrink-0">
            <ActionFooter
              onAction={handleProcess}
              actionLabel="Apply metadata"
              disabled={!inputPath}
              loading={isProcessing}
              actionIcon={Tag}
              onCancel={isProcessing && cancelFn ? cancelFn : undefined}
            />
          </div>
          {notice && <InlineNotice message={notice} tone="error" />}
        </Panel>
      </Column>

      {/* RIGHT COLUMN: Quest Board / Status */}
      <Column isSidebar>
        <div className="flex items-center justify-between px-1 select-none">
          <div className="flex items-center gap-1.5">
            <FileAudio className="w-4 h-4 text-toska" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink">Metadata Log</span>
          </div>
          {progresses.length > 0 && (
            <span className="text-[10px] font-mono font-bold text-muted bg-panel border-2 border-subtleborder px-2 py-0.5 rounded-full">
              {doneCount}/{progresses.length} done
            </span>
          )}
        </div>

        <Panel className="gap-3 bg-appbg flex-1 min-h-min xl:min-h-0" noPadding>
          {progresses.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto">
              <div className="w-12 h-12 rounded-2xl border-2 border-subtleborder bg-panel flex items-center justify-center mb-3 text-muted/60 shadow-sm">
                <Tag className="w-5 h-5" />
              </div>
              <span className="font-zen font-bold text-xs text-ink">No recent actions</span>
              <span className="font-mono text-[10px] text-muted max-w-[200px] mt-1 leading-relaxed">
                Select an MP3 file or folder and click Apply metadata to update tags.
              </span>
            </div>
          ) : (
            <PanelScrollArea className="flex flex-col gap-2 p-3">
              {progresses.map((p, i) => (
                <BatchProgressItem
                  key={i}
                  title={p.file}
                  status={p.status}
                  log={p.log}
                >
                  {p.status === 'done' && p.backupPath && (
                    <button
                      type="button"
                      disabled={restoringFile === p.file}
                      onClick={async () => {
                        setRestoringFile(p.file);
                        try {
                          await MetadataService.restoreBackup(
                            p.inputPath!,
                            p.backupPath!,
                          );
                          showToast(`Restored the original metadata for ${p.file}.`, 'success');
                        } catch (error) {
                          showToast('The metadata backup could not be restored.', 'error', getUserFacingError(error, 'Try again.').detail);
                        } finally {
                          setRestoringFile(null);
                        }
                      }}
                      className="self-start text-[10px] font-mono font-bold underline disabled:opacity-50 text-oshipink hover:text-red-700"
                    >
                      {restoringFile === p.file ? 'Restoring...' : 'Restore original'}
                    </button>
                  )}
                </BatchProgressItem>
              ))}
            </PanelScrollArea>
          )}
        </Panel>
      </Column>
    </PageLayout>
  );
}
