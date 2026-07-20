import { invoke } from '@tauri-apps/api/core';
import { readDir, exists } from '@tauri-apps/plugin-fs';

export interface RenameOptions {
  mode: 'find-replace' | 'prefix-suffix' | 'numbering';
  inputPath: string; // Directory
  
  // Find & Replace
  findText?: string;
  replaceText?: string;
  caseSensitive?: boolean;

  // Prefix / Suffix
  prefix?: string;
  suffix?: string;

  // Numbering
  baseName?: string;
  startNumber?: number;
  padding?: number;
}

export interface RenamePreview {
  oldPath: string;
  oldName: string;
  newPath: string;
  newName: string;
  status: 'ok' | 'collision' | 'exists';
}

export interface RenameProgress {
  file: string; // old name
  status: 'pending' | 'processing' | 'done' | 'error';
  log?: string;
}

export class RenameService {
  static async generatePreview(options: RenameOptions): Promise<RenamePreview[]> {
    const { inputPath, mode } = options;
    
    const joinPath = (...parts: string[]) => parts.join('\\').replace(/\\\\/g, '\\');
    
    if (!(await exists(inputPath))) {
      throw new Error("Directory does not exist.");
    }
    
    const entries = await readDir(inputPath);
    // Filter only files
    const files = entries.filter(e => e.isFile).map(e => e.name).sort();
    
    if (files.length === 0) {
      throw new Error("No files found in the directory.");
    }

    const previews: RenamePreview[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const oldName = files[i];
      let newName = oldName;
      
      const dotIndex = oldName.lastIndexOf('.');
      const ext = dotIndex !== -1 ? oldName.substring(dotIndex) : '';
      const nameWithoutExt = dotIndex !== -1 ? oldName.substring(0, dotIndex) : oldName;
      
      let baseNewName = nameWithoutExt;

      if (mode === 'find-replace') {
        const find = options.findText || '';
        const replace = options.replaceText || '';
        if (find) {
          if (options.caseSensitive) {
            baseNewName = baseNewName.split(find).join(replace);
          } else {
            const regex = new RegExp(find.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'gi');
            baseNewName = baseNewName.replace(regex, replace);
          }
        }
      } else if (mode === 'prefix-suffix') {
        baseNewName = `${options.prefix || ''}${baseNewName}${options.suffix || ''}`;
      } else if (mode === 'numbering') {
        const num = (options.startNumber || 1) + i;
        const pad = options.padding || 3;
        const numStr = num.toString().padStart(pad, '0');
        const bName = options.baseName !== undefined ? options.baseName : baseNewName;
        
        baseNewName = `${bName}${numStr}`;
      }
      
      newName = baseNewName + ext;
      
      previews.push({
        oldPath: joinPath(inputPath, oldName),
        oldName: oldName,
        newPath: joinPath(inputPath, newName),
        newName: newName,
        status: 'ok'
      });
    }
    
    // Check for collisions (duplicate new names generated in memory)
    const newNamesSet = new Set<string>();
    for (const p of previews) {
      if (newNamesSet.has(p.newName.toLowerCase())) {
        p.status = 'collision';
      } else {
        newNamesSet.add(p.newName.toLowerCase());
      }
    }
    
    // Check against existing filesystem original names (naive collision check)
    const originalNamesSet = new Set(files.map(f => f.toLowerCase()));
    for (const p of previews) {
      if (p.status === 'ok' && p.newName.toLowerCase() !== p.oldName.toLowerCase()) {
        if (originalNamesSet.has(p.newName.toLowerCase())) {
          p.status = 'exists';
        }
      }
    }

    return previews;
  }

  static async executeRename(
    previews: RenamePreview[],
    onProgress: (progress: RenameProgress) => void
  ): Promise<{ success: boolean, history: {oldPath: string, newPath: string}[] }> {
    let success = false;
    const history: {oldPath: string, newPath: string}[] = [];

    for (const p of previews) {
      if (p.oldName === p.newName) {
        onProgress({ file: p.oldName, status: 'done', log: 'Skipped (No change)' });
        continue;
      }
      if (p.status !== 'ok') {
        onProgress({ file: p.oldName, status: 'error', log: 'Skipped due to collision' });
        continue;
      }
      
      onProgress({ file: p.oldName, status: 'processing' });
      try {
        await invoke('safe_rename', { oldPath: p.oldPath, newPath: p.newPath });
        history.push({ oldPath: p.oldPath, newPath: p.newPath });
        onProgress({ file: p.oldName, status: 'done' });
        success = true;
      } catch (err: any) {
        const errMsg = String(err);
        if (errMsg.includes('CrossesDevices') || errMsg.includes('EXDEV') || errMsg.includes('17')) {
           onProgress({ file: p.oldName, status: 'error', log: 'Failed: Crosses Devices' });
        } else {
           onProgress({ file: p.oldName, status: 'error', log: errMsg });
        }
      }
    }
    return { success, history };
  }

  static async undoRename(
    history: {oldPath: string, newPath: string}[],
    onProgress: (progress: RenameProgress) => void
  ): Promise<void> {
    for (let i = history.length - 1; i >= 0; i--) {
      const p = history[i];
      const oldName = p.oldPath.split(/[\\/]/).pop() || p.oldPath;
      const newName = p.newPath.split(/[\\/]/).pop() || p.newPath;
      
      onProgress({ file: newName, status: 'processing', log: 'Undoing...' });
      try {
        await invoke('safe_rename', { oldPath: p.newPath, newPath: p.oldPath });
        onProgress({ file: newName, status: 'done', log: `Reverted to ${oldName}` });
      } catch (err: any) {
        onProgress({ file: newName, status: 'error', log: String(err) });
      }
    }
  }
}
