import { Command } from '@tauri-apps/plugin-shell';

const dispatchLog = (msg: string) => {
  window.dispatchEvent(new CustomEvent('toolkit-log', { detail: msg }));
};

export interface BpmProgress {
  file: string;
  originalBPM?: number;
  confidence?: 'high' | 'medium' | 'low';
  status: 'detecting' | 'processing' | 'done' | 'error';
  percent: number;
}

export class BpmService {
  static async detectBPM(filePath: string, minBpm?: number, maxBpm?: number): Promise<{bpm: number, confidence: 'high' | 'medium' | 'low'}> {
    dispatchLog(`[bpm_detector] Analyzing ${filePath}...`);
    
    let args = [filePath];
    if (minBpm !== undefined && maxBpm !== undefined && minBpm > 0 && maxBpm > minBpm) {
      args.push('--min', minBpm.toString(), '--max', maxBpm.toString());
      dispatchLog(`[bpm_detector] Constraining BPM between ${minBpm} and ${maxBpm}`);
    }

    const command = Command.sidecar('bpm_detector', args);
    const output = await command.execute();
    
    if (output.code !== 0) {
      dispatchLog(`[bpm_detector ERROR] ${output.stderr}`);
      throw new Error(`Failed to detect BPM: ${output.stderr}`);
    }
    
    // Stdout should be JSON
    let result;
    try {
      result = JSON.parse(output.stdout.trim());
    } catch (e) {
      dispatchLog(`[bpm_detector ERROR] Failed to parse JSON output: ${output.stdout}`);
      throw new Error(`Failed to parse BPM output: ${output.stdout}`);
    }

    if (result.error) {
      dispatchLog(`[bpm_detector ERROR] Python Error: ${result.error}`);
      throw new Error(`Python Error: ${result.error}`);
    }

    const bpm = result.bpm;
    const confidence = result.confidence || 'medium';

    if (typeof bpm !== 'number' || isNaN(bpm)) {
      dispatchLog(`[bpm_detector ERROR] Invalid BPM output: ${output.stdout}`);
      throw new Error(`Invalid BPM output: ${output.stdout}`);
    }
    dispatchLog(`[bpm_detector] Detected BPM: ${bpm} (Confidence: ${confidence})`);
    return { bpm, confidence };
  }

  static async batchDetectBPM(
    files: string[], 
    range: { min?: number, max?: number } | undefined,
    onProgress: (progress: BpmProgress) => void
  ): Promise<{ file: string, originalBPM: number, confidence: 'high' | 'medium' | 'low' }[]> {
    dispatchLog(`[bpm] Starting batch BPM detection for ${files.length} files...`);
    const results: { file: string, originalBPM: number, confidence: 'high' | 'medium' | 'low' }[] = [];
    
    for (const file of files) {
      const fileName = file.split('\\').pop() || file.split('/').pop() || 'unknown';
      try {
        onProgress({ file: fileName, status: 'detecting', percent: 50 });
        const { bpm: originalBPM, confidence } = await this.detectBPM(file, range?.min, range?.max);
        onProgress({ file: fileName, originalBPM, confidence, status: 'done', percent: 100 });
        results.push({ file, originalBPM, confidence });
      } catch (err: any) {
        console.error('Error detecting', file, err);
        dispatchLog(`[bpm ERROR] Failed detecting ${fileName}: ${err.message || String(err)}`);
        onProgress({ file: fileName, status: 'error', percent: 0 });
      }
    }
    dispatchLog(`[bpm] Batch detection completed.`);
    return results;
  }

  static async changeTempo(inputPath: string, outputPath: string, originalBPM: number, targetBPM: number): Promise<void> {
    const ratio = targetBPM / originalBPM;
    
    let atempoFilter = '';
    // ffmpeg's atempo filter allows ratios between 0.5 and 2.0. If outside, we must chain them.
    if (ratio > 2.0) {
      atempoFilter = `atempo=2.0,atempo=${ratio / 2.0}`;
    } else if (ratio < 0.5) {
      atempoFilter = `atempo=0.5,atempo=${ratio / 0.5}`;
    } else {
      atempoFilter = `atempo=${ratio}`;
    }

    dispatchLog(`[ffmpeg] Changing tempo from ${originalBPM} to ${targetBPM} (ratio: ${ratio.toFixed(2)})...`);
    
    // Call the ffmpeg sidecar
    const command = Command.sidecar('ffmpeg', [
      '-y', // Overwrite output files without asking
      '-i', inputPath,
      '-filter:a', atempoFilter,
      outputPath
    ]);

    const output = await command.execute();
    if (output.code !== 0) {
      dispatchLog(`[ffmpeg ERROR] ${output.stderr}`);
      throw new Error(`FFmpeg error: ${output.stderr}`);
    }
    dispatchLog(`[ffmpeg] Successfully saved to ${outputPath}`);
  }

  static async batchChangeTempo(
    filesWithBpm: { file: string, originalBPM: number }[], 
    targetBPM: number, 
    outputDir: string, 
    onProgress: (progress: BpmProgress) => void
  ): Promise<void> {
    dispatchLog(`[bpm] Starting batch tempo modifier to ${targetBPM} BPM...`);
    for (const item of filesWithBpm) {
      const { file, originalBPM } = item;
      const fileName = file.split('\\').pop() || file.split('/').pop() || 'unknown';
      try {
        const outputPath = `${outputDir}\\${targetBPM}BPM_${fileName}`; // Using simple string concat for Windows

        onProgress({ file: fileName, originalBPM, status: 'processing', percent: 50 });
        await this.changeTempo(file, outputPath, originalBPM, targetBPM);

        onProgress({ file: fileName, originalBPM, status: 'done', percent: 100 });
      } catch (err: any) {
        console.error('Error processing', file, err);
        dispatchLog(`[bpm ERROR] Failed processing ${fileName}: ${err.message || String(err)}`);
        onProgress({ file: fileName, originalBPM, status: 'error', percent: 0 });
      }
    }
    dispatchLog(`[bpm] Batch modification completed.`);
  }
}
