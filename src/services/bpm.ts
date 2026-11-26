import { invoke } from '@tauri-apps/api/core';
import { Command } from '@tauri-apps/plugin-shell';
import { exists, remove, rename } from '@tauri-apps/plugin-fs';
import { basename, joinPath } from '../utils/path';
import { dispatchLog } from '../utils/toolkitEvents';

export type BpmOutputFormat = 'wav' | 'mp3';

export interface BpmProgress {
  file: string;
  originalBPM?: number;
  confidence?: 'high' | 'medium' | 'low';
  status: 'detecting' | 'processing' | 'done' | 'error' | 'canceled';
  percent: number;
}

export interface BpmDetectionResult {
  bpm: number;
  confidence: 'high' | 'medium' | 'low';
  candidates: number[];
}

export function buildAtempoFilter(tempoRatio: number): string {
  if (!Number.isFinite(tempoRatio) || tempoRatio <= 0) {
    throw new Error(`Invalid tempo ratio: ${tempoRatio}. Ratio must be a positive number.`);
  }

  let r = tempoRatio;
  const filters: string[] = [];
  while (r > 2.0) {
    filters.push('atempo=2.0');
    r /= 2.0;
  }
  while (r < 0.5) {
    filters.push('atempo=0.5');
    r /= 0.5;
  }
  filters.push(`atempo=${Number(r.toFixed(4))}`);
  return filters.join(',');
}

export class BpmService {
  static async detectBPM(filePath: string, minBpm?: number, maxBpm?: number): Promise<BpmDetectionResult> {
    dispatchLog(`[bpm_detector] Analyzing ${filePath}...`);

    try {
      const result = await invoke<{ bpm: number; confidence: 'high' | 'medium' | 'low'; candidates: number[] }>('detect_audio_bpm', {
        path: filePath,
        minBpm: minBpm && minBpm > 0 ? minBpm : undefined,
        maxBpm: maxBpm && maxBpm > 0 ? maxBpm : undefined,
      });

      const bpm = result.bpm;
      const confidence = result.confidence || 'medium';
      const candidates = Array.isArray(result.candidates)
        ? result.candidates.filter((value: unknown): value is number => typeof value === 'number' && Number.isFinite(value))
        : [bpm];

      if (typeof bpm !== 'number' || isNaN(bpm)) {
        throw new Error(`Invalid BPM result received: ${bpm}`);
      }

      dispatchLog(`[bpm_detector] Detected BPM: ${bpm} (Confidence: ${confidence})`);
      return { bpm, confidence, candidates };
    } catch (err: any) {
      const msg = err?.message || String(err);
      dispatchLog(`[bpm_detector ERROR] ${msg}`);
      throw new Error(`Failed to detect BPM: ${msg}`);
    }
  }

  static async batchDetectBPM(
    files: string[], 
    range: { min?: number, max?: number } | undefined,
    onProgress: (progress: BpmProgress) => void,
    isCancelled: () => boolean = () => false
  ): Promise<{ file: string, originalBPM: number, confidence: 'high' | 'medium' | 'low', candidates: number[] }[]> {
    dispatchLog(`[bpm] Starting batch BPM detection for ${files.length} files...`);
    const results: { file: string, originalBPM: number, confidence: 'high' | 'medium' | 'low', candidates: number[] }[] = [];
    
    for (const [index, file] of files.entries()) {
      if (isCancelled()) break;
      const fileName = basename(file) || 'unknown';
      try {
        onProgress({ file: fileName, status: 'detecting', percent: 50 });
        const { bpm: originalBPM, confidence, candidates } = await this.detectBPM(file, range?.min, range?.max);
        onProgress({ file: fileName, originalBPM, confidence, status: 'done', percent: Math.round(((index + 1) / files.length) * 100) });
        results.push({ file, originalBPM, confidence, candidates });
      } catch (err: any) {
        console.error('Error detecting', file, err);
        dispatchLog(`[bpm ERROR] Failed detecting ${fileName}: ${err.message || String(err)}`);
        onProgress({ file: fileName, status: 'error', percent: 0 });
      }
    }
    dispatchLog(`[bpm] Batch detection completed.`);
    return results;
  }

