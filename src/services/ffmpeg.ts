import { Command } from '@tauri-apps/plugin-shell';
import { readDir, exists, mkdir } from '@tauri-apps/plugin-fs';

export interface Mp3ConvertOptions {
  inputDir: string;
  outputRoot: string;
  bitrate?: string;
}

export interface MirrorOptions {
  inputFile: string;
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
  }

  static async mirrorMedia(
    options: MirrorOptions,
    onProgress: (progress: FfmpegProgress) => void
  ): Promise<void> {
    const { inputFile, outputDir } = options;
    const basename = (p: string) => p.split(/[\\/]/).pop() || p;
    const joinPath = (...parts: string[]) => parts.join('\\').replace(/\\\\/g, '\\');
    
    const base = basename(inputFile);
    const extMatch = base.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : '';
    const name = base.replace(new RegExp(`\\${ext}$`), '');
    
    const outputFile = joinPath(outputDir, `${name} (mirrored)${ext}`);
    
    onProgress({ file: base, status: 'processing', log: 'Starting mirror...' });
    
    return new Promise((resolve) => {
      const command = Command.sidecar('ffmpeg', [
        '-hide_banner', '-y', 
        '-i', inputFile, 
        '-vf', 'hflip', 
        '-c:a', 'copy', 
        outputFile
      ]);
      
      command.on('close', (data) => {
        if (data.code !== 0) {
          onProgress({ file: base, status: 'error', log: `Exit code ${data.code}` });
        } else {
          onProgress({ file: base, status: 'done' });
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
