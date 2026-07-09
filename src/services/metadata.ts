import { Command } from '@tauri-apps/plugin-shell';
import { readDir, exists, rename, remove } from '@tauri-apps/plugin-fs';

export interface MetadataOptions {
  mode: 'file' | 'folder';
  inputPath: string;
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
}

export interface MetadataProgress {
  file: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  log?: string;
}

export class MetadataService {
  static async processMetadata(
    options: MetadataOptions,
    onProgress: (progress: MetadataProgress) => void
  ): Promise<void> {
    const { mode, inputPath, title, artist, album, year } = options;
    
    // Polyfills
    const basename = (p: string) => p.split(/[\\/]/).pop() || p;
    const dirname = (p: string) => p.substring(0, Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))) || p;
    const joinPath = (...parts: string[]) => parts.join('\\').replace(/\\\\/g, '\\');
    
    let filesToProcess: string[] = [];
    
    if (mode === 'file') {
      filesToProcess.push(inputPath);
    } else {
      if (await exists(inputPath)) {
        const entries = await readDir(inputPath);
        for (const entry of entries) {
          if (entry.isFile && entry.name.toLowerCase().endsWith('.mp3')) {
            filesToProcess.push(joinPath(inputPath, entry.name));
          }
        }
      }
    }
    
    if (filesToProcess.length === 0) {
      throw new Error("No MP3 files found.");
    }
    
    let metaArgs: string[] = [];
    if (title) metaArgs.push('-metadata', `title=${title}`);
    if (artist) metaArgs.push('-metadata', `artist=${artist}`);
    if (album) metaArgs.push('-metadata', `album=${album}`);
    if (year) metaArgs.push('-metadata', `date=${year}`);
    
    for (const inputFile of filesToProcess) {
      const baseName = basename(inputFile).replace(/\.[^.]+$/, '');
      const dir = dirname(inputFile);
      const tempFile = joinPath(dir, `${baseName}_temp.mp3`);
      
      onProgress({ file: basename(inputFile), status: 'processing' });
      
      await new Promise<void>((resolve) => {
        const command = Command.sidecar('ffmpeg', [
          '-hide_banner', '-y', 
          '-i', inputFile, 
          '-map', '0:a', '-c', 'copy', 
          '-id3v2_version', '3', '-write_id3v1', '1', 
          ...metaArgs, tempFile
        ]);
        
        command.on('close', async (data) => {
          if (data.code !== 0) {
            onProgress({ file: basename(inputFile), status: 'error', log: 'Failed to write metadata' });
            if (await exists(tempFile)) await remove(tempFile);
          } else {
            await rename(tempFile, inputFile);
            onProgress({ file: basename(inputFile), status: 'done' });
          }
          resolve();
        });
        
        command.on('error', (err) => {
          onProgress({ file: basename(inputFile), status: 'error', log: String(err) });
          resolve();
        });
        
        command.spawn().catch(() => {
          onProgress({ file: basename(inputFile), status: 'error', log: 'Failed to spawn ffmpeg' });
          resolve();
        });
      });
    }
  }
}
