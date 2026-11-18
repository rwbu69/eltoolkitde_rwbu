import { invoke } from '@tauri-apps/api/core';
import { readDir, exists, rename, remove, copyFile } from '@tauri-apps/plugin-fs';
import { basename, dirname, joinPath } from '../utils/path';
import { dispatchLog } from '../utils/toolkitEvents';

export interface AudioMetadataDto {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  track?: number;
  genre?: string;
  duration_seconds?: number;
}

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
  backupPath?: string;
  inputPath?: string;
}

const SUPPORTED_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.ogg', '.wav', '.opus', '.aac'];

function isSupportedAudioFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export class MetadataService {
  static async readMetadata(filePath: string): Promise<AudioMetadataDto> {
    return await invoke<AudioMetadataDto>('read_audio_tags', { path: filePath });
  }

  static async restoreBackup(inputPath: string, backupPath: string): Promise<void> {
    if (!(await exists(backupPath))) {
      throw new Error('The metadata backup no longer exists.');
    }
    const temporaryPath = `${inputPath}.restore.tmp`;
    if (await exists(temporaryPath)) await remove(temporaryPath);
    await copyFile(backupPath, temporaryPath);
    await remove(inputPath);
    await rename(temporaryPath, inputPath);
  }

  static async processMetadata(
    options: MetadataOptions,
    onProgress: (progress: MetadataProgress) => void
  ): Promise<{ task: Promise<void>, cancel: () => void }> {
    const { mode, inputPath, title, artist, album, year } = options;
    
    let filesToProcess: string[] = [];
    
    if (mode === 'file') {
      filesToProcess.push(inputPath);
    } else {
      if (await exists(inputPath)) {
        const entries = await readDir(inputPath);
        for (const entry of entries) {
          if (entry.isFile && isSupportedAudioFile(entry.name)) {
            filesToProcess.push(joinPath(inputPath, entry.name));
          }
        }
      }
    }
    
    if (filesToProcess.length === 0) {
      throw new Error("No supported audio files found.");
    }
    
    let cancelled = false;

    const cancelFn = () => {
      cancelled = true;
    };

    const parsedYear = year ? parseInt(year, 10) : undefined;
    const tagPayload: AudioMetadataDto = {
      title: title || undefined,
      artist: artist || undefined,
      album: album || undefined,
      year: Number.isFinite(parsedYear) ? parsedYear : undefined,
    };

    const task = (async () => {
      for (const inputFile of filesToProcess) {
        if (cancelled) break;
        
        const fileName = basename(inputFile);
        const baseName = fileName.replace(/\.[^.]+$/, '');
        const dir = dirname(inputFile);
        const backupPath = joinPath(dir, `${baseName}.metadata-backup.mp3`);
        
        onProgress({ file: fileName, status: 'processing', inputPath: inputFile });
        
        try {
          if (!(await exists(backupPath))) {
            await copyFile(inputFile, backupPath);
          }

          await invoke('write_audio_tags', {
            path: inputFile,
            tags: tagPayload
          });

          dispatchLog(`[metadata] Successfully updated tags for ${fileName}`);
          onProgress({ file: fileName, status: 'done', backupPath, inputPath: inputFile });
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          dispatchLog(`[metadata ERROR] Failed to update tags for ${fileName}: ${errMsg}`);
          onProgress({ file: fileName, status: 'error', log: errMsg, inputPath: inputFile });
        }
      }
    })();

    return { task, cancel: cancelFn };
  }
}
