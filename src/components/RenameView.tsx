import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { RenameService, RenameOptions, RenamePreview, RenameProgress } from '../services/rename';
import { FolderOpen, Edit3, Undo2 } from 'lucide-react';

export default function RenameView() {
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
      
      // Refresh previews to show current state
      setTimeout(() => {
        // Trigger re-render of previews
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
    <>
      <header className="mb-8">
        <h2 className="text-2xl font-semibold text-zinc-100 flex items-center gap-2">
          Batch Rename
        </h2>
        <p className="text-zinc-400 mt-1">Ganti nama file secara in-place dengan aman.</p>
      </header>

      <div className="flex gap-2 mb-6 border-b border-zinc-800/80 pb-2">
        {(['find-replace', 'prefix-suffix', 'numbering'] as const).map(m => (
          <button 
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${mode === m ? 'bg-rose-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
          >
            {m === 'find-replace' ? 'Find & Replace' : m === 'prefix-suffix' ? 'Prefix / Suffix' : 'Numbering'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Col: Config */}
        <div className="space-y-6">
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-5">
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Target Directory
            </label>
            <div className="flex gap-2 mb-4">
              <input type="text" value={inputPath} readOnly className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200 focus:outline-none placeholder:text-zinc-600" placeholder="Select target folder..." />
              <button onClick={handleSelectInput} className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors text-zinc-300">
                <FolderOpen className="w-5 h-5" />
              </button>
            </div>

            {mode === 'find-replace' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Find</label>
                  <input type="text" value={findText} onChange={e => setFindText(e.target.value)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200" placeholder="Text to find..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Replace</label>
                  <input type="text" value={replaceText} onChange={e => setReplaceText(e.target.value)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200" placeholder="Replace with..." />
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                  <input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} className="rounded border-zinc-700 bg-zinc-900 text-rose-500 focus:ring-rose-500" />
                  Case Sensitive
                </label>
              </div>
            )}

            {mode === 'prefix-suffix' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Prefix</label>
                  <input type="text" value={prefix} onChange={e => setPrefix(e.target.value)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200" placeholder="Add to beginning..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Suffix</label>
                  <input type="text" value={suffix} onChange={e => setSuffix(e.target.value)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200" placeholder="Add to end..." />
                </div>
              </div>
            )}

            {mode === 'numbering' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Base Name (Leave blank to keep original)</label>
                  <input type="text" value={baseName} onChange={e => setBaseName(e.target.value)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200" placeholder="e.g. Track_" />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Start Number</label>
                    <input type="number" min="0" value={startNumber} onChange={e => setStartNumber(parseInt(e.target.value) || 0)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Padding (Zeros)</label>
                    <input type="number" min="1" max="10" value={padding} onChange={e => setPadding(parseInt(e.target.value) || 1)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200" />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {history.length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-5">
              <h4 className="text-sm font-medium text-rose-400 mb-2">Undo Available</h4>
              <p className="text-xs text-rose-300/80 mb-4">You can revert the last rename operation.</p>
              <button 
                onClick={handleUndo}
                disabled={isProcessing}
                className="w-full px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Undo2 className="w-4 h-4" />
                Undo Last Rename
              </button>
            </div>
          )}
        </div>

        {/* Right Col: Preview & Progress */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-5 flex flex-col h-[500px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-zinc-200">Live Preview</h3>
            <button 
              onClick={handleExecute}
              disabled={!inputPath || isProcessing || hasConflicts || previews.length === 0}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Edit3 className="w-4 h-4" />
              {isProcessing ? 'Processing...' : 'Rename Files'}
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto border border-zinc-800 rounded-md bg-zinc-950/30 relative">
            {previews.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
                Select a folder to see files
              </div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-zinc-900/80 sticky top-0 text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-2 font-medium w-1/2">Original Name</th>
                    <th className="px-4 py-2 font-medium w-1/2">New Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {previews.map((p, i) => {
                    const prog = progresses.find(x => x.file === p.oldName);
                    const isError = p.status !== 'ok' || prog?.status === 'error';
                    return (
                      <tr key={i} className={`${isError ? 'bg-red-500/10' : 'hover:bg-zinc-900/50'}`}>
                        <td className="px-4 py-2 text-zinc-300 truncate max-w-[200px]" title={p.oldName}>
                          {p.oldName}
                        </td>
                        <td className={`px-4 py-2 truncate max-w-[200px] font-medium ${isError ? 'text-red-400' : 'text-zinc-200'}`} title={p.newName}>
                          {p.newName}
                          {p.status === 'collision' && <span className="ml-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">Collision</span>}
                          {p.status === 'exists' && <span className="ml-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">Exists</span>}
                          {prog && (
                            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                              prog.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' :
                              prog.status === 'error' ? 'bg-red-500/20 text-red-400' :
                              'bg-rose-500/20 text-rose-400'
                            }`}>
                              {prog.status} {prog.log ? `(${prog.log})` : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
