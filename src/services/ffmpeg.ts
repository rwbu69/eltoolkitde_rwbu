import { Command } from '@tauri-apps/plugin-shell';
import { readDir, exists, mkdir } from '@tauri-apps/plugin-fs';
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';

async function notifySuccess(title: string, body: string) {
  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === 'granted';
  }
  if (permissionGranted) {
    sendNotification({ title, body });
  }
}

export interface Mp3ConvertOptions {
  inputDir: string;
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
  file: string;
  status: 'pending' | 'processing' | 'done' | 'error' | 'skipped';
  log?: string;
  percent?: number;
}

export class FfmpegService {
  static async convertToMp3(
    options: Mp3ConvertOptions,
    onProgress: (progress: FfmpegProgress) => void
  ): Promise<void> {
    const { inputDir, outputRoot, bitrate = '320k' } = options;
    
    // Polyfill for path operations
    const basename = (p: string) => p.split(/[\\/]/).pop() || p;
    const joinPath = (...parts: string[]) => parts.join('\\').replace(/\\\\/g, '\\');
    
    const srcName = basename(inputDir);
    const destFolder = joinPath(outputRoot, 'output_mp3', `${srcName}_mp3`);
    
    if (!(await exists(destFolder))) {
      await mkdir(destFolder, { recursive: true });
    }
    
    const entries = await readDir(inputDir);
    const files = entries
      .filter(e => e.isFile && /\.(mp4|mkv|avi|mov|webm|wav|m4a|aac|flac|ogg|wma)$/i.test(e.name))
      .map(e => e.name);
      
    if (files.length === 0) {
      throw new Error("No media files found in the directory.");
    }

    for (const file of files) {
      const baseName = file.replace(/\.[^.]+$/, '');
      const inputFile = joinPath(inputDir, file);
      const outputFile = joinPath(destFolder, `${baseName}.mp3`);
      
      if (await exists(outputFile)) {
        onProgress({ file, status: 'skipped', log: 'File already exists' });
        continue;
      }
      
      onProgress({ file, status: 'processing' });
      
      await new Promise<void>((resolve) => {
        const command = Command.sidecar('ffmpeg', [
          '-hide_banner', '-y', 
          '-i', inputFile, 
          '-map', '0:a:0?', '-vn', 
          '-codec:a', 'libmp3lame', 
          '-b:a', bitrate, 
          outputFile
        ]);
        
        command.on('close', (data) => {
          if (data.code !== 0) {
            onProgress({ file, status: 'error', log: `Exit code ${data.code}` });
            // continue with next file even if error
            resolve();
          } else {
            onProgress({ file, status: 'done' });
            resolve();
          }
        });
        
        command.on('error', (err) => {
          onProgress({ file, status: 'error', log: String(err) });
          resolve();
        });
        
        command.spawn().catch(() => {
          onProgress({ file, status: 'error', log: 'Failed to spawn ffmpeg' });
          resolve();
        });
      });
    }
    
    await notifySuccess('Konversi Audio Selesai', `Telah memproses file MP3.`);
  }

  static async mirrorMedia(
    options: MirrorOptions,
    onProgress: (progress: FfmpegProgress) => void
  ): Promise<void> {
    const { inputFiles, outputDir } = options;
    const basename = (p: string) => p.split(/[\\/]/).pop() || p;
    const joinPath = (...parts: string[]) => parts.join('\\').replace(/\\\\/g, '\\');
    
    for (const inputFile of inputFiles) {
      const base = basename(inputFile);
      const extMatch = base.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : '';
      const name = base.replace(new RegExp(`\\${ext}$`), '');
      
      const outputFile = joinPath(outputDir, `${name}-MIRROR${ext}`);
      
      onProgress({ file: base, status: 'processing', log: 'Starting mirror...', percent: 0 });
      
      // Get duration first
      let durationInSeconds = 0;
      try {
        const ffprobe = Command.sidecar('ffprobe', [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          inputFile
        ]);
        const probeResult = await ffprobe.execute();
        durationInSeconds = parseFloat(probeResult.stdout);
      } catch (err) {
        console.error('Failed to get duration:', err);
      }
      
      await new Promise<void>((resolve) => {
        const command = Command.sidecar('ffmpeg', [
          '-hide_banner', '-y', 
          '-i', inputFile, 
          '-vf', 'hflip', 
          '-vcodec', 'libx264',
          '-crf', '28',
          '-preset', 'medium',
          '-c:a', 'aac',
          '-b:a', '128k',
          outputFile
        ]);
        
        command.stderr.on('data', (line: string) => {
          const timeMatch = line.match(/time=\s*(\d+):(\d+):(\d+\.\d+)/);
          if (timeMatch && durationInSeconds > 0) {
            const h = parseInt(timeMatch[1], 10);
            const m = parseInt(timeMatch[2], 10);
            const s = parseFloat(timeMatch[3]);
            const currentTime = h * 3600 + m * 60 + s;
            const percent = Math.min(100, Math.round((currentTime / durationInSeconds) * 100));
            onProgress({ file: base, status: 'processing', log: `Mirroring... ${percent}%`, percent });
          }
        });
        
        command.on('close', (data) => {
          if (data.code !== 0) {
            onProgress({ file: base, status: 'error', log: `Exit code ${data.code}` });
          } else {
            onProgress({ file: base, status: 'done', percent: 100 });
          }
          resolve();
        });
        
        command.on('error', (err) => {
          onProgress({ file: base, status: 'error', log: String(err) });
          resolve();
        });
        
        command.spawn().catch(() => {
          onProgress({ file: base, status: 'error', log: 'Failed to spawn ffmpeg' });
          resolve();
        });
      });
    }
    
    await notifySuccess('Proses Mirror Selesai', `Telah memproses ${inputFiles.length} file.`);
  }

  static async trimMedia(
    options: TrimOptions,
    onProgress: (progress: FfmpegProgress) => void
  ): Promise<void> {
    const { inputFile, startTime, endTime, outputDir } = options;
    const basename = (p: string) => p.split(/[\\/]/).pop() || p;
    const joinPath = (...parts: string[]) => parts.join('\\').replace(/\\\\/g, '\\');
    
    const base = basename(inputFile);
    const extMatch = base.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : '';
    const name = base.replace(new RegExp(`\\${ext}$`), '');
    
    const outputFile = joinPath(outputDir, `${name} (trimmed)${ext}`);
    
    onProgress({ file: base, status: 'processing', log: 'Starting trim...' });
    
    return new Promise((resolve) => {
      const command = Command.sidecar('ffmpeg', [
        '-hide_banner', '-y', 
        '-i', inputFile, 
        '-ss', startTime, 
        '-to', endTime, 
        '-c', 'copy', 
        outputFile
      ]);
      
      command.on('close', (data) => {
        if (data.code !== 0) {
          onProgress({ file: base, status: 'error', log: `Exit code ${data.code}` });
        } else {
          onProgress({ file: base, status: 'done' });
          notifySuccess('Proses Pemotongan Selesai', `File: ${base}`);
        }
        resolve();
      });
      
      command.on('error', (err) => {
        onProgress({ file: base, status: 'error', log: String(err) });
        resolve();
      });
      
      command.spawn().catch(() => {
        onProgress({ file: base, status: 'error', log: 'Failed to spawn ffmpeg' });
        resolve();
      });
    });
  }
}