  static async changeTempo(
    inputPath: string,
    outputPath: string,
    originalBPM: number,
    targetBPM: number,
    format: BpmOutputFormat,
    onSpawn?: (child: any) => void,
    isCancelled: () => boolean = () => false
  ): Promise<void> {
    if (!originalBPM || originalBPM <= 0) {
      throw new Error(`Invalid original BPM: ${originalBPM}`);
    }
    if (!targetBPM || targetBPM <= 0) {
      throw new Error(`Invalid target BPM: ${targetBPM}`);
    }

    const tempoRatio = targetBPM / originalBPM;
    const filterString = buildAtempoFilter(tempoRatio);
    dispatchLog(`[bpm_tempo] Adjusting tempo (${originalBPM} -> ${targetBPM} BPM, ratio: ${tempoRatio.toFixed(3)}) as ${format.toUpperCase()}...`);

    const tempOutput = `${outputPath}.part`;
    const ffmpegArgs = [
      '-hide_banner',
      '-y',
      '-i', inputPath,
      '-filter:a', filterString,
    ];

    if (format === 'mp3') {
      ffmpegArgs.push('-codec:a', 'libmp3lame', '-q:a', '2', '-f', 'mp3');
    } else {
      ffmpegArgs.push('-codec:a', 'pcm_s16le', '-f', 'wav');
    }
    ffmpegArgs.push(tempOutput);

    const command = Command.sidecar('ffmpeg', ffmpegArgs);
    let code: number | null = null;
    let stderr = '';

    if (typeof command.spawn === 'function' && command.stderr) {
      command.stderr.on('data', (line) => {
        stderr += line;
      });

      code = await new Promise<number | null>((resolve, reject) => {
        command.on('close', (res) => resolve(res.code));
        command.on('error', (err) => reject(err));
        command.spawn().then((child) => {
          onSpawn?.(child);
          if (isCancelled()) child.kill().catch(() => {});
        }).catch(reject);
      });
    } else {
      const output = await command.execute();
      code = output.code;
      stderr = output.stderr;
    }

    if (isCancelled()) {
      if (await exists(tempOutput)) await remove(tempOutput).catch(() => {});
      throw new Error('Canceled by user');
    }

    if (code !== 0) {
      if (await exists(tempOutput)) await remove(tempOutput).catch(() => {});
      dispatchLog(`[bpm_tempo ERROR] ${stderr}`);
      throw new Error(`BPM modification error: ${stderr || `exit code ${code}`}`);
    }

    if (await exists(outputPath)) await remove(outputPath);
    await rename(tempOutput, outputPath);
    dispatchLog(`[bpm_tempo] Successfully saved tempo-adjusted audio to ${outputPath}`);
  }

  static async batchChangeTempo(
    filesWithBpm: { file: string, originalBPM: number }[], 
    targetBPM: number,
    outputDir: string,
    format: BpmOutputFormat,
    onProgress: (progress: BpmProgress) => void,
    isCancelled: () => boolean = () => false,
    onSpawn?: (child: any) => void
  ): Promise<void> {
    dispatchLog(`[bpm] Starting batch tempo modifier to ${targetBPM} BPM...`);
    for (const [index, item] of filesWithBpm.entries()) {
      if (isCancelled()) break;
      const { file, originalBPM } = item;
      const fileName = basename(file) || 'unknown';
      try {
        const outputPath = joinPath(outputDir, `${targetBPM}BPM_${fileName.replace(/\.[^.]+$/, '')}.${format}`);

        onProgress({ file: fileName, originalBPM, status: 'processing', percent: 50 });
        await this.changeTempo(file, outputPath, originalBPM, targetBPM, format, onSpawn, isCancelled);

        onProgress({ file: fileName, originalBPM, status: 'done', percent: Math.round(((index + 1) / filesWithBpm.length) * 100) });
      } catch (err: any) {
        console.error('Error processing', file, err);
        dispatchLog(`[bpm ERROR] Failed processing ${fileName}: ${err.message || String(err)}`);
        onProgress({ file: fileName, originalBPM, status: 'error', percent: 0 });
      }
    }
    dispatchLog(`[bpm] Batch modification completed.`);
  }
}
