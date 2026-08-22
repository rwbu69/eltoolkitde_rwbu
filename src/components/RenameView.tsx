import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { RenameService, RenameOptions, RenamePreview, RenameProgress } from '../services/rename';
import { FolderOpen, Edit3, Undo2, CheckSquare, Search, Type, Hash, Settings2, AlertTriangle } from 'lucide-react';
import { PageLayout, Column, SectionHeader, Panel, PanelScrollArea, FormLabel } from './ui/Layout';

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

  const handleSelectInput = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        setInputPath(selected);
        setHistory([]); // reset history when changing folder
        setProgresses([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExecute = async () => {
    if (previews.length === 0 || hasConflicts) return;
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
      alert(err.message || String(err));
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
      alert(err.message || String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const hasConflicts = previews.some(p => p.status !== 'ok');

  return (
    <PageLayout>
      <Column>
        <SectionHeader title="BATCH RENAME" icon={Edit3} />

        {/* Tab Buttons */}
        <div className="flex gap-2 shrink-0 overflow-x-auto pb-2">
          <button 
            onClick={() => setMode('find-replace')}
            className={`flex-1 h-[44px] min-w-[100px] text-xs font-bold flex items-center justify-center shrink-0 ${mode === 'find-replace' ? 'game-btn-primary' : 'game-btn-secondary text-ink'}`}
          >
            <Search className="w-4 h-4 mr-1.5" /> FIND & REPLACE
          </button>
          <button 
            onClick={() => setMode('prefix-suffix')}
            className={`flex-1 h-[44px] min-w-[100px] text-xs font-bold flex items-center justify-center shrink-0 ${mode === 'prefix-suffix' ? 'game-btn-primary' : 'game-btn-secondary text-ink'}`}
          >
            <Type className="w-4 h-4 mr-1.5" /> AFFIXES
          </button>
          <button 
            onClick={() => setMode('numbering')}
            className={`flex-1 h-[44px] min-w-[100px] text-xs font-bold flex items-center justify-center shrink-0 ${mode === 'numbering' ? 'game-btn-primary' : 'game-btn-secondary text-ink'}`}
          >
            <Hash className="w-4 h-4 mr-1.5" /> NUMBERING
          </button>
        </div>

        <Panel className="flex flex-col">
          <PanelScrollArea className="flex flex-col gap-4 pr-2">
            
            {/* Target Directory */}
            <div>
              <FormLabel text="TARGET FOLDER" icon={FolderOpen} />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputPath}
                  readOnly
                  placeholder="Select target folder..."
                  className="game-input"
                />
                <button 
                  onClick={handleSelectInput}
                  className="game-btn-secondary px-4 h-12 flex items-center justify-center shrink-0"
                  title="Select Folder"
                >
                  <FolderOpen className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Configuration Area */}
            <div className="bg-appbg border-4 border-ink rounded-2xl p-4 shrink-0 mt-2">
              <h3 className="flex items-center gap-1.5 font-zen font-black text-ink mb-3 border-b-2 border-ink pb-1.5 text-base">
                <Settings2 className="w-4 h-4" /> CONFIGURATION
              </h3>

              {mode === 'find-replace' && (
                <div className="space-y-4">
                  <div>
                    <FormLabel text="FIND TEXT" />
                    <input type="text" value={findText} onChange={e => setFindText(e.target.value)} className="game-input bg-white" placeholder="Text to find..." />
                  </div>
                  <div>
                    <FormLabel text="REPLACE WITH" />
                    <input type="text" value={replaceText} onChange={e => setReplaceText(e.target.value)} className="game-input bg-white" placeholder="Replace with..." />
                  </div>
                  <label onClick={() => setCaseSensitive(!caseSensitive)} className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-12 h-6 rounded-full border-2 border-ink transition-colors relative ${caseSensitive ? 'bg-toska' : 'bg-muted'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white border-2 border-ink rounded-full transition-transform ${caseSensitive ? 'translate-x-6' : ''}`}></div>
                    </div>
                    <span className="font-mono text-xs font-bold text-ink group-hover:text-toska transition-colors">CASE SENSITIVE</span>
                  </label>
                </div>
              )}

              {mode === 'prefix-suffix' && (
                <div className="space-y-4">
                  <div>
                    <FormLabel text="PREFIX" />
                    <input type="text" value={prefix} onChange={e => setPrefix(e.target.value)} className="game-input bg-white" placeholder="Add to beginning..." />
                  </div>
                  <div>
                    <FormLabel text="SUFFIX" />
                    <input type="text" value={suffix} onChange={e => setSuffix(e.target.value)} className="game-input bg-white" placeholder="Add to end..." />
                  </div>
                </div>
              )}

              {mode === 'numbering' && (
                <div className="space-y-4">
                  <div>
                    <FormLabel text="BASE NAME (OPTIONAL)" />
                    <input type="text" value={baseName} onChange={e => setBaseName(e.target.value)} className="game-input bg-white" placeholder="e.g. Track_" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <FormLabel text="START NUMBER" />
                      <input type="number" min="0" value={startNumber} onChange={e => setStartNumber(parseInt(e.target.value) || 0)} className="game-input bg-white" />
                    </div>
                    <div>
                      <FormLabel text="PADDING" />
                      <input type="number" min="1" max="10" value={padding} onChange={e => setPadding(parseInt(e.target.value) || 1)} className="game-input bg-white" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {history.length > 0 && (
              <div className="p-4 rounded-xl bg-softpink border-4 border-ink flex items-start justify-between gap-3 shrink-0">
                <div>
                  <h4 className="font-bold text-sm text-ink mb-1 flex items-center gap-1"><Undo2 className="w-4 h-4"/> UNDO AVAILABLE</h4>
                  <p className="text-xs text-ink/80 font-mono">You can revert the last rename operation.</p>
                </div>
                <button 
                  onClick={handleUndo}
                  disabled={isProcessing}
                  className="game-btn-primary px-4 py-2 text-xs flex items-center gap-2 shrink-0 bg-red-500"
                >
                  <Undo2 className="w-3 h-3" /> UNDO
                </button>
              </div>
            )}
          </PanelScrollArea>

          {/* Action Button */}
          <div className="pt-3 mt-3 border-t-4 border-appbg shrink-0">
            <button 
              onClick={handleExecute}
              disabled={previews.length === 0 || hasConflicts || isProcessing || !inputPath}
              className="game-btn-primary w-full h-[48px] font-zen font-black text-base flex justify-center items-center gap-2"
            >
              <CheckSquare className="w-5 h-5" /> {isProcessing ? 'PROCESSING...' : `APPLY TO ${previews.length} FILE${previews.length !== 1 ? 'S' : ''}`}
            </button>
          </div>
        </Panel>
      </Column>

      <Column isSidebar>
        <SectionHeader title="PREVIEW" align="right" variant="secondary" />
        <Panel className="flex flex-col bg-appbg" noPadding>
          <div className="p-3 border-b-4 border-ink bg-white rounded-t-2xl shrink-0 flex items-center justify-between">
            <FormLabel text="FILE CHANGES" />
            {hasConflicts && (
              <span className="text-[10px] font-bold text-white bg-oshipink px-2 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3"/> CONFLICTS
              </span>
            )}
          </div>
          <PanelScrollArea className="p-3">
            {previews.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-2">
                <p className="text-sm font-bold font-zen">No files selected</p>
                <p className="text-[10px] font-mono text-center">Select a folder to see previews</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {previews.map((p, i) => {
                  const prog = progresses.find(x => x.file === p.oldName);
                  const isError = p.status !== 'ok' || prog?.status === 'error';
                  return (
                    <div key={i} className={`flex flex-col p-2.5 rounded-xl border-2 shrink-0 ${isError ? 'bg-softpink border-oshipink' : 'bg-white border-ink'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-muted truncate pr-2">OLD NAME</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-ink truncate mb-2" title={p.oldName}>{p.oldName}</span>
                      
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-toska truncate pr-2">NEW NAME</span>
                        {p.status === 'collision' && <span className="text-[9px] font-bold text-white bg-oshipink px-1.5 py-0.5 rounded">Collision</span>}
                        {p.status === 'exists' && <span className="text-[9px] font-bold text-white bg-oshipink px-1.5 py-0.5 rounded">Exists</span>}
                      </div>
                      <span className={`text-xs font-mono font-bold truncate ${isError ? 'text-oshipink' : 'text-ink'}`} title={p.newName}>{p.newName}</span>
                      
                      {prog && (
                        <div className={`mt-2 text-[10px] font-bold px-2 py-1 rounded-lg border-2 ${
                          prog.status === 'done' ? 'bg-softtoska border-toska text-toska' :
                          prog.status === 'error' ? 'bg-softpink border-oshipink text-oshipink' :
                          'bg-appbg border-ink/20 text-muted'
                        }`}>
                          STATUS: {prog.status.toUpperCase()} {prog.log ? `(${prog.log})` : ''}
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
