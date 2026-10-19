import { beforeEach, describe, expect, it, vi } from 'vitest';

const { readDir, exists } = vi.hoisted(() => ({
  readDir: vi.fn(),
  exists: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir,
  exists,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { RenameService } from './rename';

describe('RenameService', () => {
  beforeEach(() => {
    exists.mockResolvedValue(true);
    readDir.mockResolvedValue([
      { name: 'Track 01.mp3', isFile: true },
      { name: 'Track 02.mp3', isFile: true },
    ]);
  });

  it('generates a collision-free prefix preview', async () => {
    const preview = await RenameService.generatePreview({
      mode: 'prefix-suffix',
      inputPath: 'C:\\Music',
      prefix: 'Live - ',
    });

    expect(preview).toEqual([
      expect.objectContaining({
        oldName: 'Track 01.mp3',
        newName: 'Live - Track 01.mp3',
        status: 'ok',
      }),
      expect.objectContaining({
        oldName: 'Track 02.mp3',
        newName: 'Live - Track 02.mp3',
        status: 'ok',
      }),
    ]);
  });
});
