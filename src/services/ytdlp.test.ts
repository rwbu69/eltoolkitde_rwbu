import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execute, sidecar } = vi.hoisted(() => ({
  execute: vi.fn(),
  sidecar: vi.fn(() => ({
  execute,
  stdout: { on: vi.fn() },
  stderr: { on: vi.fn() },
  on: vi.fn(),
  spawn: vi.fn(),
  })),
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: { sidecar },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

import { YtDlpService } from './ytdlp';

describe('YtDlpService', () => {
  beforeEach(() => {
    execute.mockReset();
    sidecar.mockClear();
  });

  it('does not disable TLS certificate verification when fetching info', async () => {
    execute.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({ title: 'Example', formats: [] }),
      stderr: '',
    });

    await YtDlpService.fetchVideoInfo('https://example.com/video');

    const calls = sidecar.mock.calls as unknown as [string, string[]][];
    const args = calls[0][1];
    expect(args).not.toContain('--no-check-certificate');
    expect(args[args.length - 1]).toBe('https://example.com/video');
  });
});
