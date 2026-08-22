import { useState, useEffect } from 'react';
import { Settings2, Music, Scissors, SplitSquareHorizontal, FolderOpen, Play, CheckCircle2, Circle, Clock, X, FileAudio } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { FfmpegService, FfmpegProgress } from '../services/ffmpeg';
import { useSettings } from '../hooks/useSettings';
import { PageLayout, Column, SectionHeader, Panel, PanelScrollArea, FormLabel } from './ui/Layout';

export default function FfmpegView({ isActive = false }: { isActive?: boolean }) {
  const { settings } = useSettings();
  const [mode, setMode] = useState<'mp3' | 'trim' | 'mirror'>('mp3');
  
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState<string>(settings.defaultOutputDir || '');
  
  const [trimStart, setTrimStart] = useState('00:00:00');
  const [trimEnd, setTrimEnd] = useState('00:01:00');
  
  const [progresses, setProgresses] = useState<FfmpegProgress[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cancelFn, setCancelFn] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!outputDir && settings.defaultOutputDir) {
      setOutputDir(settings.defaultOutputDir);
    }
  }, [settings.defaultOutputDir, outputDir]);

  useEffect(() => {
    if (!isActive) return;
    const handleDrop = (e: any) => {
      const paths = e.detail as string[];
      if (paths && paths.length > 0) {
        const mediaPaths = paths.filter(p => /\.(mp4|mkv|webm|mp3|wav|m4a|flac|avi|mov)$/i.test(p));
        if (mediaPaths.length > 0) {
          setInputPaths(prev => [...new Set([...prev, ...mediaPaths])]);
        }
      }
    };
    window.addEventListener('toolkit-drop', handleDrop);
    return () => window.removeEventListener('toolkit-drop', handleDrop);
  }, [isActive]);

  const handleSelectFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Media', extensions: ['mp4', 'mkv', 'webm', 'mp3', 'wav', 'm4a', 'flac', 'avi', 'mov'] }]
      });
      if (selected && Array.isArray(selected)) {
        setInputPaths(prev => [...new Set([...prev, ...selected])]);
      } else if (selected && typeof selected === 'string') {
        setInputPaths(prev => [...new Set([...prev, selected])]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFile = (path: string) => {
    setInputPaths(prev => prev.filter(p => p !== path));
  };

  const handleSelectFolderInput = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        const { readDir } = await import('@tauri-apps/plugin-fs');
        const entries = await readDir(selected);
        const joinPath = (...parts: string[]) => parts.join('\\').replace(/\\\\/g, '\\');
        const files = entries
          .filter(e => e.isFile && /\.(mp4|mkv|webm|mp3|wav|m4a|flac|avi|mov)$/i.test(e.name))
          .map(e => joinPath(selected, e.name));
        
        setInputPaths(prev => [...new Set([...prev, ...files])]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectFolderOutput = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        setOutputDir(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleProcess = async () => {
    if (inputPaths.length === 0 || !outputDir) return;
    setIsProcessing(true);
    setProgresses(inputPaths.map(p => ({ file: p.split(/[\\/]/).pop() || p, status: 'pending', percent: 0 })));
    
    try {
      let result;
      if (mode === 'mp3') {
        result = await FfmpegService.convertToMp3(
          { inputFiles: inputPaths, outputRoot: outputDir, bitrate: settings.defaultAudioBitrate },
          (prog) => setProgresses(prev => {
            const idx = prev.findIndex(x => x.file === prog.file);
            if (idx >= 0) { const next = [...prev]; next[idx] = prog; return next; }
            return [...prev, prog];
          })
        );
      } else if (mode === 'mirror') {
        result = await FfmpegService.mirrorMedia(
          { inputFiles: inputPaths, outputDir: outputDir },
          (prog) => setProgresses(prev => {
            const idx = prev.findIndex(x => x.file === prog.file);
            if (idx >= 0) { const next = [...prev]; next[idx] = prog; return next; }
            return [...prev, prog];
          })
        );
      } else if (mode === 'trim') {
        const inputFile = inputPaths[0];
        result = await FfmpegService.trimMedia(
          { inputFile, startTime: trimStart, endTime: trimEnd, outputDir: outputDir },
          (prog) => setProgresses([prog])
        );
      }
      
      if (result) {
        setCancelFn(() => result.cancel);
        await result.task;
      }
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
        <SectionHeader title="FFMPEG_TOOLS" />

        {/* Tab Buttons */}
        <div className="flex gap-2 shrink-0 overflow-x-auto pb-2">
          <button 
            onClick={() => setMode('mp3')}
            className={`flex-1 h-[44px] min-w-[100px] text-xs font-bold flex items-center justify-center shrink-0 ${mode === 'mp3' ? 'game-btn-primary' : 'game-btn-secondary text-ink'}`}
          >
            <Music className="w-4 h-4 mr-1.5" /> TO MP3
          </button>
          <button 
            onClick={() => setMode('trim')}
            className={`flex-1 h-[44px] min-w-[100px] text-xs font-bold flex items-center justify-center shrink-0 ${mode === 'trim' ? 'game-btn-primary' : 'game-btn-secondary text-ink'}`}
          >
            <Scissors className="w-4 h-4 mr-1.5" /> TRIM
          </button>
          <button 
            onClick={() => setMode('mirror')}
            className={`flex-1 h-[44px] min-w-[100px] text-xs font-bold flex items-center justify-center shrink-0 ${mode === 'mirror' ? 'game-btn-primary' : 'game-btn-secondary text-ink'}`}
          >
            <SplitSquareHorizontal className="w-4 h-4 mr-1.5" /> MIRROR
          </button>
        </div>

        <Panel className="space-y-5">
          {/* Target Files */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1.5 shrink-0">
              <FormLabel text={mode === 'trim' ? 'TARGET FILE (FIRST ONLY)' : 'TARGET FILES'} icon={FolderOpen} />
              <span className="font-mono text-[10px] font-bold text-muted bg-appbg px-2 py-0.5 rounded-full border border-ink/20">
                {inputPaths.length} selected
              </span>
            </div>
            
            <div className="flex gap-2 shrink-0">
              <button 
                onClick={handleSelectFiles} 
                className="game-btn-secondary flex-1 h-12 flex items-center justify-center border-[3px]"
              >
                <FileAudio className="w-4 h-4 mr-2" /> 
                <span className="text-xs font-bold tracking-wide">SELECT FILE(S)</span>
              </button>
              <button 
                onClick={handleSelectFolderInput} 
                className="game-btn-secondary flex-1 h-12 flex items-center justify-center border-[3px]"
              >
                <FolderOpen className="w-4 h-4 mr-2" /> 
                <span className="text-xs font-bold tracking-wide">BATCH (FOLDER)</span>
              </button>
            </div>

            {inputPaths.length > 0 && (
              <PanelScrollArea className="mt-2 flex flex-col gap-1.5 max-h-[120px] bg-appbg p-1.5 rounded-xl border-[3px] border-ink shadow-[inset_0_4px_0_0_rgba(165,151,176,0.1)]">
                {inputPaths.map((p, i) => (
                  <div key={i} className="flex justify-between items-center bg-white border-2 border-ink rounded-lg px-2.5 py-1.5 shrink-0">
                    <span className="text-[11px] font-mono font-bold text-ink truncate pr-2 leading-tight" title={p}>{p}</span>
                    <button onClick={() => handleRemoveFile(p)} className="text-oshipink hover:text-red-700 bg-softpink rounded p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </PanelScrollArea>
            )}
          </div>

          {/* Settings Area */}
          <div className="bg-appbg border-4 border-ink rounded-2xl p-4 shrink-0">
            <h3 className="flex items-center gap-1.5 font-zen font-black text-ink mb-3 border-b-2 border-ink pb-1.5 text-base">
              <Settings2 className="w-4 h-4" /> CONFIGURATION
            </h3>

            {mode === 'mp3' && (
              <p className="text-xs font-bold font-mono text-muted leading-relaxed">
                Extracts audio from video files or converts audio to MP3 format (Using global setting: {settings.defaultAudioBitrate}).
              </p>
            )}

            {mode === 'trim' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FormLabel text="START (HH:MM:SS)" />
                  <input type="text" value={trimStart} onChange={e => setTrimStart(e.target.value)} className="game-input bg-white" placeholder="00:00:00" />
                </div>
                <div>
                  <FormLabel text="END (HH:MM:SS)" />
                  <input type="text" value={trimEnd} onChange={e => setTrimEnd(e.target.value)} className="game-input bg-white" placeholder="00:01:00" />
                </div>
              </div>
            )}

            {mode === 'mirror' && (
              <p className="text-xs font-bold font-mono text-muted leading-relaxed">
                Flips the video horizontally.
              </p>
            )}
          </div>

          {/* Output Dir */}
          <div className="shrink-0">
            <FormLabel text="OUTPUT FOLDER" icon={FolderOpen} iconColor="text-muted" />
            <div className="flex gap-2">
              <input type="text" value={outputDir} readOnly className="game-input" placeholder="Select output directory..." />
              <button onClick={handleSelectFolderOutput} className="game-btn-secondary px-4 h-12 flex items-center justify-center shrink-0">
                <FolderOpen className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-3 mt-auto border-t-4 border-appbg shrink-0 flex gap-2">
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
              disabled={inputPaths.length === 0 || !outputDir || isProcessing}
              className={`game-btn-primary ${isProcessing && cancelFn ? 'w-2/3' : 'w-full'} h-[48px] font-zen font-black text-base flex justify-center items-center gap-2`}
            >
              <Play className="w-5 h-5" /> {isProcessing ? 'PROCESSING...' : `PROCESS ${inputPaths.length} FILE${inputPaths.length !== 1 ? 'S' : ''}`}
            </button>
          </div>

        </Panel>
      </Column>

      {/* RIGHT COLUMN: Process Log / Status */}
      <Column isSidebar>
        <SectionHeader title="PROCESS_LOG" align="right" variant="secondary" />

        <Panel className="gap-4">
          {progresses.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-ink">
              <span className="font-zen font-bold text-lg">Queue is empty</span>
              <span className="font-mono text-xs mt-1 text-center">Add files and start processing</span>
            </div>
          ) : (
            <PanelScrollArea className="flex flex-col gap-3">
              {progresses.map((p, i) => {
                let statusIcon = <Circle className="w-5 h-5 text-muted" />;
                let cardClass = 'bg-white border-muted';
                let tagClass = 'bg-ink-muted text-white';

                if (p.status === 'done') {
                  statusIcon = <CheckCircle2 className="w-5 h-5 text-toska" />;
                  cardClass = 'bg-softtoska border-ink';
                  tagClass = 'bg-toska text-ink';
                } else if (p.status === 'error') {
                  statusIcon = <X className="w-5 h-5 text-oshipink" />;
                  cardClass = 'bg-softpink border-oshipink';
                  tagClass = 'bg-oshipink text-white';
                } else if (p.status === 'processing') {
                  statusIcon = <Clock className="w-5 h-5 text-ink animate-spin-slow" />;
                  cardClass = 'bg-white border-ink shadow-game-thin';
                  tagClass = 'bg-ink text-white';
                } else if (p.status === 'skipped') {
                  statusIcon = <Circle className="w-5 h-5 text-muted" />;
                  cardClass = 'bg-appbg border-muted';
                  tagClass = 'bg-muted text-white';
                }

                return (
                  <div key={i} className={`flex flex-col gap-2 border-2 p-3 rounded-xl transition-all ${cardClass}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex gap-2 items-start overflow-hidden">
                        {statusIcon}
                        <span className="text-ink font-mono font-bold text-xs truncate leading-tight" title={p.file}>{p.file}</span>
                      </div>
                      <span className={`px-2 py-0.5 border-2 border-ink rounded-full font-mono text-[10px] font-black tracking-widest whitespace-nowrap uppercase ${tagClass}`}>
                        {p.status}
                      </span>
                    </div>
                    {p.status === 'processing' && p.percent !== undefined && (
                      <div className="w-full h-2 bg-appbg rounded-full overflow-hidden border border-ink/20 mt-1">
                        <div className="h-full bg-ink transition-all duration-300" style={{ width: `${p.percent}%` }}></div>
                      </div>
                    )}
                    {p.log && (p.status === 'error' || p.status === 'skipped') && (
                      <span className="text-[10px] font-mono text-oshipink font-bold line-clamp-2 mt-1">{p.log}</span>
                    )}
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
