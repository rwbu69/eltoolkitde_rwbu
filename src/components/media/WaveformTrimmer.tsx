import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import { Play, Pause, Square, Repeat, ZoomIn, Scissors, Loader2, AlertCircle } from 'lucide-react';
import { WaveformService } from '../../services/waveform';
import { Button } from '../ui/Button';

interface WaveformTrimmerProps {
  filePath: string;
  startTime: string;
  endTime: string;
  onRangeChange: (start: string, end: string) => void;
}

export function WaveformTrimmer({
  filePath,
  startTime,
  endTime,
  onRangeChange,
}: WaveformTrimmerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const activeRegionRef = useRef<Region | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayingSelection, setIsPlayingSelection] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const isPlayingSelectionRef = useRef(false);
  const isLoopingRef = useRef(false);
  useEffect(() => { isPlayingSelectionRef.current = isPlayingSelection; }, [isPlayingSelection]);
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  const onRangeChangeRef = useRef(onRangeChange);
  useEffect(() => { onRangeChangeRef.current = onRangeChange; }, [onRangeChange]);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [duration, setDuration] = useState(0);

  // Parse external start/end times in seconds
  const startSec = WaveformService.parseTimestampToSeconds(startTime);
  const endSec = WaveformService.parseTimestampToSeconds(endTime);

  // Initialize and load waveform
  useEffect(() => {
    let isCancelled = false;
    let wsInstance: WaveSurfer | null = null;
    let blobUrl: string | null = null;

    async function init() {
      if (!containerRef.current || !filePath) return;
      setIsLoading(true);
      setLoadError(null);

      try {
        // 1. Fetch pre-computed peaks from Rust Symphonia backend in < 50ms
        let peaksData: { peaks: number[]; duration_seconds: number } | null = null;
        try {
          peaksData = await WaveformService.getWaveform(filePath, 1000);
        } catch (err) {
          console.warn('[WaveformTrimmer] Rust peak extraction warning, fallback to client decode:', err);
        }

        if (isCancelled) return;

        // 2. Create media blob URL for audio preview playback
        blobUrl = await WaveformService.createMediaBlobUrl(filePath);
        if (isCancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        // 3. Setup Plugins
        const regions = RegionsPlugin.create();
        regionsPluginRef.current = regions;

        const timeline = timelineRef.current
          ? TimelinePlugin.create({
            container: timelineRef.current,
            primaryLabelInterval: 10,
            secondaryLabelInterval: 2,
            style: {
              fontSize: '10px',
              fontFamily: 'monospace',
              color: 'var(--color-muted)',
            },
          })
          : null;

        const plugins = timeline ? [regions, timeline] : [regions];

        // 4. Create WaveSurfer v7 instance
        wsInstance = WaveSurfer.create({
          container: containerRef.current,
          url: blobUrl,
          peaks: peaksData?.peaks && peaksData.peaks.length > 0 ? [peaksData.peaks] : undefined,
          duration: peaksData?.duration_seconds,
          waveColor: '#a6adc8',
          progressColor: '#94e2d5',
          cursorColor: '#f5c2e7',
          cursorWidth: 2,
          height: 84,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          normalize: true,
          plugins,
        });

        wavesurferRef.current = wsInstance;

        // 5. Handle Ready / Decode
        wsInstance.on('ready', () => {
          if (isCancelled) return;
          setIsLoading(false);
          const totalDuration = wsInstance!.getDuration();
          setDuration(totalDuration);

          // Calculate initial trim bounds
          const initStart = Math.min(Math.max(0, startSec), totalDuration);
          let initEnd = endSec > 0 ? Math.min(endSec, totalDuration) : Math.min(totalDuration, initStart + 60);
          if (initEnd <= initStart) initEnd = Math.min(totalDuration, initStart + 30);

          regions.clearRegions();
          const region = regions.addRegion({
            id: 'trim-cutter',
            start: initStart,
            end: initEnd,
            color: 'rgba(245, 194, 231, 0.22)',
            drag: true,
            resize: true,
          });

          activeRegionRef.current = region;

          // Notify parent if initialized
          onRangeChangeRef.current(
            WaveformService.formatSecondsToTimestamp(region.start),
            WaveformService.formatSecondsToTimestamp(region.end)
          );
        });

        // 6. Listen to Region Update Events (Two-Way Sync)
        regions.on('region-updated', (region) => {
          if (region.id === 'trim-cutter') {
            onRangeChangeRef.current(
              WaveformService.formatSecondsToTimestamp(region.start),
              WaveformService.formatSecondsToTimestamp(region.end)
            );
          }
        });

        // 7. Track playback status
        wsInstance.on('play', () => setIsPlaying(true));
        wsInstance.on('pause', () => {
          setIsPlaying(false);
          setIsPlayingSelection(false);
        });
        wsInstance.on('finish', () => {
          setIsPlaying(false);
          setIsPlayingSelection(false);
        });

        // Loop handling in region
        wsInstance.on('timeupdate', (currentTime) => {
          if (isPlayingSelectionRef.current && activeRegionRef.current) {
            const reg = activeRegionRef.current;
            if (currentTime >= reg.end) {
              if (isLoopingRef.current) {
                wsInstance?.setTime(reg.start);
                wsInstance?.play();
              } else {
                wsInstance?.pause();
                setIsPlayingSelection(false);
              }
            }
          }
        });

      } catch (err: any) {
        if (!isCancelled) {
          console.error('[WaveformTrimmer] Failed to initialize waveform:', err);
          setLoadError(String(err?.message || err || 'Failed to load audio waveform'));
          setIsLoading(false);
        }
      }
    }

    void init();

    return () => {
      isCancelled = true;
      if (wsInstance) {
        try {
          wsInstance.destroy();
        } catch {
          // ignore cleanup errors
        }
      }
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [filePath]);

  // Synchronize external timestamp edits (e.g. text inputs or +/- nudges) back to the waveform region
  useEffect(() => {
    const region = activeRegionRef.current;
    if (!region || duration <= 0) return;

    const deltaStart = Math.abs(region.start - startSec);
    const deltaEnd = Math.abs(region.end - endSec);

    // Only update if difference is more than 50ms to prevent jitter loop
    if (deltaStart > 0.05 || deltaEnd > 0.05) {
      const safeStart = Math.max(0, Math.min(startSec, duration));
      const safeEnd = Math.max(safeStart + 0.1, Math.min(endSec, duration));
      region.setOptions({
        start: safeStart,
        end: safeEnd,
      });
    }
  }, [startSec, endSec, duration]);

  // Handle Play Selection
  const handlePlaySelection = useCallback(() => {
    const ws = wavesurferRef.current;
    const region = activeRegionRef.current;
    if (!ws || !region) return;

    if (isPlayingSelection) {
      ws.pause();
      setIsPlayingSelection(false);
    } else {
      ws.setTime(region.start);
      ws.play();
      setIsPlayingSelection(true);
    }
  }, [isPlayingSelection]);

  // Handle Play / Pause Full
  const handlePlayPauseFull = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    setIsPlayingSelection(false);
    ws.playPause();
  }, []);

  // Handle Stop
  const handleStop = useCallback(() => {
    const ws = wavesurferRef.current;
    const region = activeRegionRef.current;
    if (!ws) return;
    ws.pause();
    if (region) {
      ws.setTime(region.start);
    } else {
      ws.setTime(0);
    }
    setIsPlaying(false);
    setIsPlayingSelection(false);
  }, []);

  // Handle Zoom change
  const handleZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setZoomLevel(value);
    wavesurferRef.current?.zoom(value);
  };

  // Fine-tune Nudge handlers
  const adjustRegion = (type: 'start' | 'end', deltaSec: number) => {
    const region = activeRegionRef.current;
    if (!region) return;

    let newStart = region.start;
    let newEnd = region.end;

    if (type === 'start') {
      newStart = Math.max(0, Math.min(region.start + deltaSec, region.end - 0.1));
    } else {
      newEnd = Math.min(duration, Math.max(region.end + deltaSec, region.start + 0.1));
    }

    region.setOptions({ start: newStart, end: newEnd });
    onRangeChange(
      WaveformService.formatSecondsToTimestamp(newStart),
      WaveformService.formatSecondsToTimestamp(newEnd)
    );
  };

  const selectedDuration = Math.max(0, endSec - startSec);

  return (
    <div className="w-full flex flex-col gap-2.5 bg-appbg border-2 border-subtleborder rounded-2xl p-3.5 select-none shrink-0 shadow-sm">
      {/* Top Header Row with Status & Duration */}
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-1.5 text-ink font-bold">
          <Scissors className="w-3.5 h-3.5 text-oshipink" />
          <span>Waveform Cutter</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {duration > 0 && (
            <span className="text-muted">
              Total: {WaveformService.formatSecondsToTimestamp(duration, false)}
            </span>
          )}
          <span className="font-bold text-oshipink bg-panel px-2 py-0.5 rounded-full border border-subtleborder">
            Trim: {WaveformService.formatSecondsToTimestamp(selectedDuration)}
          </span>
        </div>
      </div>

      {/* Waveform Canvas Area */}
      <div className="relative w-full rounded-xl bg-panel border-2 border-subtleborder overflow-hidden min-h-[105px] flex flex-col justify-center">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-panel/80 backdrop-blur-xs gap-2 font-mono text-xs text-muted">
            <Loader2 className="w-4 h-4 text-oshipink animate-spin" />
            <span>Analyzing audio waveform</span>
          </div>
        )}

        {loadError && (
          <div className="p-4 flex items-center gap-2 text-rose-500 font-mono text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{loadError} (Manual timestamps still supported below)</span>
          </div>
        )}

        {/* Waveform rendering target */}
        <div ref={containerRef} className="w-full cursor-pointer" />

        {/* Timeline ruler */}
        <div ref={timelineRef} className="w-full h-4 border-t border-subtleborder/50 bg-appbg/40" />
      </div>

      {/* Controls & Nudge Toolbar (Strict Tier 3 / h-8 controls) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-subtleborder">
        {/* Playback Controls */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="primary"
            size="sm"
            onClick={handlePlaySelection}
            disabled={isLoading || Boolean(loadError)}
            icon={isPlayingSelection ? Pause : Play}
            title="Preview only the trimmed section"
          >
            {isPlayingSelection ? 'Pause' : 'Play Selection'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handlePlayPauseFull}
            disabled={isLoading || Boolean(loadError)}
            icon={isPlaying && !isPlayingSelection ? Pause : Play}
            title="Play full track"
          >
            {isPlaying && !isPlayingSelection ? 'Pause' : 'Full'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleStop}
            disabled={isLoading || Boolean(loadError)}
            icon={Square}
            title="Stop playback"
          />

          <button
            type="button"
            onClick={() => setIsLooping(!isLooping)}
            className={`h-8 w-8 rounded-lg border-2 flex items-center justify-center transition-colors ${isLooping
                ? 'bg-oshipink text-buttontext border-gameborder font-bold'
                : 'bg-panel text-muted hover:text-ink border-subtleborder'
              }`}
            title={isLooping ? 'Looping enabled' : 'Click to enable preview loop'}
            aria-label="Toggle loop"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zoom Slider */}
        <div className="flex items-center gap-2 text-muted text-[10px] font-mono">
          <ZoomIn className="w-3.5 h-3.5 shrink-0" />
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={zoomLevel}
            onChange={handleZoom}
            className="w-20 accent-oshipink cursor-pointer h-1.5 bg-subtleborder rounded-lg"
            title="Zoom waveform for precise cuts"
            aria-label="Waveform zoom level"
          />
        </div>

        {/* Millisecond Nudges */}
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <span className="text-muted mr-1 font-bold">Start:</span>
          <button type="button" onClick={() => adjustRegion('start', -1)} className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder hover:border-oshipink font-bold">-1s</button>
          <button type="button" onClick={() => adjustRegion('start', 1)} className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder hover:border-oshipink font-bold">+1s</button>
          <button type="button" onClick={() => adjustRegion('start', -0.1)} className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder hover:border-oshipink font-bold text-[9px]">-100ms</button>
          <button type="button" onClick={() => adjustRegion('start', 0.1)} className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder hover:border-oshipink font-bold text-[9px]">+100ms</button>

          <span className="text-muted mx-1 font-bold ml-2">End:</span>
          <button type="button" onClick={() => adjustRegion('end', -1)} className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder hover:border-oshipink font-bold">-1s</button>
          <button type="button" onClick={() => adjustRegion('end', 1)} className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder hover:border-oshipink font-bold">+1s</button>
          <button type="button" onClick={() => adjustRegion('end', -0.1)} className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder hover:border-oshipink font-bold text-[9px]">-100ms</button>
          <button type="button" onClick={() => adjustRegion('end', 0.1)} className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder hover:border-oshipink font-bold text-[9px]">+100ms</button>
        </div>
      </div>
    </div>
  );
}
