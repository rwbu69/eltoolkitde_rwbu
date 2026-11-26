import { Command } from '@tauri-apps/plugin-shell';
import { exists, mkdir, remove, rename } from '@tauri-apps/plugin-fs';
import { basename, joinPath } from '../utils/path';
import { dispatchLog, notifySuccess } from '../utils/toolkitEvents';

export interface Mp3ConvertOptions {
  inputFiles: string[];
  outputRoot: string;
  bitrate?: string;
}

export interface MirrorOptions {
  inputFiles: string[];
  outputDir: string;
}

export interface TrimOptions {
  inputFile: string;
  startTime: string;
  endTime: string;
  outputDir: string;
}

export interface FfmpegProgress {
  id?: string;
  file: string;
  status: 'pending' | 'processing' | 'done' | 'error' | 'skipped';
  log?: string;
  percent?: number;
}

function splitStemAndExt(filePath: string): { base: string; name: string; ext: string } {
  const base = basename(filePath);
  const dotIndex = base.lastIndexOf('.');
  return {
    base,
    name: dotIndex !== -1 ? base.slice(0, dotIndex) : base,
    ext: dotIndex !== -1 ? base.slice(dotIndex) : '',
  };
}

function runFfmpegAtomic(options: {
  args: string[];
  id: string;
  fileLabel: string;
  tempFile: string;
  outputFile: string;
  logPrefix: string;
  isCancelled: () => boolean;
  onSpawn: (child: any) => void;
  onProgress: (progress: FfmpegProgress) => void;
  onStderrLine?: (line: string) => void;
  donePercent?: number;
}): Promise<boolean> {
  const {
    args,
    id,
    fileLabel,
    tempFile,
    outputFile,
    logPrefix,
    isCancelled,
    onSpawn,
    onProgress,
    onStderrLine,
    donePercent,
  } = options;

  return new Promise<boolean>((resolve) => {
    const command = Command.sidecar('ffmpeg', args);

    command.stdout.on('data', (line) => line.trim() && dispatchLog(`[${logPrefix}] ${line.trim()}`));
    command.stderr.on('data', (line: string) => {
      if (line.trim()) dispatchLog(`[${logPrefix}] ${line.trim()}`);
      onStderrLine?.(line);
    });

    command.on('close', async (data) => {
      if (isCancelled()) {
        onProgress({ id, file: fileLabel, status: 'error', log: 'Cancelled' });
        if (await exists(tempFile)) await remove(tempFile).catch(() => {});
        resolve(false);
        return;
      }
      if (data.code !== 0) {
        onProgress({ id, file: fileLabel, status: 'error', log: `Exit code ${data.code}` });
        if (await exists(tempFile)) await remove(tempFile).catch(() => {});
        resolve(false);
        return;
      }
      try {
        await rename(tempFile, outputFile);
        onProgress({ id, file: fileLabel, status: 'done', ...(donePercent !== undefined ? { percent: donePercent } : {}) });
        resolve(true);
      } catch (err) {
        if (await exists(tempFile)) await remove(tempFile).catch(() => {});
        onProgress({ id, file: fileLabel, status: 'error', log: `Failed to save output: ${String(err)}` });
        resolve(false);
      }
    });

    command.on('error', (err) => {
      if (!isCancelled()) onProgress({ id, file: fileLabel, status: 'error', log: String(err) });
      resolve(false);
    });

    command.spawn().then((child) => {
      onSpawn(child);
      if (isCancelled()) child.kill().catch(() => {});
    }).catch(() => {
      if (!isCancelled()) onProgress({ id, file: fileLabel, status: 'error', log: 'Failed to spawn ffmpeg' });
      resolve(false);
    });
  });
}

export class FfmpegService {
  static async convertToMp3(
    options: Mp3ConvertOptions,
    onProgress: (progress: FfmpegProgress) => void
  ): Promise<{ task: Promise<void>, cancel: () => void }> {
    const { inputFiles, outputRoot, bitrate = '320k' } = options;
    const destFolder = joinPath(outputRoot, 'output_mp3');

    if (!(await exists(destFolder))) {
      await mkdir(destFolder, { recursive: true });
    }
    if (inputFiles.length === 0) {
      throw new Error('No media files selected.');
    }

    let childProcess: any = null;
    let cancelled = false;
    const cancelFn = () => {
      cancelled = true;
      childProcess?.kill().catch(() => {});
    };

    const task = (async () => {
      for (const inputFile of inputFiles) {
        if (cancelled) break;
        const { base, name } = splitStemAndExt(inputFile);
        const outputFile = joinPath(destFolder, `${name}.mp3`);
        const tempFile = `${outputFile}.part`;

        if (await exists(outputFile)) {
          onProgress({ id: inputFile, file: base, status: 'skipped', log: 'File already exists' });
          continue;
        }

        onProgress({ id: inputFile, file: base, status: 'processing' });
        await runFfmpegAtomic({
          args: [
            '-hide_banner', '-y',
            '-i', inputFile,
            '-map', '0:a:0?', '-vn',
            '-codec:a', 'libmp3lame',
            '-b:a', bitrate,
            tempFile,
          ],
          id: inputFile,
          fileLabel: base,
          tempFile,
          outputFile,
          logPrefix: 'ffmpeg',
          isCancelled: () => cancelled,
          onSpawn: (child) => { childProcess = child; },
          onProgress,
        });
      }

      if (!cancelled) {
        await notifySuccess('Audio conversion complete', 'MP3 files have been processed.');
      }
    })();

    return { task, cancel: cancelFn };
  }

