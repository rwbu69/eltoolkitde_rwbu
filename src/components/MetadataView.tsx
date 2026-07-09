import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { MetadataService, MetadataProgress, MetadataOptions } from '../services/metadata';
import { FolderOpen, Tag } from 'lucide-react';

export default function MetadataView() {
  const [mode, setMode] = useState<'file' | 'folder'>('file');
  const [inputPath, setInputPath] = useState('');
  
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [year, setYear] = useState('');

  const [progresses, setProgresses] = useState<MetadataProgress[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

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

      await MetadataService.processMetadata(opts, (p) => {
        setProgresses(prev => {
          const idx = prev.findIndex(x => x.file === p.file);
          if (idx >= 0) { const next = [...prev]; next[idx] = p; return next; }
          return [...prev, p];
        });
      });
    } catch (e: any) {
      console.error(e);
      alert(e.message || String(e));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <header className="mb-8">
        <h2 className="text-2xl font-semibold text-zinc-100">Metadata Editor</h2>
        <p className="text-zinc-400 mt-1">Edit ID3 tags for your MP3 files.</p>
      </header>

      <div className="flex gap-2 mb-6 border-b border-zinc-800/80 pb-2">
        <button 
          onClick={() => { setMode('file'); setInputPath(''); setProgresses([]); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'file' ? 'bg-rose-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
        >
          Single File
        </button>
        <button 
          onClick={() => { setMode('folder'); setInputPath(''); setProgresses([]); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'folder' ? 'bg-rose-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
        >
          Batch (Folder)
        </button>
      </div>

      <div className="max-w-2xl bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-6">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              {mode === 'file' ? 'Target MP3 File' : 'Target Directory'}
            </label>
            <div className="flex gap-2">
              <input type="text" value={inputPath} readOnly className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none placeholder:text-zinc-600 transition-colors" placeholder={`Select target ${mode}...`} />
              <button onClick={handleSelectInput} className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors text-zinc-300">
                <FolderOpen className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Leave blank to skip" className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:border-rose-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Artist</label>
              <input type="text" value={artist} onChange={e => setArtist(e.target.value)} placeholder="Leave blank to skip" className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:border-rose-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Album</label>
              <input type="text" value={album} onChange={e => setAlbum(e.target.value)} placeholder="Leave blank to skip" className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:border-rose-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Year</label>
              <input type="text" value={year} onChange={e => setYear(e.target.value)} placeholder="Leave blank to skip" className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:border-rose-500 transition-colors" />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-800/50 mt-2">
            <button 
              onClick={handleProcess}
              disabled={!inputPath || isProcessing}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Tag className="w-4 h-4" />
              {isProcessing ? 'Processing...' : 'Apply Metadata'}
            </button>
          </div>

          {progresses.length > 0 && (
            <div className="mt-4 max-h-48 overflow-y-auto space-y-2 p-4 bg-zinc-950/50 border border-zinc-800 rounded-lg">
              {progresses.map((p, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-zinc-300 truncate pr-4">{p.file}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    p.status === 'done' ? 'bg-emerald-500/10 text-emerald-400' :
                    p.status === 'error' ? 'bg-red-500/10 text-red-400' :
                    'bg-rose-500/10 text-rose-400'
                  }`}>
                    {p.status} {p.log ? `(${p.log})` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
