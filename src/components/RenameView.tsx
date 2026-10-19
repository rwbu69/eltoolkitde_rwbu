import { useState, useEffect } from 'react';
import { RenameService, RenameOptions, RenamePreview, RenameProgress } from '../services/rename';
import { FolderOpen, Edit3, Undo2, CheckSquare, Search, Type, Hash, Settings2, AlertTriangle } from 'lucide-react';
import { PageLayout, Column, SectionHeader, Panel, PanelScrollArea, FormLabel, PanelHeader } from './ui/Layout';
import { Button } from './ui/Button';
import { PathPicker } from './ui/PathPicker';
import { Tabs } from './ui/Tabs';
import { Input } from './ui/Input';
import { Toggle } from './ui/Toggle';
import { EmptyState } from './ui/EmptyState';
import { InlineNotice } from './ui/InlineNotice';
import { getStatusLabel, getUserFacingError } from '../config/uiText';

export default function RenameView({ isActive = false }: { isActive?: boolean }) {
  const [inputPath, setInputPath] = useState('');
  const [mode, setMode] = useState<'find-replace' | 'prefix-suffix' | 'numbering'>('find-replace');

  // Find & Replace state
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);

  // Prefix / Suffix state
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');

  // Numbering state
  const [baseName, setBaseName] = useState('');
  const [startNumber, setStartNumber] = useState(1);
  const [padding, setPadding] = useState(3);

  // Outputs
  const [previews, setPreviews] = useState<RenamePreview[]>([]);
  const [progresses, setProgresses] = useState<RenameProgress[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<{oldPath: string, newPath: string}[]>([]);
  const [notice, setNotice] = useState<string>('');

  // Re-generate previews whenever inputs change
  useEffect(() => {
    if (!isActive) return;
    const handleDrop = (e: any) => {
      const paths = e.detail as string[];
      if (paths && paths.length > 0) {
        // Just take the first dropped item as the target folder
        setInputPath(paths[0]);
        setHistory([]);
        setProgresses([]);
      }
    };
    window.addEventListener('toolkit-drop', handleDrop);
    return () => window.removeEventListener('toolkit-drop', handleDrop);
  }, [isActive]);

  useEffect(() => {
    if (!inputPath) {
      setPreviews([]);
      return;
    }

    const opts: RenameOptions = { mode, inputPath };
    if (mode === 'find-replace') {
      opts.findText = findText;
      opts.replaceText = replaceText;
      opts.caseSensitive = caseSensitive;
    } else if (mode === 'prefix-suffix') {
      opts.prefix = prefix;
      opts.suffix = suffix;
    } else if (mode === 'numbering') {
      opts.baseName = baseName !== '' ? baseName : undefined;
      opts.startNumber = startNumber;
      opts.padding = padding;
    }

    RenameService.generatePreview(opts)
      .then(setPreviews)
      .catch(err => {
        console.error(err);
        setPreviews([]);
      });
  }, [inputPath, mode, findText, replaceText, caseSensitive, prefix, suffix, baseName, startNumber, padding]);

  const handleSelectInput = (path: string) => {
    setInputPath(path);
    setHistory([]); // reset history when changing folder
    setProgresses([]);
  };

  const handleExecute = async () => {
    if (previews.length === 0 || hasConflicts) return;
    setNotice('');
    setIsProcessing(true);
    setProgresses([]);
    
    try {
      const res = await RenameService.executeRename(previews, (p) => {
        setProgresses(prev => {
          const idx = prev.findIndex(x => x.file === p.file);
          if (idx >= 0) { const next = [...prev]; next[idx] = p; return next; }
          return [...prev, p];
        });
      });
      
      if (res.history.length > 0) {
        setHistory(res.history);
      }
      
      setTimeout(() => {
        setMode(mode); 
      }, 500);
      
    } catch (err: any) {
      setNotice(getUserFacingError(err, 'The file names could not be previewed. Check the selected folder and try again.').message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndo = async () => {
    if (history.length === 0) return;
    setIsProcessing(true);
    setProgresses([]);
    
    try {
      await RenameService.undoRename(history, (p) => {
        setProgresses(prev => {
          const idx = prev.findIndex(x => x.file === p.file);
          if (idx >= 0) { const next = [...prev]; next[idx] = p; return next; }
          return [...prev, p];
        });
      });
      setHistory([]);
      
      setTimeout(() => {
        setMode(mode); 
      }, 500);
      
    } catch (err: any) {
      setNotice(getUserFacingError(err, 'The files could not be renamed. Check the preview and try again.').message);
    } finally {
      setIsProcessing(false);
    }
  };

  const hasConflicts = previews.some(p => p.status !== 'ok');

  return (
    <PageLayout>
      <Column>
        <SectionHeader title="Batch Rename" icon={Edit3} />

        {/* Tab Buttons */}
        <Tabs
          options={[
            { value: 'find-replace', label: 'FIND & REPLACE', icon: Search },
            { value: 'prefix-suffix', label: 'AFFIXES', icon: Type },
            { value: 'numbering', label: 'NUMBERING', icon: Hash }
          ]}
          value={mode}
          onChange={(val) => setMode(val as any)}
        />

        <Panel className="flex-1 flex flex-col min-w-0">
          <PanelScrollArea className="flex flex-col gap-4 pr-2">
            
            {/* Target Directory */}
            <div>
              <FormLabel text="Target folder" icon={FolderOpen} />
              <PathPicker 
                value={inputPath}
                onChange={handleSelectInput}
                placeholder="Select target folder..."
                directory={true}
              />
            </div>

            {/* Configuration Area */}
            <div className="bg-appbg border-4 border-gameborder rounded-2xl p-4 shrink-0 mt-2">
              <h3 className="flex items-center gap-1.5 font-zen font-black text-ink mb-3 border-b-2 border-gameborder pb-1.5 text-base">
                <Settings2 className="w-4 h-4" /> Configuration
              </h3>

              {mode === 'find-replace' && (
                <div className="space-y-4">
                  <div>
                    <FormLabel text="Find text" />
                    <Input type="text" value={findText} onChange={e => setFindText(e.target.value)} className="bg-panel" placeholder="Text to find..." />
                  </div>
                  <div>
                    <FormLabel text="Replace with" />
                    <Input type="text" value={replaceText} onChange={e => setReplaceText(e.target.value)} className="bg-panel" placeholder="Replace with..." />
                  </div>
                  <Toggle 
                    checked={caseSensitive}
                    onChange={setCaseSensitive}
                    label="Case sensitive"
                    variant="switch"
                  />
                </div>
              )}

              {mode === 'prefix-suffix' && (
                <div className="space-y-4">
                  <div>
                    <FormLabel text="PREFIX" />
                    <Input type="text" value={prefix} onChange={e => setPrefix(e.target.value)} className="bg-panel" placeholder="Add to beginning..." />
                  </div>
                  <div>
                    <FormLabel text="SUFFIX" />
                    <Input type="text" value={suffix} onChange={e => setSuffix(e.target.value)} className="bg-panel" placeholder="Add to end..." />
                  </div>
                </div>
              )}

              {mode === 'numbering' && (
                <div className="space-y-4">
                  <div>
                    <FormLabel text="Base name (optional)" />
                    <Input type="text" value={baseName} onChange={e => setBaseName(e.target.value)} className="bg-panel" placeholder="e.g. Track_" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <FormLabel text="Start number" />
                      <Input type="number" min="0" value={startNumber} onChange={e => setStartNumber(parseInt(e.target.value) || 0)} className="bg-panel" />
                    </div>
                    <div>
                      <FormLabel text="PADDING" />
                      <Input type="number" min="1" max="10" value={padding} onChange={e => setPadding(parseInt(e.target.value) || 1)} className="bg-panel" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {history.length > 0 && (
              <div className="p-4 rounded-xl bg-softpink border-4 border-gameborder flex items-start justify-between gap-3 shrink-0">
                <div>
                  <h4 className="font-bold text-sm text-ink mb-1 flex items-center gap-1"><Undo2 className="w-4 h-4"/> Undo available</h4>
                  <p className="text-xs text-ink/80 font-mono">You can revert the last rename operation.</p>
                </div>
                <Button 
                  onClick={handleUndo}
                  disabled={isProcessing}
                  variant="primary"
                  icon={Undo2}
                  className="px-4 py-2 text-xs h-[36px] bg-red-500 border-red-700"
                >
                  UNDO
                </Button>
              </div>
            )}
          </PanelScrollArea>

          {/* Action Button */}
          <div className="pt-3 mt-3 border-t-4 border-appbg shrink-0">
            <Button 
              onClick={handleExecute}
              variant="primary"
              disabled={previews.length === 0 || hasConflicts || isProcessing || !inputPath}
              icon={CheckSquare}
              fullWidth
            >
              {isProcessing ? 'Processing...' : `Apply to ${previews.length} file${previews.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
          {notice && <InlineNotice message={notice} tone="error" />}
        </Panel>
      </Column>

      <Column isSidebar>
        <SectionHeader title="Preview" align="right" variant="secondary" />
        <Panel className="bg-appbg" noPadding>
          <PanelHeader>
            <FormLabel text="File changes" />
            {hasConflicts && (
              <span className="text-[10px] font-bold text-buttontext bg-oshipink px-2 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3"/> Conflicts
              </span>
            )}
          </PanelHeader>
          <PanelScrollArea className="p-3">
            {previews.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-2">
                <EmptyState title="No files selected" description="Select a folder to see previews" />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {previews.map((p, i) => {
                  const prog = progresses.find(x => x.file === p.oldName);
                  const isError = p.status !== 'ok' || prog?.status === 'error';
                  return (
                    <div key={i} className={`flex flex-col p-2.5 rounded-xl border-2 shrink-0 ${isError ? 'bg-softpink border-oshipink' : 'bg-panel border-gameborder'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-muted truncate pr-2">Old name</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-ink truncate mb-2" title={p.oldName}>{p.oldName}</span>
                      
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-toska truncate pr-2">New name</span>
                        {p.status === 'collision' && <span className="text-[9px] font-bold text-buttontext bg-oshipink px-1.5 py-0.5 rounded">Collision</span>}
                        {p.status === 'exists' && <span className="text-[9px] font-bold text-buttontext bg-oshipink px-1.5 py-0.5 rounded">Exists</span>}
                      </div>
                      <span className={`text-xs font-mono font-bold truncate ${isError ? 'text-oshipink' : 'text-ink'}`} title={p.newName}>{p.newName}</span>
                      
                      {prog && (
                        <div className={`mt-2 text-[10px] font-bold px-2 py-1 rounded-lg border-2 ${
                          prog.status === 'done' ? 'bg-softtoska border-toska text-toska' :
                          prog.status === 'error' ? 'bg-softpink border-oshipink text-oshipink' :
                          'bg-appbg border-gameborder/20 text-muted'
                        }`}>
                          {getStatusLabel(prog.status)}{prog.log ? ` (${prog.log})` : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </PanelScrollArea>
        </Panel>
      </Column>
    </PageLayout>
  );
}
