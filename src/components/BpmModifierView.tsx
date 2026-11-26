import { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { BpmService, BpmProgress, BpmOutputFormat } from '../services/bpm';
import { useAppStore } from '../store/useAppStore';
import { basename } from '../utils/path';
import { FileAudio, PlayCircle, FolderOpen, Search, Edit3, AlertTriangle, Activity } from 'lucide-react';
import { PageLayout, Column, Panel, PanelScrollArea, FormLabel } from './ui/Layout';
import { Button } from './ui/Button';
import { CustomSelect } from './ui/CustomSelect';
import { PathPicker } from './ui/PathPicker';
import { Input } from './ui/Input';
import { ProgressBar } from './ui/ProgressBar';
import { InlineNotice } from './ui/InlineNotice';
import { getStatusLabel, getUserFacingError } from '../config/uiText';
import { showToast } from './ui/Toast';

interface SelectedFile {
  path: string;
  originalBPM?: number;
  confidence?: 'high' | 'medium' | 'low';
  candidates?: number[];
}

export default function BpmModifierView({ isActive = false }: { isActive?: boolean }) {
  const defaultOutputDir = useAppStore(s => s.settings.defaultOutputDir);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [bpmRange, setBpmRange] = useState<string>('any');
  const [outputDir, setOutputDir] = useState<string>(defaultOutputDir || '');
  const [targetBPM, setTargetBPM] = useState<string>(''); 
  const [outputFormat, setOutputFormat] = useState<BpmOutputFormat>('wav');
  
  const [progresses, setProgresses] = useState<BpmProgress[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState<string>('');
  const cancelRequested = useRef(false);

  useEffect(() => {
    if (!outputDir && defaultOutputDir) {
      setOutputDir(defaultOutputDir);
    }
  }, [outputDir, defaultOutputDir]);

  useEffect(() => {
    if (!isActive) return;
    const handleDrop = (e: any) => {
      const paths = e.detail as string[];
      if (paths && paths.length > 0) {
        setSelectedFiles(paths.map(path => ({ path })));
        setProgresses([]);
      }
    };
    window.addEventListener('toolkit-drop', handleDrop);
    return () => window.removeEventListener('toolkit-drop', handleDrop);
  }, [isActive]);

  const handleSelectFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac'] }]
      });
      if (selected && Array.isArray(selected)) {
        setSelectedFiles(selected.map(path => ({ path })));
        setProgresses([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDetect = async () => {
    if (selectedFiles.length === 0) return;
    setIsDetecting(true);
    cancelRequested.current = false;
    setProgresses([]);
    setNotice('');

    let range: { min: number, max: number } | undefined = undefined;
    if (bpmRange === '70-150') range = { min: 70, max: 150 };
    else if (bpmRange === '90-180') range = { min: 90, max: 180 };
    else if (bpmRange === '120-200') range = { min: 120, max: 200 };

    try {
      const files = selectedFiles.map(f => f.path);
      const results = await BpmService.batchDetectBPM(files, range, (p) => {
        setProgresses(prev => {
          const idx = prev.findIndex(x => x.file === p.file);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = p;
            return next;
          }
          return [...prev, p];
        });
      }, () => cancelRequested.current);

      setSelectedFiles(prevFiles => {
        const newFiles = [...prevFiles];
        results.forEach(res => {
          const f = newFiles.find(x => x.path === res.file);
          if (f) {
            f.originalBPM = res.originalBPM;
            f.confidence = res.confidence;
            f.candidates = res.candidates;
          }
        });
        return newFiles;
      });

    } catch (err: any) {
      showToast('BPM analysis failed.', 'error', getUserFacingError(err, 'Check the selected audio files and try again.').detail);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleManualBpmEdit = (filePath: string, newBpmValue: string) => {
    setSelectedFiles(prev => prev.map(f => {
      if (f.path === filePath) {
        const val = parseFloat(newBpmValue);
        return { ...f, originalBPM: isNaN(val) || val <= 0 ? undefined : val };
      }
      return f;
    }));
  };

  const handleExecute = async () => {
    const readyFiles = selectedFiles.filter(f => f.originalBPM !== undefined) as { path: string, originalBPM: number }[];
    if (readyFiles.length === 0 || !outputDir || !targetBPM) return;
    
    const bpmNumber = parseFloat(targetBPM);
    if (isNaN(bpmNumber) || bpmNumber < 20 || bpmNumber > 300) {
      showToast('Target BPM must be between 20 and 300.', 'warning');
      return;
    }

    setIsProcessing(true);
    cancelRequested.current = false;
    setNotice('');
    setProgresses([]);
    
    try {
      const payload = readyFiles.map(f => ({ file: f.path, originalBPM: f.originalBPM }));
      await BpmService.batchChangeTempo(payload, bpmNumber, outputDir, outputFormat, (p) => {
        setProgresses(prev => {
          const idx = prev.findIndex(x => x.file === p.file);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = p;
            return next;
          }
          return [...prev, p];
        });
      }, () => cancelRequested.current);
    } catch (err: any) {
      showToast('The BPM-adjusted files could not be created.', 'error', getUserFacingError(err, 'Check the output folder and try again.').detail);
    } finally {
      setIsProcessing(false);
    }
  };

  const canDetect = selectedFiles.length > 0 && !isDetecting && !isProcessing;
  const canModify = selectedFiles.some(f => f.originalBPM !== undefined && f.originalBPM > 0) && outputDir !== '' && targetBPM !== '' && !isDetecting && !isProcessing;
  const detectedCount = selectedFiles.filter(f => f.originalBPM !== undefined).length;

  return (
    <PageLayout>
      {/* LEFT COLUMN: Input & Step 1 / Step 2 */}
      <Column>
        <div className="flex items-center justify-between px-1 select-none">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-oshipink" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink">BPM Setup</span>
          </div>
          {selectedFiles.length > 0 && (
            <span className="text-[10px] font-mono font-bold text-muted bg-panel border-2 border-subtleborder px-2 py-0.5 rounded-full">
              {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <Panel className="flex-1 flex flex-col min-w-0">
          <PanelScrollArea className="flex flex-col gap-4">
            
            {/* Step 1: Input & Detection */}
            <div className="bg-appbg border border-subtleborder rounded-2xl p-3.5 sm:p-4 shrink-0 space-y-3">
              <div className="flex items-center justify-between border-b border-subtleborder pb-1.5">
                <h3 className="font-zen font-bold text-ink text-xs">
                  1. Detect tempo
                </h3>
                {detectedCount > 0 && (
                  <span className="text-[10px] font-mono font-bold text-toska">
                    {detectedCount}/{selectedFiles.length} detected
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <FormLabel text="Audio files" icon={FileAudio} />
                  <div className="flex gap-2 items-center">
                    <Input
                      type="text"
                      value={selectedFiles.length > 0 ? `${selectedFiles.length} audio file(s) selected` : ''}
                      readOnly
                      placeholder="Select audio files..."
                      className="bg-panel text-xs h-10 flex-1 min-w-0"
                    />
                    <Button 
                      onClick={handleSelectFiles}
                      variant="secondary"
                      size="md"
                      className="h-10 w-10 !px-0 flex items-center justify-center shrink-0 rounded-xl"
                      title="Select Audio Files"
                      aria-label="Select Audio Files"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-muted mb-1">Expected genre range</label>
                    <CustomSelect
                      options={[
                        { value: 'any', label: 'Any (No constraints)' },
                        { value: '70-150', label: '70 - 150 BPM (Hip-Hop / House)' },
                        { value: '90-180', label: '90 - 180 BPM (Pop / Bass)' },
                        { value: '120-200', label: '120 - 200 BPM (DnB / Hardstyle)' },
                      ]}
                      value={bpmRange}
                      onChange={setBpmRange}
                      className="w-full shrink-0"
                    />
                  </div>
                  
                  <Button 
                    onClick={handleDetect}
                    disabled={!canDetect}
                    variant="secondary"
                    size="md"
                    icon={Search}
                    className="h-10 text-xs"
                    fullWidth
                  >
                    {isDetecting ? 'Analyzing tempo...' : 'Detect BPM'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 2: Modify Tempo */}
            <div className="bg-appbg border border-subtleborder rounded-2xl p-3.5 sm:p-4 shrink-0 space-y-3">
              <h3 className="font-zen font-bold text-ink text-xs border-b border-subtleborder pb-1.5">
                2. Adjust tempo
              </h3>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-muted mb-1">Target BPM</label>
                    <Input 
                      type="number" 
                      value={targetBPM} 
                      onChange={e => setTargetBPM(e.target.value)} 
                      className="bg-panel text-xs h-10" 
                      placeholder="e.g. 128" 
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono font-bold text-muted mb-1">Output format</label>
                    <CustomSelect
                      options={[
                        { value: 'wav', label: 'WAV (Lossless)' },
                        { value: 'mp3', label: 'MP3 (Compressed)' },
                      ]}
                      value={outputFormat}
                      onChange={(val) => setOutputFormat(val as BpmOutputFormat)}
                      className="w-full shrink-0"
                    />
                  </div>
                </div>

                <div>
                  <FormLabel text="Output folder" icon={FolderOpen} />
                  <PathPicker 
                    value={outputDir}
                    onChange={setOutputDir}
                    placeholder="Select output folder..."
                    directory={true}
                  />
                </div>
              </div>
            </div>

          </PanelScrollArea>

          {/* Action Button */}
          <div className="pt-3 mt-3 border-t-2 border-subtleborder shrink-0">
            <Button 
              onClick={() => {
                if (isProcessing) {
                  cancelRequested.current = true;
                  setNotice('Cancellation requested. The current file will finish before the batch stops.');
                  return;
                }
                void handleExecute();
              }}
              disabled={!canModify && !isProcessing}
              variant="primary"
              size="lg"
              icon={PlayCircle}
              fullWidth
            >
              {isProcessing ? 'Stop after current file' : 'Apply target BPM'}
            </Button>
          </div>
          {notice && <InlineNotice message={notice} tone="error" />}
        </Panel>
      </Column>

      {/* RIGHT COLUMN: Results */}
      <Column isSidebar>
        <div className="flex items-center justify-between px-1 select-none">
          <div className="flex items-center gap-1.5">
            <Search className="w-4 h-4 text-toska" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink">Analysis & Results</span>
          </div>
          {selectedFiles.length > 0 && (
            <span className="text-[10px] font-mono font-bold text-muted bg-panel border-2 border-subtleborder px-2 py-0.5 rounded-full">
              {detectedCount}/{selectedFiles.length} analyzed
            </span>
          )}
        </div>

        <Panel className="gap-3 bg-appbg flex-1 min-h-min xl:min-h-0" noPadding>
          {selectedFiles.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto">
              <div className="w-12 h-12 rounded-2xl border-2 border-subtleborder bg-panel flex items-center justify-center mb-3 text-muted/60 shadow-sm">
                <Activity className="w-5 h-5" />
              </div>
              <span className="font-zen font-bold text-xs text-ink">No files selected</span>
              <span className="font-mono text-[10px] text-muted max-w-[200px] mt-1 leading-relaxed">
                Add audio tracks on the left and run Detect BPM to see tempo results.
              </span>
            </div>
          ) : (
            <PanelScrollArea className="flex flex-col gap-2 p-3">
              {selectedFiles.map((fileObj, i) => {
                const fileName = basename(fileObj.path) || 'unknown';
                const prog = progresses.find(p => p.file === fileName);
                const isError = prog?.status === 'error';
                const isDone = prog?.status === 'done';
                
                return (
                  <div key={i} className={`flex flex-col p-2.5 rounded-xl border transition-colors shrink-0 ${
                    isError ? 'bg-softpink/40 border-oshipink/40' :
                    isDone && !isDetecting ? 'bg-softtoska/30 border-toska/40' :
                    'bg-panel border-subtleborder'
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-mono font-bold text-muted truncate pr-2">File</span>
                      {prog && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-appbg border border-subtleborder">
                          {prog.percent}%
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-ink truncate mb-2" title={fileName}>{fileName}</span>
                    
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-mono font-bold ${fileObj.originalBPM ? 'text-toska' : 'text-muted'}`}>
                        Detected BPM:
                      </span>
                      {fileObj.originalBPM !== undefined ? (
                        <div className="flex items-center gap-1.5">
                          {(fileObj.confidence === 'low' || fileObj.confidence === 'medium') && (
                            <div title={`Confidence: ${fileObj.confidence.toUpperCase()}. Please verify the BPM.`}>
                              <AlertTriangle className="w-3.5 h-3.5 text-oshipink" />
                            </div>
                          )}
                          <div className="flex items-center gap-1 bg-appbg px-1.5 py-0.5 rounded border border-subtleborder focus-within:border-toska transition-colors" title="Click to manually edit BPM">
                            <input 
                              type="number" 
                              step="0.01"
                              value={fileObj.originalBPM}
                              onChange={(e) => handleManualBpmEdit(fileObj.path, e.target.value)}
                              className="w-12 bg-transparent text-right font-mono text-xs text-ink font-bold outline-none"
                            />
                            <Edit3 className="w-3 h-3 text-muted" />
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono text-muted">---</span>
                      )}
                    </div>
                    
                    {prog && (
                      <div className="mt-2 flex flex-col gap-1">
                        <ProgressBar percent={prog.percent} status={prog.status} />
                        {isError && <span className="text-[9px] font-mono font-bold text-oshipink text-right">{getStatusLabel('error')}</span>}
                      </div>
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
