import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execute, sidecar } = vi.hoisted(() => ({
  execute: vi.fn(),
  sidecar: vi.fn(() => ({
    execute,
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    spawn: vi.fn().mockResolvedValue({ kill: vi.fn().mockResolvedValue(undefined) }),
  })),
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: { sidecar },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn().mockResolvedValue(true),
  remove: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
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

  it('does not overwrite an existing output file', async () => {
    execute.mockResolvedValue({
      code: 0,
      stdout: '',
      stderr: '',
    });

    await YtDlpService.downloadMedia({
      url: 'https://example.com/video',
      format: 'mp3',
      outputDir: 'C:\\Downloads',
    }, vi.fn());
    const calls = sidecar.mock.calls as unknown as [string, string[]][];
    expect(calls[0][1]).toContain('--no-overwrites');
  });

  it('embeds ID3 metadata and formats MP3 filenames with artist and title', async () => {
    execute.mockResolvedValue({
      code: 0,
      stdout: '',
      stderr: '',
    });

    await YtDlpService.downloadMedia({
      url: 'https://example.com/song',
      format: 'mp3',
      outputDir: 'C:\\Music',
    }, vi.fn());

    const calls = sidecar.mock.calls as unknown as [string, string[]][];
    const args = calls[0][1];
    expect(args).toContain('--embed-metadata');
    expect(args).toContain('-o');
    const oIndex = args.indexOf('-o');
    expect(args[oIndex + 1]).toBe('%(artist,creator,uploader)s - %(title)s.%(ext)s');
  });

  it('defaults to H.265 sorting preference for MP4 downloads', async () => {
    execute.mockResolvedValue({
      code: 0,
      stdout: '',
      stderr: '',
    });

    await YtDlpService.downloadMedia({
      url: 'https://example.com/video',
      format: 'mp4',
      outputDir: 'C:\\Videos',
    }, vi.fn());

    const calls = sidecar.mock.calls as unknown as [string, string[]][];
    const args = calls[0][1];
    expect(args).toContain('-S');
    const sIndex = args.indexOf('-S');
    expect(args[sIndex + 1]).toBe('vcodec:h265,vcodec:h264,res,acodec:m4a');
    expect(args).toContain('--merge-output-format');
  });

  it('honors H.264 sorting preference when explicitly requested', async () => {
    execute.mockResolvedValue({
      code: 0,
      stdout: '',
      stderr: '',
    });

    await YtDlpService.downloadMedia({
      url: 'https://example.com/video',
      format: 'mp4',
      videoCodec: 'h264',
      outputDir: 'C:\\Videos',
    }, vi.fn());

    const calls = sidecar.mock.calls as unknown as [string, string[]][];
    const args = calls[0][1];
    expect(args).toContain('-S');
    const sIndex = args.indexOf('-S');
    expect(args[sIndex + 1]).toBe('vcodec:h264,vcodec:h265,res,acodec:m4a');
  });

  it('uses --remux-video mp4 and VIDEO suffix for video-only downloads', async () => {
    execute.mockResolvedValue({
      code: 0,
      stdout: '',
      stderr: '',
    });

    await YtDlpService.downloadMedia({
      url: 'https://example.com/video',
      format: 'video-only',
      outputDir: 'C:\\Videos',
    }, vi.fn());

    const calls = sidecar.mock.calls as unknown as [string, string[]][];
    const args = calls[0][1];
    expect(args).toContain('--remux-video');
    expect(args).toContain('mp4');
    const oIndex = args.indexOf('-o');
    expect(args[oIndex + 1]).toBe('%(title)s-VIDEO.%(ext)s');
  });

  it('passes sleep pacing and client fallback extractor-args by default', async () => {
    execute.mockResolvedValue({
      code: 0,
      stdout: '',
      stderr: '',
    });

    await YtDlpService.downloadMedia({
      url: 'https://example.com/video',
      format: 'mp4',
      outputDir: 'C:\\Videos',
    }, vi.fn());

    const calls = sidecar.mock.calls as unknown as [string, string[]][];
    const args = calls[0][1];
    expect(args).toContain('--sleep-requests');
    expect(args).toContain('1.5');
    expect(args).toContain('--extractor-args');
    expect(args).toContain('youtube:player_client=android,web');
  });

  it('includes extractor-args and flat-playlist in fetchVideoInfo for client fallback and fast manifest extraction', async () => {
    execute.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({ title: 'Example', formats: [] }),
      stderr: '',
    });

    await YtDlpService.fetchVideoInfo('https://example.com/video');

    const calls = sidecar.mock.calls as unknown as [string, string[]][];
    const args = calls[0][1];
    expect(args).toContain('--extractor-args');
    expect(args).toContain('youtube:player_client=android,web');
    expect(args).toContain('--flat-playlist');
  });

  it('correctly maps playlist items when in flat-playlist mode', async () => {
    execute.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({
        title: 'Test Playlist',
        _type: 'playlist',
        entries: [
          { id: 'track123456', title: 'Track One' },
          { id: 'track789012', title: '', url: 'https://example.com/watch?v=track789012' }
        ]
      }),
      stderr: '',
    });

    const info = await YtDlpService.fetchVideoInfo('https://example.com/playlist');
    expect(info.isPlaylist).toBe(true);
    expect(info.entries?.length).toBe(2);
    expect(info.entries?.[0].title).toBe('Track One');
    expect(info.entries?.[0].url).toBe('https://www.youtube.com/watch?v=track123456');
    expect(info.entries?.[1].url).toBe('https://example.com/watch?v=track789012');
  });
});
