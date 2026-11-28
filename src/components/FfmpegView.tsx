import { useState, useEffect } from 'react';
import { Music, Scissors, SplitSquareHorizontal, FolderOpen, Play, X, FileAudio, Settings2, CheckCircle2, Film } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { FfmpegService, FfmpegProgress } from '../services/ffmpeg';
import { WaveformService } from '../services/waveform';
import { useAppStore } from '../store/useAppStore';
import { PageLayout, Column, Panel, PanelScrollArea, FormLabel } from './ui/Layout';
import { Button } from './ui/Button';
import { CustomSelect } from './ui/CustomSelect';
import { PathPicker } from './ui/PathPicker';
import { Tabs } from './ui/Tabs';
import { Input } from './ui/Input';
import { BatchProgressItem } from './ui/BatchProgressItem';
import { ActionFooter } from './ui/ActionFooter';
import { getUserFacingError } from '../config/uiText';
import { basename, joinPath } from '../utils/path';
import { showToast } from './ui/Toast';
import { WaveformTrimmer } from './media/WaveformTrimmer';

export default function FfmpegView({ isActive = false }: { isActive?: boolean }) {
  const { settings } = useAppStore();
  const [mode, setMode] = useState<'mp3' | 'trim' | 'gif' | 'mirror'>('mp3');

  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState<string>(settings.defaultOutputDir || '');

  const [trimStart, setTrimStart] = useState('00:00:00');
  const [trimEnd, setTrimEnd] = useState('00:01:00');
  const [trimAccurate, setTrimAccurate] = useState(false);

  const [gifFps, setGifFps] = useState<string>('15');
  const [gifWidth, setGifWidth] = useState<string>('720');
  const [gifUseRange, setGifUseRange] = useState(false);

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
        const entries = await readDir(selected);
        const files = entries
          .filter(e => e.isFile && /\.(mp4|mkv|webm|mp3|wav|m4a|flac|avi|mov)$/i.test(e.name))
          .map(e => joinPath(selected, e.name));

        setInputPaths(prev => [...new Set([...prev, ...files])]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isFirstInputVideo = inputPaths.length > 0 && /\.(mp4|mkv|webm|mov|avi|m4v)$/i.test(inputPaths[0]);

  const handleProcess = async () => {
    if (inputPaths.length === 0 || !outputDir) return;
    if (mode === 'trim' || (mode === 'gif' && gifUseRange)) {
      const timePattern = /^\d{1,2}:\d{2}:\d{2}(?:\.\d{1,3})?$/;
      if (!timePattern.test(trimStart.trim()) || !timePattern.test(trimEnd.trim())) {
        showToast('Enter valid HH:MM:SS timestamps for start and end.', 'warning');
        return;
      }
      if (WaveformService.parseTimestampToSeconds(trimEnd) <= WaveformService.parseTimestampToSeconds(trimStart)) {
        showToast('End time must be greater than start time.', 'warning');
        return;
      }
    }
    setIsProcessing(true);
    setProgresses(inputPaths.map(p => ({ id: p, file: basename(p), status: 'pending', percent: 0 })));

    const upsertProgress = (prog: FfmpegProgress) => {
      setProgresses(prev => {
        const idx = prev.findIndex(x => (prog.id && x.id === prog.id) || (!prog.id && x.file === prog.file));
        if (idx >= 0) { const next = [...prev]; next[idx] = prog; return next; }
        return [...prev, prog];
      });
    };

    try {
      let result;
      if (mode === 'mp3') {
        result = await FfmpegService.convertToMp3(
          { inputFiles: inputPaths, outputRoot: outputDir, bitrate: settings.defaultAudioBitrate },
          upsertProgress
        );
      } else if (mode === 'mirror') {
        result = await FfmpegService.mirrorMedia(
          { inputFiles: inputPaths, outputDir: outputDir },
          upsertProgress
        );
      } else if (mode === 'gif') {
        result = await FfmpegService.convertToGif(
          {
            inputFiles: inputPaths,
            outputDir: outputDir,
            fps: Number(gifFps),
            width: gifWidth === 'orig' ? null : Number(gifWidth),
            ...(gifUseRange ? { startTime: trimStart, endTime: trimEnd } : {}),
          },
          upsertProgress
        );
      } else if (mode === 'trim') {
        const inputFile = inputPaths[0];
        result = await FfmpegService.trimMedia(
          { inputFile, startTime: trimStart, endTime: trimEnd, outputDir: outputDir, accurate: isFirstInputVideo && trimAccurate },
          (prog) => setProgresses([prog])
        );
      }

      if (result) {
        setCancelFn(() => result.cancel);
        await result.task;
      }
    } catch (e: any) {
      console.error(e);
      showToast('The files could not be processed.', 'error', getUserFacingError(e, 'Check the inputs and try again.').detail);
    } finally {
      setIsProcessing(false);
      setCancelFn(null);
    }
  };

  const adjustTimestamp = (current: string, deltaSeconds: number, setter: (val: string) => void) => {
    const parts = current.split(':').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return;
    let totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2] + deltaSeconds;
    if (totalSec < 0) totalSec = 0;
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    setter(`${h}:${m}:${s}`);
  };

  const doneCount = progresses.filter(p => p.status === 'done').length;

  return (
    <PageLayout>
      {/* LEFT COLUMN: Input & Config */}
      <Column>
        <div className="flex items-center justify-between px-1 select-none">
          <div className="flex items-center gap-1.5">
            <FileAudio className="w-4 h-4 text-oshipink" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink">Converter Setup</span>
          </div>
          {inputPaths.length > 0 && (
            <span className="text-[10px] font-mono font-bold text-muted bg-panel border-2 border-subtleborder px-2 py-0.5 rounded-full">
              {inputPaths.length} file{inputPaths.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <Panel className="flex-1 flex flex-col min-w-0">
          <PanelScrollArea className="flex flex-col gap-4">
            {/* Mode Tabs */}
            <div>
              <FormLabel text="Conversion mode" icon={Settings2} iconColor="text-toska" />
              <Tabs
                options={[
                  { value: 'mp3', label: 'To MP3', icon: Music },
                  { value: 'trim', label: 'Trim', icon: Scissors },
                  { value: 'gif', label: 'To GIF', icon: Film },
                  { value: 'mirror', label: 'Mirror', icon: SplitSquareHorizontal }
                ]}
                value={mode}
                onChange={(val) => setMode(val as any)}
              />
            </div>

            {/* Target Files */}
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1.5 shrink-0">
                <FormLabel text={mode === 'trim' ? 'Target file (first only)' : 'Target files'} icon={FolderOpen} />
                <span className="font-mono text-[10px] font-bold text-muted bg-appbg px-2 py-0.5 rounded-full border border-subtleborder">
                  {inputPaths.length} selected
                </span>
              </div>

              <div className="flex gap-2 shrink-0">
                <Button
                  onClick={handleSelectFiles}
                  variant="secondary"
                  size="md"
                  icon={FileAudio}
                  className="flex-1"
                >
                  <span>Select file(s)</span>
                </Button>
                <Button
                  onClick={handleSelectFolderInput}
                  variant="secondary"
                  size="md"
                  icon={FolderOpen}
                  className="flex-1"
                >
                  <span>Batch (folder)</span>
                </Button>
              </div>

              {inputPaths.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5 max-h-[110px] overflow-y-auto custom-scrollbar bg-appbg p-2 rounded-xl border border-subtleborder">
                  {inputPaths.map((p, i) => (
                    <div key={i} className="flex justify-between items-center bg-panel border border-subtleborder rounded-lg px-2.5 py-1 shrink-0">
                      <span className="text-[11px] font-mono font-bold text-ink truncate pr-2 leading-tight" title={p}>{p}</span>
                      <button onClick={() => handleRemoveFile(p)} className="text-oshipink hover:text-red-700 bg-softpink rounded p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mode-specific Configuration */}
            <div className="bg-appbg border border-subtleborder rounded-2xl p-3.5 shrink-0">
              {mode === 'mp3' && (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-toska shrink-0 mt-0.5" />
                  <p className="text-xs font-mono font-medium text-ink leading-relaxed">
                    Extracts and converts all tracks to high quality MP3 (Bitrate: <span className="font-bold text-toska">{settings.defaultAudioBitrate}</span>, configurable in Settings).
                  </p>
                </div>
              )}

              {mode === 'trim' && (
                <div className="space-y-3">
                  {inputPaths.length > 0 ? (
                    <WaveformTrimmer
                      filePath={inputPaths[0]}
                      startTime={trimStart}
                      endTime={trimEnd}
                      onRangeChange={(start, end) => {
                        setTrimStart(start);
                        setTrimEnd(end);
                      }}
                    />
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-subtleborder bg-panel text-center">
                      <Scissors className="w-5 h-5 text-oshipink mx-auto mb-1 opacity-70" />
                      <p className="text-xs font-zen font-bold text-ink">Waveform Cutter</p>
                      <p className="text-[10px] font-mono text-muted mt-0.5">
                        Select an audio or video file above to generate an waveform with draggable handles.
                      </p>
                    </div>
                  )}

                  <div className="pt-2 border-t border-subtleborder grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FormLabel text="Start time (HH:MM:SS)" />
                      <Input
                        type="text"
                        value={trimStart}
                        onChange={e => setTrimStart(e.target.value)}
                        className="bg-panel font-mono text-xs"
                        placeholder="00:00:00"
                      />
                      <div className="flex gap-1 mt-1.5">
                        <button type="button" onClick={() => adjustTimestamp(trimStart, -1, setTrimStart)} className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder text-[10px] font-mono font-bold hover:border-oshipink transition-colors">-1s</button>
                        <button type="button" onClick={() => adjustTimestamp(trimStart, 1, setTrimStart)} className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder text-[10px] font-mono font-bold hover:border-oshipink transition-colors">+1s</button>
                        <button type="button" onClick={() => adjustTimestamp(trimStart, 10, setTrimStart)} className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder text-[10px] font-mono font-bold hover:border-oshipink transition-colors">+10s</button>
                      </div>
                    </div>
                    <div>
                      <FormLabel text="End time (HH:MM:SS)" />
                      <Input
                        type="text"
                        value={trimEnd}
                        onChange={e => setTrimEnd(e.target.value)}
                        className="bg-panel font-mono text-xs"
                        placeholder="00:01:00"
                      />
                      <div className="flex gap-1 mt-1.5">
                        <button type="button" onClick={() => adjustTimestamp(trimEnd, -10, setTrimEnd)} className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder text-[10px] font-mono font-bold hover:border-oshipink transition-colors">-10s</button>
                        <button type="button" onClick={() => adjustTimestamp(trimEnd, -1, setTrimEnd)} className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder text-[10px] font-mono font-bold hover:border-oshipink transition-colors">-1s</button>
                        <button type="button" onClick={() => adjustTimestamp(trimEnd, 1, setTrimEnd)} className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder text-[10px] font-mono font-bold hover:border-oshipink transition-colors">+1s</button>
                      </div>
                    </div>
                  </div>

                  {isFirstInputVideo && (
                    <label className="flex items-center gap-2 pt-2 border-t border-subtleborder cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={trimAccurate}
                        onChange={(e) => setTrimAccurate(e.target.checked)}
                        className="accent-oshipink rounded"
                      />
                      <span className="text-[11px] font-mono font-bold text-ink">
                        Frame-accurate cut <span className="font-normal text-muted">(re-encodes H.264/AAC instead of keyframe copy)</span>
                      </span>
                    </label>
                  )}
                </div>
              )}

              {mode === 'gif' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FormLabel text="Frame rate" />
                      <CustomSelect
                        value={gifFps}
                        onChange={setGifFps}
                        options={[
                          { value: '10', label: '10 fps (Small)' },
                          { value: '15', label: '15 fps (Balanced)' },
                          { value: '24', label: '24 fps (Smooth)' },
                        ]}
                      />
                    </div>
                    <div>
                      <FormLabel text="Width" />
                      <CustomSelect
                        value={gifWidth}
                        onChange={setGifWidth}
                        options={[
                          { value: '480', label: '480 px' },
                          { value: '720', label: '720 px (HD)' },
                          { value: 'orig', label: 'Original' },
                        ]}
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-2 border-t border-subtleborder cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={gifUseRange}
                      onChange={(e) => setGifUseRange(e.target.checked)}
                      className="accent-oshipink rounded"
                    />
                    <span className="text-[11px] font-mono font-bold text-ink">Clip range (Start / End)</span>
                  </label>

                  {gifUseRange && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <FormLabel text="Start time (HH:MM:SS)" />
                        <Input
                          type="text"
                          value={trimStart}
                          onChange={e => setTrimStart(e.target.value)}
                          className="bg-panel font-mono text-xs"
                          placeholder="00:00:00"
                        />
                      </div>
                      <div>
                        <FormLabel text="End time (HH:MM:SS)" />
                        <Input
                          type="text"
                          value={trimEnd}
                          onChange={e => setTrimEnd(e.target.value)}
                          className="bg-panel font-mono text-xs"
                          placeholder="00:01:00"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {mode === 'mirror' && (
                <p className="text-xs font-mono font-medium text-ink leading-relaxed">
                  Flips the video horizontally across the vertical axis (left-to-right mirror transformation).
                </p>
              )}
            </div>

            {/* Output Directory */}
            <div className="shrink-0 space-y-1.5">
              <FormLabel text="Output folder" icon={FolderOpen} iconColor="text-muted" />
              <PathPicker
                value={outputDir}
                onChange={setOutputDir}
                placeholder="Select output directory..."
                directory={true}
              />
            </div>
          </PanelScrollArea>

          {/* Action Button */}
          <div className="pt-3 mt-3 border-t-2 border-subtleborder shrink-0">
            <ActionFooter
              onAction={handleProcess}
              actionLabel={`Process ${inputPaths.length} file${inputPaths.length !== 1 ? 's' : ''}`}
              disabled={inputPaths.length === 0 || !outputDir}
              loading={isProcessing}
              actionIcon={Play}
              onCancel={isProcessing && cancelFn ? cancelFn : undefined}
            />
          </div>
        </Panel>
      </Column>

      {/* RIGHT COLUMN: Process Log / Status */}
      <Column isSidebar>
        <div className="flex items-center justify-between px-1 select-none">
          <div className="flex items-center gap-1.5">
            <Settings2 className="w-4 h-4 text-toska" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink">Process Log</span>
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
                <FileAudio className="w-5 h-5" />
              </div>
              <span className="font-zen font-bold text-xs text-ink">No files processing</span>
              <span className="font-mono text-[10px] text-muted max-w-[200px] mt-1 leading-relaxed">
                Select media files on the left and click Process to start converting or trimming.
              </span>
            </div>
          ) : (
            <PanelScrollArea className="flex flex-col gap-2 p-3">
              {progresses.map((p, i) => (
                <BatchProgressItem
                  key={i}
                  title={p.file}
                  status={p.status}
                  percent={p.percent}
                  log={(p.status === 'error' || p.status === 'skipped') ? p.log : undefined}
                />
              ))}
            </PanelScrollArea>
          )}
        </Panel>
      </Column>
    </PageLayout>
  );
}
