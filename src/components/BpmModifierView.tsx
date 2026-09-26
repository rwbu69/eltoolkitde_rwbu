import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { BpmService, BpmProgress } from '../services/bpm';
import { FileAudio, PlayCircle, FolderOpen, Activity, Search, Edit3 } from 'lucide-react';
import { PageLayout, Column, SectionHeader, Panel, PanelScrollArea, FormLabel } from './ui/Layout';

interface SelectedFile {
  path: string;
  originalBPM?: number;
}

export default function BpmModifierView({ isActive = false }: { isActive?: boolean }) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [bpmRange, setBpmRange] = useState<string>('any');
  const [outputDir, setOutputDir] = useState<string>('');
  const [targetBPM, setTargetBPM] = useState<string>(''); 
  
  const [progresses, setProgresses] = useState<BpmProgress[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const handleSelectOutput = async () => {
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

  const handleDetect = async () => {
    if (selectedFiles.length === 0) return;
    setIsDetecting(true);
    setProgresses([]);

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
      });

      // Update selectedFiles with detected BPMs
      setSelectedFiles(prevFiles => {
        const newFiles = [...prevFiles];
        results.forEach(res => {
          const f = newFiles.find(x => x.path === res.file);
          if (f) f.originalBPM = res.originalBPM;
        });
        return newFiles;
      });

    } catch (err: any) {
      alert(err.message || String(err));
    } finally {
      setIsDetecting(false);
    }
  };

  const handleManualBpmEdit = (filePath: string, newBpmValue: string) => {
    setSelectedFiles(prev => prev.map(f => {
      if (f.path === filePath) {
        const val = parseFloat(newBpmValue);
        return { ...f, originalBPM: isNaN(val) ? undefined : val };
      }
      return f;
    }));
  };

  const handleExecute = async () => {
    const readyFiles = selectedFiles.filter(f => f.originalBPM !== undefined) as { path: string, originalBPM: number }[];
    if (readyFiles.length === 0 || !outputDir || !targetBPM) return;
    
    const bpmNumber = parseInt(targetBPM);
    if (isNaN(bpmNumber) || bpmNumber <= 0) {
      alert('Please enter a valid Target BPM');
      return;
    }

    setIsProcessing(true);
    // Keep detection progresses but start new ones for processing
    setProgresses([]);
    
    try {
      const payload = readyFiles.map(f => ({ file: f.path, originalBPM: f.originalBPM }));
      await BpmService.batchChangeTempo(payload, bpmNumber, outputDir, (p) => {
        setProgresses(prev => {
          const idx = prev.findIndex(x => x.file === p.file);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = p;
            return next;
          }
          return [...prev, p];
        });
      });
    } catch (err: any) {
      alert(err.message || String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const canDetect = selectedFiles.length > 0 && !isDetecting && !isProcessing;
  const canModify = selectedFiles.some(f => f.originalBPM !== undefined) && outputDir !== '' && targetBPM !== '' && !isDetecting && !isProcessing;

  return (
    <PageLayout>
      <Column>
        <SectionHeader title="BATCH BPM MODIFIER" icon={Activity} />

        <Panel className="flex flex-col">
          <PanelScrollArea className="flex flex-col gap-4 pr-2">
            
            {/* Phase 1: Input & Detection */}
            <div className="bg-appbg border-4 border-gameborder rounded-2xl p-4 shrink-0">
              <h3 className="flex items-center gap-1.5 font-zen font-black text-ink mb-3 border-b-2 border-gameborder pb-1.5 text-base">
                1. DETECT BPM
              </h3>

              <div className="space-y-4">
                <div>
                  <FormLabel text="INPUT FILES" icon={FileAudio} />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : ''}
                      readOnly
                      placeholder="Select audio files..."
                      className="game-input bg-panel"
                    />
                    <button 
                      onClick={handleSelectFiles}
                      className="game-btn-secondary px-4 h-12 flex items-center justify-center shrink-0 bg-panel"
                      title="Select Files"
                    >
                      <FolderOpen className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div>
                  <FormLabel text="EXPECTED BPM RANGE" />
                  <select 
                    value={bpmRange} 
                    onChange={e => setBpmRange(e.target.value)}
                    className="game-input bg-panel"
                  >
                    <option value="any">Any (No constraints)</option>
                    <option value="70-150">70 - 150 BPM (Hip-Hop / House)</option>
                    <option value="90-180">90 - 180 BPM (Pop / Bass)</option>
                    <option value="120-200">120 - 200 BPM (DnB / Hardstyle)</option>
                  </select>
                </div>
                
                <button 
                  onClick={handleDetect}
                  disabled={!canDetect}
                  className="game-btn-secondary w-full h-[40px] text-sm flex justify-center items-center gap-2"
                >
                  <Search className="w-4 h-4" /> {isDetecting ? 'DETECTING...' : 'DETECT BPMs'}
                </button>
              </div>
            </div>

            {/* Phase 2: Modify */}
            <div className="bg-appbg border-4 border-gameborder rounded-2xl p-4 shrink-0">
              <h3 className="flex items-center gap-1.5 font-zen font-black text-ink mb-3 border-b-2 border-gameborder pb-1.5 text-base">
                2. MODIFY TEMPO
              </h3>

              <div className="space-y-4">
                <div>
                  <FormLabel text="OUTPUT FOLDER" icon={FolderOpen} />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={outputDir}
                      readOnly
                      placeholder="Select output folder..."
                      className="game-input bg-panel"
                    />
                    <button 
                      onClick={handleSelectOutput}
                      className="game-btn-secondary px-4 h-12 flex items-center justify-center shrink-0 bg-panel"
                      title="Select Output Folder"
                    >
                      <FolderOpen className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div>
                  <FormLabel text="TARGET BPM" />
                  <input 
                    type="number" 
                    value={targetBPM} 
                    onChange={e => setTargetBPM(e.target.value)} 
                    className="game-input bg-panel" 
                    placeholder="Enter desired unified BPM (e.g. 192)" 
                  />
                </div>
              </div>
            </div>

          </PanelScrollArea>

          {/* Action Button */}
          <div className="pt-3 mt-3 border-t-4 border-appbg shrink-0">
            <button 
              onClick={handleExecute}
              disabled={!canModify}
              className="game-btn-primary w-full h-[48px] font-zen font-black text-base flex justify-center items-center gap-2"
            >
              <PlayCircle className="w-5 h-5" /> {isProcessing ? 'PROCESSING...' : `APPLY TARGET BPM`}
            </button>
          </div>
        </Panel>
      </Column>

      <Column isSidebar>
        <SectionHeader title="RESULTS" align="right" variant="secondary" />
        <Panel className="flex flex-col bg-appbg" noPadding>
          <div className="p-3 border-b-4 border-gameborder bg-panel rounded-t-2xl shrink-0 flex items-center justify-between">
            <FormLabel text="SELECTED FILES" />
          </div>
          <PanelScrollArea className="p-3">
            {selectedFiles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-2">
                <p className="text-sm font-bold font-zen">No files selected</p>
                <p className="text-[10px] font-mono text-center">Select files to begin</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedFiles.map((fileObj, i) => {
                  const fileName = fileObj.path.split('\\').pop() || fileObj.path.split('/').pop() || 'unknown';
                  const prog = progresses.find(p => p.file === fileName);
                  const isError = prog?.status === 'error';
                  const isDone = prog?.status === 'done';
                  
                  return (
                    <div key={i} className={`flex flex-col p-2.5 rounded-xl border-2 shrink-0 ${isError ? 'bg-softpink border-oshipink' : isDone && !isDetecting ? 'bg-softtoska border-toska' : 'bg-panel border-gameborder'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-muted truncate pr-2">FILE</span>
                        {prog && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-gameborder/20">
                            {prog.percent}%
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono font-bold text-ink truncate mb-2" title={fileName}>{fileName}</span>
                      
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-[10px] font-bold ${fileObj.originalBPM ? 'text-toska' : 'text-ink/40'}`}>
                          DETECTED BPM:
                        </span>
                        {fileObj.originalBPM !== undefined ? (
                          <div className="flex items-center gap-1 bg-appbg px-1.5 py-0.5 rounded border border-gameborder/30 focus-within:border-toska transition-colors" title="Click to manually correct BPM drift">
                            <input 
                              type="number" 
                              step="0.01"
                              value={fileObj.originalBPM}
                              onChange={(e) => handleManualBpmEdit(fileObj.path, e.target.value)}
                              className="w-14 bg-transparent text-right font-mono text-xs text-ink font-bold outline-none"
                            />
                            <Edit3 className="w-3 h-3 text-muted" />
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-ink/40">---</span>
                        )}
                      </div>
                      
                      {prog && (
                        <div className="mt-2 flex flex-col gap-1">
                          <div className="w-full h-1.5 bg-appbg rounded-full border border-gameborder/20 overflow-hidden shrink-0">
                            <div 
                              className={`h-full transition-all duration-300 ${isError ? 'bg-oshipink' : 'bg-toska'}`}
                              style={{ width: `${prog.percent}%` }}
                            />
                          </div>
                          {isError && <span className="text-[9px] font-bold text-oshipink text-right">FAILED</span>}
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
