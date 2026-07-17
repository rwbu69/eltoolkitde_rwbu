import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FfmpegService, FfmpegProgress } from '../services/ffmpeg';
import { FileAudio, FolderOpen, Scissors, FlipHorizontal } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';

export default function FfmpegView() {
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<'mp3' | 'trim' | 'mirror'>('mp3');

  const [inputPath, setInputPath] = useState<string | string[]>('');
  const [outputPath, setOutputPath] = useState(settings.defaultOutputDir || '');
  
  // If settings change, sync them up if outputPath is empty
  useEffect(() => {
    if (!outputPath && settings.defaultOutputDir) {
      setOutputPath(settings.defaultOutputDir);
    }
  }, [settings.defaultOutputDir]);
  
  // Trim specifics
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:01:00');

  const [progresses, setProgresses] = useState<FfmpegProgress[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectInput = async (directory: boolean = false, multiple: boolean = false) => {
    try {
      const selected = await open({ directory, multiple });
      if (selected) setInputPath(selected);
    } catch (e) { console.error(e); }
  };

  const handleSelectOutput = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') setOutputPath(selected);
    } catch (e) { console.error(e); }
  };

  const handleProcess = async () => {
    if (!inputPath || !outputPath) return;
    setIsProcessing(true);
    setProgresses([]);
    
    try {
      if (activeTab === 'mp3') {
        const inputDir = Array.isArray(inputPath) ? inputPath[0] : inputPath;
        await FfmpegService.convertToMp3(
          { inputDir, outputRoot: outputPath, bitrate: settings.defaultAudioBitrate },
          (p) => setProgresses(prev => {
            const idx = prev.findIndex(x => x.file === p.file);
            if (idx >= 0) { const next = [...prev]; next[idx] = p; return next; }
            return [...prev, p];
          })
        );
      } else if (activeTab === 'mirror') {
        const inputFiles = Array.isArray(inputPath) ? inputPath : [inputPath];
        await FfmpegService.mirrorMedia(
          { inputFiles, outputDir: outputPath },
          (p) => setProgresses(prev => {
            const idx = prev.findIndex(x => x.file === p.file);
            if (idx >= 0) { const next = [...prev]; next[idx] = p; return next; }
            return [...prev, p];
          })
        );
      } else if (activeTab === 'trim') {
        const inputFile = Array.isArray(inputPath) ? inputPath[0] : inputPath;
        await FfmpegService.trimMedia(
          { inputFile, startTime, endTime, outputDir: outputPath },
          (p) => setProgresses([p])
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <header className="mb-8">
        <h2 className="text-2xl font-semibold text-zinc-100">FFmpeg Tools</h2>
        <p className="text-zinc-400 mt-1">Convert to MP3, Trim, and Mirror media files.</p>
      </header>

      <div className="flex gap-2 mb-6 border-b border-zinc-800/80 pb-2">
        <button 
          onClick={() => { setActiveTab('mp3'); setInputPath(''); setOutputPath(''); setProgresses([]); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'mp3' ? 'bg-rose-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
        >
          MP3 Convert (Batch)
        </button>
        <button 
          onClick={() => { setActiveTab('trim'); setInputPath(''); setProgresses([]); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'trim' ? 'bg-rose-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
        >
          Trim
        </button>
        <button 
          onClick={() => { setActiveTab('mirror'); setInputPath(''); setProgresses([]); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'mirror' ? 'bg-rose-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
        >
          Mirror
        </button>
      </div>

      <div className="max-w-2xl bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-6">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              {activeTab === 'mp3' ? 'Input Folder' : 'Input File'}
            </label>
            <div className="flex gap-2">
              <input type="text" value={Array.isArray(inputPath) ? `${inputPath.length} files selected` : inputPath} readOnly className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none placeholder:text-zinc-600 transition-colors" placeholder={`Select input ${activeTab === 'mp3' ? 'folder' : 'file'}...`} />
              <button onClick={() => handleSelectInput(activeTab === 'mp3', activeTab === 'mirror')} className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors text-zinc-300">
                <FolderOpen className="w-5 h-5" />
              </button>
            </div>
          </div>

          {activeTab === 'trim' && (
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Start Time (HH:MM:SS)</label>
                <input type="text" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:border-rose-500 transition-colors" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">End Time (HH:MM:SS)</label>
                <input type="text" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:border-rose-500 transition-colors" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Output Directory</label>
            <div className="flex gap-2">
              <input type="text" value={outputPath} readOnly className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none placeholder:text-zinc-600 transition-colors" placeholder="Select output folder..." />
              <button onClick={handleSelectOutput} className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors text-zinc-300">
                <FolderOpen className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-800/50 mt-2">
            <button 
              onClick={handleProcess}
              disabled={!inputPath || !outputPath || isProcessing}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activeTab === 'mp3' ? <FileAudio className="w-4 h-4" /> : activeTab === 'trim' ? <Scissors className="w-4 h-4" /> : <FlipHorizontal className="w-4 h-4" />}
              {isProcessing ? 'Processing...' : 'Process'}
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
                    p.status === 'skipped' ? 'bg-zinc-800 text-zinc-300' :
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
