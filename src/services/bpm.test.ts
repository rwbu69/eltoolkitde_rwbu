import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execute, sidecar, invoke } = vi.hoisted(() => ({
  execute: vi.fn(),
  sidecar: vi.fn(() => ({
    execute,
  })),
  invoke: vi.fn(),
}));

const { exists, remove, rename } = vi.hoisted(() => ({
  exists: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke,
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: { sidecar },
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists,
  remove,
  rename,
}));

import { BpmService, buildAtempoFilter } from './bpm';

describe('BpmService - Atempo filter generator', () => {
  it('generates a single filter for standard tempo modifications (0.5 to 2.0)', () => {
    expect(buildAtempoFilter(1.25)).toBe('atempo=1.25');
    expect(buildAtempoFilter(0.8)).toBe('atempo=0.8');
    expect(buildAtempoFilter(1.0)).toBe('atempo=1');
  });

  it('chains multiple atempo filters for acceleration > 2.0x', () => {
    // 2.5 = 2.0 * 1.25
    expect(buildAtempoFilter(2.5)).toBe('atempo=2.0,atempo=1.25');
    // 5.0 = 2.0 * 2.0 * 1.25
    expect(buildAtempoFilter(5.0)).toBe('atempo=2.0,atempo=2.0,atempo=1.25');
  });

  it('chains multiple atempo filters for slowdown < 0.5x', () => {
    // 0.4 = 0.5 * 0.8
    expect(buildAtempoFilter(0.4)).toBe('atempo=0.5,atempo=0.8');
  });

  it('rejects invalid or non-positive ratios', () => {
    expect(() => buildAtempoFilter(0)).toThrow();
    expect(() => buildAtempoFilter(-1.5)).toThrow();
    expect(() => buildAtempoFilter(NaN)).toThrow();
  });
});

describe('BpmService - changeTempo execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execute.mockReset();
    exists.mockResolvedValue(true);
    remove.mockResolvedValue(undefined);
    rename.mockResolvedValue(undefined);
  });

  it('executes FFmpeg with the atempo filter directly for MP3 output without Python sidecars', async () => {
    execute.mockResolvedValue({ code: 0, stdout: '', stderr: '' });

    await BpmService.changeTempo(
      'C:\\input.mp3',
      'C:\\output.mp3',
      120,
      150,
      'mp3'
    );

    expect(sidecar).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining([
      '-hide_banner',
      '-y',
      '-i', 'C:\\input.mp3',
      '-filter:a', 'atempo=1.25',
      '-codec:a', 'libmp3lame',
      '-q:a', '2',
      '-f', 'mp3',
      'C:\\output.mp3.part',
    ]));

    expect(rename).toHaveBeenCalledWith('C:\\output.mp3.part', 'C:\\output.mp3');
  });

  it('executes FFmpeg directly for WAV output', async () => {
    execute.mockResolvedValue({ code: 0, stdout: '', stderr: '' });

    await BpmService.changeTempo(
      'C:\\input.wav',
      'C:\\output.wav',
      100,
      120,
      'wav'
    );

    expect(sidecar).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining([
      '-hide_banner',
      '-y',
      '-i', 'C:\\input.wav',
      '-filter:a', 'atempo=1.2',
      '-codec:a', 'pcm_s16le',
      '-f', 'wav',
      'C:\\output.wav.part',
    ]));

    expect(rename).toHaveBeenCalledWith('C:\\output.wav.part', 'C:\\output.wav');
  });

  it('cleans up temporary part file when FFmpeg fails', async () => {
    execute.mockResolvedValue({ code: 1, stdout: '', stderr: 'Encoding error' });

    await expect(
      BpmService.changeTempo('C:\\input.mp3', 'C:\\output.mp3', 120, 140, 'mp3')
    ).rejects.toThrow('BPM modification error: Encoding error');

    expect(remove).toHaveBeenCalledWith('C:\\output.mp3.part');
  });

  it('rejects invalid BPM inputs', async () => {
    await expect(
      BpmService.changeTempo('C:\\input.mp3', 'C:\\output.mp3', 0, 140, 'mp3')
    ).rejects.toThrow('Invalid original BPM');

    await expect(
      BpmService.changeTempo('C:\\input.mp3', 'C:\\output.mp3', 120, -10, 'mp3')
    ).rejects.toThrow('Invalid target BPM');
  });
});

describe('BpmService - detectBPM', () => {
  it('calls invoke detect_audio_bpm with file path and bounds', async () => {
    invoke.mockResolvedValue({
      bpm: 128.0,
      confidence: 'high',
      candidates: [128.0, 64.0, 256.0],
    });

    const res = await BpmService.detectBPM('C:\\Music\\track.mp3', 80, 160);

    expect(invoke).toHaveBeenCalledWith('detect_audio_bpm', {
      path: 'C:\\Music\\track.mp3',
      minBpm: 80,
      maxBpm: 160,
    });
    expect(res.bpm).toBe(128.0);
    expect(res.confidence).toBe('high');
    expect(res.candidates).toEqual([128.0, 64.0, 256.0]);
  });

  it('handles detection errors cleanly', async () => {
    invoke.mockRejectedValue(new Error('Corrupted audio stream'));

    await expect(
      BpmService.detectBPM('C:\\Music\\bad.mp3')
    ).rejects.toThrow('Failed to detect BPM: Corrupted audio stream');
  });
});