  static async mirrorMedia(
    options: MirrorOptions,
    onProgress: (progress: FfmpegProgress) => void
  ): Promise<{ task: Promise<void>, cancel: () => void }> {
    const { inputFiles, outputDir } = options;

    let childProcess: any = null;
    let cancelled = false;
    const cancelFn = () => {
      cancelled = true;
      childProcess?.kill().catch(() => {});
    };

    const task = (async () => {
      for (const inputFile of inputFiles) {
        if (cancelled) break;
        const { base, name, ext } = splitStemAndExt(inputFile);
        const outputFile = joinPath(outputDir, `${name}-MIRROR${ext}`);
        const tempFile = `${outputFile}.part`;

        if (await exists(outputFile)) {
          onProgress({ id: inputFile, file: base, status: 'skipped', log: 'File already exists' });
          continue;
        }

        onProgress({ id: inputFile, file: base, status: 'processing', log: 'Starting mirror...', percent: 0 });

        let durationInSeconds = 0;
        try {
          const ffprobe = Command.sidecar('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            inputFile,
          ]);
          const probeResult = await ffprobe.execute();
          durationInSeconds = parseFloat(probeResult.stdout);
        } catch (err) {
          console.error('Failed to get duration:', err);
        }

        if (cancelled) break;

        await runFfmpegAtomic({
          args: [
            '-hide_banner', '-y',
            '-i', inputFile,
            '-vf', 'hflip',
            '-vcodec', 'libx264',
            '-crf', '32',
            '-preset', 'veryfast',
            '-c:a', 'aac',
            '-b:a', '128k',
            tempFile,
          ],
          id: inputFile,
          fileLabel: base,
          tempFile,
          outputFile,
          logPrefix: 'ffmpeg mirror',
          isCancelled: () => cancelled,
          onSpawn: (child) => { childProcess = child; },
          onProgress,
          donePercent: 100,
          onStderrLine: (line) => {
            const timeMatch = line.match(/time=\s*(\d+):(\d+):(\d+\.\d+)/);
            if (timeMatch && durationInSeconds > 0 && !cancelled) {
              const h = parseInt(timeMatch[1], 10);
              const m = parseInt(timeMatch[2], 10);
              const s = parseFloat(timeMatch[3]);
              const currentTime = h * 3600 + m * 60 + s;
              const percent = Math.min(100, Math.round((currentTime / durationInSeconds) * 100));
              onProgress({ id: inputFile, file: base, status: 'processing', log: `Mirroring... ${percent}%`, percent });
            }
          },
        });
      }

      if (!cancelled) {
        await notifySuccess('Mirror processing complete', `Processed ${inputFiles.length} file${inputFiles.length === 1 ? '' : 's'}.`);
      }
    })();

    return { task, cancel: cancelFn };
  }

  static async trimMedia(
    options: TrimOptions,
    onProgress: (progress: FfmpegProgress) => void
  ): Promise<{ task: Promise<void>, cancel: () => void }> {
    const { inputFile, startTime, endTime, outputDir } = options;
    const { base, name, ext } = splitStemAndExt(inputFile);
    const outputFile = joinPath(outputDir, `${name} (trimmed)${ext}`);
    const tempFile = `${outputFile}.part`;

    if (await exists(outputFile)) {
      onProgress({ id: inputFile, file: base, status: 'skipped', log: 'File already exists' });
      return { task: Promise.resolve(), cancel: () => {} };
    }

    onProgress({ id: inputFile, file: base, status: 'processing', log: 'Starting trim...' });

    let childProcess: any = null;
    let cancelled = false;
    const cancelFn = () => {
      cancelled = true;
      childProcess?.kill().catch(() => {});
    };

    const task = (async () => {
      const ok = await runFfmpegAtomic({
        args: [
          '-hide_banner', '-y',
          '-i', inputFile,
          '-ss', startTime,
          '-to', endTime,
          '-c', 'copy',
          tempFile,
        ],
        id: inputFile,
        fileLabel: base,
        tempFile,
        outputFile,
        logPrefix: 'ffmpeg trim',
        isCancelled: () => cancelled,
        onSpawn: (child) => { childProcess = child; },
        onProgress,
      });

      if (ok && !cancelled) {
        await notifySuccess('Trim complete', `File: ${base}`);
      }
    })();

    return { task, cancel: cancelFn };
  }
}
