import { useState, useEffect } from 'react';
import { RenameService, RenameOptions, RenamePreview, RenameProgress } from '../services/rename';
import { FolderOpen, Undo2, CheckSquare, Search, Type, Hash, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Panel, PanelScrollArea, FormLabel } from './ui/Layout';
import { Button } from './ui/Button';
import { PathPicker } from './ui/PathPicker';
import { Tabs } from './ui/Tabs';
import { Input } from './ui/Input';
import { Toggle } from './ui/Toggle';
import { EmptyState } from './ui/EmptyState';
import { InlineNotice } from './ui/InlineNotice';
import { getStatusLabel, getUserFacingError } from '../config/uiText';
import { showToast } from './ui/Toast';

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
    setHistory([]);
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
      showToast('The file names could not be previewed.', 'error', getUserFacingError(err, 'Check the selected folder and try again.').detail);
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
      showToast('The files could not be renamed.', 'error', getUserFacingError(err, 'Check the preview and try again.').detail);
    } finally {
      setIsProcessing(false);
    }
  };

  const hasConflicts = previews.some(p => p.status !== 'ok');

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <Panel className="flex-1 flex flex-col min-w-0 min-h-0" noPadding>
        {/* TOP CONFIGURATION STRIP */}
        <div className="p-3.5 sm:p-4 border-b-2 border-subtleborder bg-appbg rounded-t-2xl shrink-0 flex flex-col gap-3">
          {/* Row 1: Target Folder + Mode Tabs */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3 items-end">
            <div>
              <FormLabel text="Target folder" icon={FolderOpen} />
              <PathPicker 
                value={inputPath}
                onChange={handleSelectInput}
                placeholder="Select target folder..."
                directory={true}
              />
            </div>

            <div>
              <FormLabel text="Rename mode" icon={Type} iconColor="text-toska" />
              <Tabs
                options={[
                  { value: 'find-replace', label: 'Find & replace', icon: Search },
                  { value: 'prefix-suffix', label: 'Affixes', icon: Type },
                  { value: 'numbering', label: 'Numbering', icon: Hash }
                ]}
                value={mode}
                onChange={(val) => setMode(val as any)}
              />
            </div>
          </div>

          {/* Row 2: Mode Parameters (Clean flat grid, no nested box) */}
          <div className="pt-2.5 border-t border-subtleborder">
            {mode === 'find-replace' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-mono font-bold text-muted mb-1">Find text</label>
                  <Input
                    type="text"
                    value={findText}
                    onChange={e => setFindText(e.target.value)}
                    className="bg-panel text-xs h-10"
                    placeholder="Text to match..."
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono font-bold text-muted mb-1">Replace with</label>
                  <Input
                    type="text"
                    value={replaceText}
                    onChange={e => setReplaceText(e.target.value)}
                    className="bg-panel text-xs h-10"
                    placeholder="Replacement text..."
                  />
                </div>
                <div className="pb-1">
                  <Toggle 
                    checked={caseSensitive}
                    onChange={setCaseSensitive}
                    label="Match case"
                    variant="switch"
                  />
                </div>
              </div>
            )}

            {mode === 'prefix-suffix' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono font-bold text-muted mb-1">Prefix (add to beginning)</label>
                  <Input
                    type="text"
                    value={prefix}
                    onChange={e => setPrefix(e.target.value)}
                    className="bg-panel text-xs h-10"
                    placeholder="e.g. Track_"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono font-bold text-muted mb-1">Suffix (add to end)</label>
                  <Input
                    type="text"
                    value={suffix}
                    onChange={e => setSuffix(e.target.value)}
                    className="bg-panel text-xs h-10"
                    placeholder="e.g. _Remastered"
                  />
                </div>
              </div>
            )}

            {mode === 'numbering' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono font-bold text-muted mb-1">Base name (optional)</label>
                  <Input
                    type="text"
                    value={baseName}
                    onChange={e => setBaseName(e.target.value)}
                    className="bg-panel text-xs h-10"
                    placeholder="e.g. Track_"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono font-bold text-muted mb-1">Start number</label>
                  <Input
                    type="number"
                    min="0"
                    value={startNumber}
                    onChange={e => setStartNumber(parseInt(e.target.value) || 0)}
                    className="bg-panel text-xs h-10"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono font-bold text-muted mb-1">Padding digits</label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={padding}
                    onChange={e => setPadding(parseInt(e.target.value) || 1)}
                    className="bg-panel text-xs h-10"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FULL-WIDTH PREVIEW TABLE */}
        <div className="flex-1 min-h-0 flex flex-col bg-panel">
          {/* Table Header */}
          <div className="grid grid-cols-[56px_minmax(0,1fr)_32px_minmax(0,1fr)_100px] items-center px-4 py-2 border-b-2 border-subtleborder bg-panel text-[10px] font-mono font-bold text-muted uppercase shrink-0">
            <span>Status</span>
            <span>Original filename</span>
            <span></span>
            <span>Renamed filename</span>
            <span className="text-right">Result</span>
          </div>

          {/* Table Body with Custom Scrollbar */}
          <PanelScrollArea className="flex-1 min-h-0 overflow-y-auto p-3">
            {previews.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center my-auto">
                <EmptyState
                  title={!inputPath ? "No folder selected" : "No files found"}
                  description={!inputPath ? "Select a folder above to preview and execute batch renames" : "The selected folder contains no eligible files to rename"}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {previews.map((p, i) => {
                  const prog = progresses.find(x => x.file === p.oldName);
                  const isError = p.status !== 'ok' || prog?.status === 'error';
                  const isModified = p.oldName !== p.newName;

                  return (
                    <div
                      key={i}
                      className={`grid grid-cols-[56px_minmax(0,1fr)_32px_minmax(0,1fr)_100px] items-center px-3 py-2 rounded-xl border transition-colors ${
                        isError
                          ? 'bg-softpink/40 border-oshipink/40'
                          : isModified
                          ? 'bg-appbg border-subtleborder hover:border-oshipink/40'
                          : 'bg-panel border-subtleborder/50 opacity-60'
                      }`}
                    >
                      {/* Status Icon */}
                      <div className="flex items-center">
                        {p.status === 'ok' ? (
                          <CheckCircle2 className="w-4 h-4 text-toska shrink-0" />
                        ) : p.status === 'collision' ? (
                          <span className="text-[9px] font-mono font-bold text-buttontext bg-oshipink px-1.5 py-0.5 rounded" title="Name collision detected">
                            Collision
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono font-bold text-buttontext bg-oshipink px-1.5 py-0.5 rounded" title="Target file already exists">
                            Exists
                          </span>
                        )}
                      </div>

                      {/* Original Filename */}
                      <span className="text-xs font-mono font-bold text-ink truncate pr-2" title={p.oldName}>
                        {p.oldName}
                      </span>

                      {/* Arrow */}
                      <div className="flex items-center justify-center">
                        <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
                      </div>

                      {/* Renamed Filename */}
                      <span
                        className={`text-xs font-mono font-bold truncate pr-2 ${
                          isError ? 'text-oshipink' : isModified ? 'text-toska' : 'text-ink'
                        }`}
                        title={p.newName}
                      >
                        {p.newName}
                      </span>

                      {/* Progress / Status Pill */}
                      <div className="flex justify-end">
                        {prog ? (
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                            prog.status === 'done' ? 'bg-softtoska border-toska text-toska' :
                            prog.status === 'error' ? 'bg-softpink border-oshipink text-oshipink' :
                            'bg-appbg border-subtleborder text-muted'
                          }`}>
                            {getStatusLabel(prog.status)}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-muted/60">
                            {isModified ? 'Pending' : 'Unchanged'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PanelScrollArea>
        </div>

        {/* BOTTOM ACTION FOOTER */}
        <div className="p-3 border-t-2 border-subtleborder bg-appbg rounded-b-2xl shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {history.length > 0 && (
              <Button 
                onClick={handleUndo}
                disabled={isProcessing}
                variant="danger"
                size="sm"
                icon={Undo2}
              >
                Undo last rename ({history.length})
              </Button>
            )}
            {hasConflicts && (
              <span className="text-xs font-mono text-oshipink font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Resolve conflicts before renaming
              </span>
            )}
          </div>

          <div className="w-full sm:w-auto">
            <Button 
              onClick={handleExecute}
              variant="primary"
              size="lg"
              disabled={previews.length === 0 || hasConflicts || isProcessing || !inputPath}
              icon={CheckSquare}
              className="w-full sm:w-auto px-6"
            >
              {isProcessing ? 'Processing rename...' : `Apply to ${previews.length} file${previews.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </Panel>
      {notice && <InlineNotice message={notice} tone="error" />}
    </div>
  );
}
