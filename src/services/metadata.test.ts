import { beforeEach, describe, expect, it, vi } from 'vitest';

const { copyFile, exists, remove, rename } = vi.hoisted(() => ({
  copyFile: vi.fn(),
  exists: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
}));

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  copyFile,
  exists,
  remove,
  rename,
  readDir: vi.fn(),
}));

import { MetadataService } from './metadata';

describe('MetadataService backups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exists.mockResolvedValue(true);
  });

  it('restores a backup through a temporary file', async () => {
    await MetadataService.restoreBackup('C:\\Music\\track.mp3', 'C:\\Music\\track.metadata-backup.mp3');

    expect(copyFile).toHaveBeenCalledWith(
      'C:\\Music\\track.metadata-backup.mp3',
      'C:\\Music\\track.mp3.restore.tmp',
    );
    expect(remove).toHaveBeenCalledWith('C:\\Music\\track.mp3');
    expect(rename).toHaveBeenCalledWith(
      'C:\\Music\\track.mp3.restore.tmp',
      'C:\\Music\\track.mp3',
    );
  });

  it('invokes write_audio_tags command', async () => {
    invoke.mockResolvedValue(undefined);
    const progressSpy = vi.fn();

    const { task } = await MetadataService.processMetadata(
      {
        mode: 'file',
        inputPath: 'C:\\Music\\song.flac',
        title: 'Song Title',
        artist: 'Song Artist',
        album: 'Album Name',
        year: '2024',
      },
      progressSpy
    );

    await task;

    expect(invoke).toHaveBeenCalledWith('write_audio_tags', {
      path: 'C:\\Music\\song.flac',
      tags: {
        title: 'Song Title',
        artist: 'Song Artist',
        album: 'Album Name',
        year: 2024,
      },
    });

    expect(progressSpy).toHaveBeenCalledWith(
      expect.objectContaining({ file: 'song.flac', status: 'done' })
    );
  });

  it('reads metadata tags via invoke read_audio_tags', async () => {
    invoke.mockResolvedValue({
      title: 'Existing Title',
      artist: 'Existing Artist',
      year: 2023,
    });

    const tags = await MetadataService.readMetadata('C:\\Music\\song.mp3');
    expect(invoke).toHaveBeenCalledWith('read_audio_tags', { path: 'C:\\Music\\song.mp3' });
    expect(tags.title).toBe('Existing Title');
  });
});
