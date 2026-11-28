import { Command } from '@tauri-apps/plugin-shell';
import { exists, mkdir, remove, rename } from '@tauri-apps/plugin-fs';
import { basename, joinPath } from '../utils/path';
import { dispatchDebug, dispatchLog, notifySuccess } from '../utils/toolkitEvents';

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
  accurate?: boolean;
}

export interface GifOptions {
  inputFiles: string[];
  outputDir: string;
  fps?: number;
  width?: number | null;
  startTime?: string;
  endTime?: string;
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
    dispatchDebug('ffmpeg', `Spawning sidecar [${logPrefix}]`, args.join(' '));
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
    const { inputFile, startTime, endTime, outputDir, accurate = false } = options;
    const { base, name, ext } = splitStemAndExt(inputFile);
    const outputFile = joinPath(outputDir, `${name} (trimmed)${ext}`);
    const tempFile = `${outputFile}.part`;

    if (await exists(outputFile)) {
      onProgress({ id: inputFile, file: base, status: 'skipped', log: 'File already exists' });
      return { task: Promise.resolve(), cancel: () => {} };
    }

    onProgress({ id: inputFile, file: base, status: 'processing', log: accurate ? 'Frame-accurate trimming...' : 'Starting trim...' });

    let childProcess: any = null;
    let cancelled = false;
    const cancelFn = () => {
      cancelled = true;
      childProcess?.kill().catch(() => {});
    };

    const parseSec = (ts: string) => {
      const parts = ts.trim().split(':').map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) return 0;
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    };
    const durationSec = Math.max(0.1, parseSec(endTime) - parseSec(startTime));

    const args = accurate
      ? [
          '-hide_banner', '-y',
          '-ss', startTime,
          '-i', inputFile,
          '-t', durationSec.toFixed(3),
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '18',
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          '-c:a', 'aac',
          '-b:a', '192k',
          tempFile,
        ]
      : [
          '-hide_banner', '-y',
          '-i', inputFile,
          '-ss', startTime,
          '-to', endTime,
          '-c', 'copy',
          tempFile,
        ];

    const task = (async () => {
      const ok = await runFfmpegAtomic({
        args,
        id: inputFile,
        fileLabel: base,
        tempFile,
        outputFile,
        logPrefix: 'ffmpeg trim',
        isCancelled: () => cancelled,
        onSpawn: (child) => { childProcess = child; },
        onProgress,
        donePercent: 100,
        onStderrLine: accurate
          ? (line) => {
              const m = line.match(/time=\s*(\d+):(\d+):(\d+\.\d+)/);
              if (m && !cancelled) {
                const cur = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
                const percent = Math.min(100, Math.round((cur / durationSec) * 100));
                onProgress({ id: inputFile, file: base, status: 'processing', log: `Trimming... ${percent}%`, percent });
              }
            }
          : undefined,
      });

      if (ok && !cancelled) {
        await notifySuccess('Trim complete', `File: ${base}`);
      }
    })();

    return { task, cancel: cancelFn };
  }

  static async convertToGif(
    options: GifOptions,
    onProgress: (progress: FfmpegProgress) => void
  ): Promise<{ task: Promise<void>, cancel: () => void }> {
    const { inputFiles, outputDir, fps = 15, width = 720, startTime, endTime } = options;
    if (inputFiles.length === 0) {
      throw new Error('No media files selected.');
    }

    let childProcess: any = null;
    let cancelled = false;
    const cancelFn = () => {
      cancelled = true;
      childProcess?.kill().catch(() => {});
    };

    const parseSec = (ts: string) => {
      const parts = ts.trim().split(':').map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) return 0;
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    };

    const hasRange = Boolean(startTime && endTime);
    const rangeDuration = hasRange ? Math.max(0.1, parseSec(endTime!) - parseSec(startTime!)) : 0;

    const task = (async () => {
      for (const inputFile of inputFiles) {
        if (cancelled) break;
        const { base, name } = splitStemAndExt(inputFile);
        const outputFile = joinPath(outputDir, `${name}.gif`);
        const tempFile = `${outputFile}.part.gif`;

        if (await exists(outputFile)) {
          onProgress({ id: inputFile, file: base, status: 'skipped', log: 'File already exists' });
          continue;
        }

        onProgress({ id: inputFile, file: base, status: 'processing', log: 'Generating GIF...', percent: 0 });

        let totalDuration = rangeDuration;
        if (!hasRange) {
          try {
            const ffprobe = Command.sidecar('ffprobe', [
              '-v', 'error',
              '-show_entries', 'format=duration',
              '-of', 'default=noprint_wrappers=1:nokey=1',
              inputFile,
            ]);
            const probeResult = await ffprobe.execute();
            totalDuration = parseFloat(probeResult.stdout) || 0;
          } catch {
            // fallback without percentage
          }
        }

        if (cancelled) break;

        const scaleFilter = width ? `,scale=${width}:-1:flags=lanczos` : '';
        const vf = `fps=${fps}${scaleFilter},split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5`;

        const args = [
          '-hide_banner', '-y',
          ...(hasRange ? ['-ss', startTime!, '-t', rangeDuration.toFixed(3)] : []),
          '-i', inputFile,
          '-vf', vf,
          '-loop', '0',
          tempFile,
        ];

        await runFfmpegAtomic({
          args,
          id: inputFile,
          fileLabel: base,
          tempFile,
          outputFile,
          logPrefix: 'ffmpeg gif',
          isCancelled: () => cancelled,
          onSpawn: (child) => { childProcess = child; },
          onProgress,
          donePercent: 100,
          onStderrLine: (line) => {
            const m = line.match(/time=\s*(\d+):(\d+):(\d+\.\d+)/);
            if (m && totalDuration > 0 && !cancelled) {
              const cur = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
              const percent = Math.min(100, Math.round((cur / totalDuration) * 100));
              onProgress({ id: inputFile, file: base, status: 'processing', log: `Encoding GIF... ${percent}%`, percent });
            }
          },
        });
      }

      if (!cancelled) {
        await notifySuccess('GIF conversion complete', `Processed ${inputFiles.length} file${inputFiles.length === 1 ? '' : 's'}.`);
      }
    })();

    return { task, cancel: cancelFn };
  }
}
