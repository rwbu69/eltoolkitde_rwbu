import { invoke } from '@tauri-apps/api/core';
import { Command } from '@tauri-apps/plugin-shell';
import { exists, remove, rename } from '@tauri-apps/plugin-fs';
import type { VideoCodec } from '../config/mediaSettings';
import { joinPath } from '../utils/path';
import { dispatchDebug, dispatchLog, notifySuccess } from '../utils/toolkitEvents';

export interface PlaylistItem {
  title: string;
  id: string;
  url?: string;
  thumbnail?: string;
}

export interface VideoInfo {
  title: string;
  thumbnail?: string;
  formats: any[];
  isPlaylist?: boolean;
  entries?: PlaylistItem[];
}

export interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
  status: string; // 'fetching', 'downloading', 'done', 'error'
  playlistCurrent?: number;
  playlistTotal?: number;
}

export interface DownloadOptions {
  url: string;
  format: 'mp4' | 'mp3' | 'video-only';
  outputDir: string;
  videoQuality?: '4k' | '1440p' | '1080p' | '720p' | '480p' | '360p';
  videoCodec?: VideoCodec;
  audioBitrate?: '320k' | '256k' | '192k';
  cookiesFilePath?: string;
  browserForCookies?: string;
  rateLimit?: string;
}

export class YtDlpService {
  private static cachedFfmpegLocation: string | null = null;
  private static cachedJsRuntime: string | null = null;
  private static cachedAvailableEncoders: Set<string> | null = null;
  static failedEncoders = new Set<string>();

  private static async getFfmpegLocation(): Promise<string | null> {
    if (this.cachedFfmpegLocation) return this.cachedFfmpegLocation;
    try {
      const dir = await invoke<string>('setup_ffmpeg_location');
      if (dir) this.cachedFfmpegLocation = dir;
      return dir;
    } catch (e) {
      console.warn('Failed to setup ffmpeg location:', e);
      return null;
    }
  }

  private static async getJsRuntimeArg(sidecarDir: string | null): Promise<string | null> {
    if (this.cachedJsRuntime) return this.cachedJsRuntime;
    if (!sidecarDir) return null;
    for (const bin of ['qjs.exe', 'qjs']) {
      const candidate = joinPath(sidecarDir, bin);
      try {
        if (await exists(candidate)) {
          this.cachedJsRuntime = `quickjs:${candidate}`;
          return this.cachedJsRuntime;
        }
      } catch {
        // Ignore fs probe errors
      }
    }
    return null;
  }

  static async getMediaVideoCodec(filePath: string): Promise<string | null> {
    try {
      const ffprobe = Command.sidecar('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_name',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath
      ]);
      const res = await ffprobe.execute();
      if (res.code === 0 && res.stdout.trim()) {
        return res.stdout.trim().toLowerCase();
      }
    } catch (e) {
      console.warn('Failed to probe video codec:', e);
    }
    return null;
  }

  private static async hasAudioStream(filePath: string): Promise<boolean> {
    try {
      const ffprobe = Command.sidecar('ffprobe', [
        '-v', 'error',
        '-select_streams', 'a:0',
        '-show_entries', 'stream=codec_type',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath
      ]);
      const res = await ffprobe.execute();
      return res.code === 0 && res.stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  static async getMediaDuration(filePath: string): Promise<number> {
    try {
      const ffprobe = Command.sidecar('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath
      ]);
      const res = await ffprobe.execute();
      const parsed = parseFloat(res.stdout);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  static async getAvailableEncoders(): Promise<Set<string>> {
    if (this.cachedAvailableEncoders) return this.cachedAvailableEncoders;
    const found = new Set<string>();
    try {
      const res = await Command.sidecar('ffmpeg', ['-hide_banner', '-encoders']).execute();
      if (res.code === 0) {
        const known = [
          'h264_nvenc', 'h264_qsv', 'h264_amf', 'h264_videotoolbox', 'libx264',
          'hevc_nvenc', 'hevc_qsv', 'hevc_amf', 'hevc_videotoolbox', 'libx265',
        ];
        for (const name of known) {
          if (res.stdout.includes(name)) found.add(name);
        }
      }
    } catch {
      // Fall back to software encoders only
    }
    this.cachedAvailableEncoders = found;
    return found;
  }

  static buildEncoderCandidates(
    targetCodec: 'h264' | 'hevc',
    availableEncoders: Set<string>
  ): { encoder: string; args: string[] }[] {
    const hardwareMap: Record<'h264' | 'hevc', { encoder: string; args: string[] }[]> = {
      h264: [
        { encoder: 'h264_nvenc', args: ['-c:v:0', 'h264_nvenc', '-cq', '22', '-preset', 'p4'] },
        { encoder: 'h264_qsv', args: ['-c:v:0', 'h264_qsv', '-global_quality', '22'] },
        { encoder: 'h264_amf', args: ['-c:v:0', 'h264_amf', '-quality', 'balanced', '-rc', 'cqp', '-qp_i', '22', '-qp_p', '22'] },
        { encoder: 'h264_videotoolbox', args: ['-c:v:0', 'h264_videotoolbox', '-q:v', '65'] },
      ],
      hevc: [
        { encoder: 'hevc_nvenc', args: ['-c:v:0', 'hevc_nvenc', '-cq', '22', '-preset', 'p4'] },
        { encoder: 'hevc_qsv', args: ['-c:v:0', 'hevc_qsv', '-global_quality', '22'] },
        { encoder: 'hevc_amf', args: ['-c:v:0', 'hevc_amf', '-quality', 'balanced', '-rc', 'cqp', '-qp_i', '22', '-qp_p', '22'] },
        { encoder: 'hevc_videotoolbox', args: ['-c:v:0', 'hevc_videotoolbox', '-q:v', '65'] },
      ],
    };

    const softwareFallback = targetCodec === 'h264'
      ? { encoder: 'libx264', args: ['-c:v:0', 'libx264', '-crf', '22', '-preset', 'fast'] }
      : { encoder: 'libx265', args: ['-c:v:0', 'libx265', '-crf', '22', '-preset', 'fast'] };

    const candidates = hardwareMap[targetCodec].filter(
      (item) => availableEncoders.has(item.encoder) && !this.failedEncoders.has(item.encoder)
    );
    candidates.push(softwareFallback);
    return candidates;
  }

  static async fetchVideoInfo(url: string, cookiesFilePath?: string, browserForCookies?: string): Promise<VideoInfo> {
    const ffmpegLocation = await this.getFfmpegLocation();
    const jsRuntime = await this.getJsRuntimeArg(ffmpegLocation);
    const fetchArgs = [
      '--encoding', 'utf-8',
      '-J',
      '--flat-playlist',
    ];

    if (jsRuntime) {
      fetchArgs.push('--js-runtimes', jsRuntime);
    }
    dispatchDebug('yt-dlp', 'fetchVideoInfo config', {
      ffmpegLocation,
      jsRuntime,
      hasCookiesFile: Boolean(cookiesFilePath),
      browserForCookies: browserForCookies || null,
    });

    if (browserForCookies) {
      fetchArgs.push('--cookies-from-browser', browserForCookies);
    } else if (cookiesFilePath) {
      try {
        if (await exists(cookiesFilePath)) {
          fetchArgs.push('--cookies', cookiesFilePath);
        } else {
          dispatchLog(`[yt-dlp WARN] Cookies file not found: ${cookiesFilePath}`);
        }
      } catch {
        fetchArgs.push('--cookies', cookiesFilePath);
      }
    }

    if (ffmpegLocation) {
      fetchArgs.push('--ffmpeg-location', ffmpegLocation);
    }

    fetchArgs.push('--');
    fetchArgs.push(url);

    const command = Command.sidecar('yt-dlp', fetchArgs);
    const output = await command.execute();

    if (output.code !== 0) {
      throw new Error(`Failed to fetch info: ${output.stderr}`);
    }

    const data = JSON.parse(output.stdout);
    const isPlaylist = data._type === 'playlist' || data.entries !== undefined;
    
    return {
      title: data.title || url,
      thumbnail: data.thumbnail,
      formats: data.formats || [],
      isPlaylist,
      entries: isPlaylist && data.entries ? data.entries.map((e: any) => ({
        title: e.title || e.id || 'Untitled media',
        id: e.id,
        url: e.url || (e.id && e.id.length === 11 ? `https://www.youtube.com/watch?v=${e.id}` : e.id || e.webpage_url),
        thumbnail: e.thumbnail || e.thumbnails?.[0]?.url || (e.id && e.id.length === 11 ? `https://i.ytimg.com/vi/${e.id}/mqdefault.jpg` : undefined),
      })) : []
    };
  }

  static async downloadMedia(
    options: DownloadOptions,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<{ task: Promise<void>, cancel: () => void }> {
    const {
      url,
      format,
      outputDir,
      videoQuality = '1080p',
      videoCodec = 'smart',
      audioBitrate = '320k',
      cookiesFilePath,
      browserForCookies,
      rateLimit
    } = options;
    const ffmpegLocation = await this.getFfmpegLocation();
    const jsRuntime = await this.getJsRuntimeArg(ffmpegLocation);

    let formatArgs: string[] = [];
    
    // Video resolution cap
    const heightMap: Record<string, number> = {
      '4k': 2160,
      '1440p': 1440,
      '1080p': 1080,
      '720p': 720,
      '480p': 480,
      '360p': 360
    };
    const heightCap = heightMap[videoQuality] || 1080;
    const sortCodecs = videoCodec === 'h265' ? 'vcodec:h265,vcodec:h264' : 'vcodec:h264,vcodec:h265';

    if (format === 'mp4') {
      formatArgs = [
        '-f', 'bv*+ba/b',
        '-S', `res:${heightCap},${sortCodecs},acodec:m4a`,
        '--merge-output-format', 'mp4'
      ];
    } else if (format === 'video-only') {
      formatArgs = [
        '-f', 'bv*/b',
        '-S', `res:${heightCap},${sortCodecs}`,
        '--remux-video', 'mp4'
      ];
    } else if (format === 'mp3') {
      formatArgs = [
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', audioBitrate
      ];
    }

    let template = '%(title)s.%(ext)s'; // Standard template for video
    if (format === 'mp3') {
      template = '%(artist,creator,uploader)s - %(title)s.%(ext)s';
    } else if (format === 'video-only') {
      template = '%(title)s-VIDEO.%(ext)s';
    }

    const dlArgs = [
      '--encoding', 'utf-8',
      '--newline',
      '--progress-delta', '1',
      '--no-overwrites',
      '--sleep-requests', '1.5',
      '--min-sleep-interval', '1',
      '--max-sleep-interval', '3',
      '--retry-sleep', 'fragment:exp=1:20',
      '--print', 'after_move:[final_path] %(filepath)s',
      '--embed-thumbnail',
      '--convert-thumbnails', 'jpg',
      '--embed-metadata',
      ...formatArgs,
      '-o', template,
      '-P', outputDir
    ];

    if (rateLimit) {
      dlArgs.push('--limit-rate', rateLimit);
    }

    if (browserForCookies) {
      dlArgs.push('--cookies-from-browser', browserForCookies);
    } else if (cookiesFilePath) {
      try {
        if (await exists(cookiesFilePath)) {
          dlArgs.push('--cookies', cookiesFilePath);
        } else {
          dispatchLog(`[yt-dlp WARN] Cookies file not found: ${cookiesFilePath}`);
        }
      } catch {
        dlArgs.push('--cookies', cookiesFilePath);
      }
    }

    if (ffmpegLocation) {
      dlArgs.push('--ffmpeg-location', ffmpegLocation);
    }

    if (jsRuntime) {
      dlArgs.push('--js-runtimes', jsRuntime);
    }

    dlArgs.push('--', url);

    let currentPlaylistIndex = 0;
    let totalPlaylistItems = 0;
    let cancelFn: () => void;
    let cancelled = false;
    let lastErrorLine = '';
    const downloadedFiles: string[] = [];

    const task = new Promise<void>((resolve, reject) => {
      onProgress({ percent: 0, speed: '--', eta: '--', status: 'starting' });
      
      const command = Command.sidecar('yt-dlp', dlArgs);
      
      let childProcess: any = null;
      
      // We will expose a way to kill this command
      const killCommand = () => {
        cancelled = true;
        if (childProcess) {
          childProcess.kill().catch(() => {});
        }
      };
      
      // Store the cancel function in an external variable so it can be returned
      cancelFn = killCommand;
      
      command.stdout.on('data', (chunk) => {
        if (!chunk.trim()) return;
        const lines = chunk.split(/\r?\n/);
        for (const line of lines) {
          if (!line.trim()) continue;
          
          // Check for playlist progress
          const playlistMatch = line.match(/\[download\] Downloading video (\d+) of (\d+)/) || line.match(/\[download\] Downloading item (\d+) of (\d+)/);
          if (playlistMatch) {
            currentPlaylistIndex = parseInt(playlistMatch[1], 10);
            totalPlaylistItems = parseInt(playlistMatch[2], 10);
          }

          // Track already-downloaded skips from --no-overwrites
          if (line.includes('has already been downloaded')) {
            dispatchLog(`[yt-dlp] ${line.trim()} (skipped by --no-overwrites)`);
          }

          // Track final downloaded destination files
          const finalMatch = line.match(/^\[final_path\]\s*(.+)$/);
          if (finalMatch) {
            downloadedFiles.push(finalMatch[1].trim());
          }
          const mergerMatch = line.match(/\[Merger\] Merging formats into "([^"]+)"/);
          if (mergerMatch) {
            downloadedFiles.push(mergerMatch[1].trim());
          }
          const remuxMatch = line.match(/\[VideoRemuxer\] Remuxing video from .*? to "([^"]+)"/);
          if (remuxMatch) {
            downloadedFiles.push(remuxMatch[1].trim());
          }
          
          // Robust progress parsing
          const isProgress = line.includes('[download]') && line.includes('%');
          if (isProgress) {
            const percentMatch = line.match(/\[download\]\s+([\d.]+)%/);
            const speedMatch = line.match(/at\s+([^\s]+)/);
            const etaMatch = line.match(/ETA\s+([^\s]+)/);

            if (percentMatch) {
              onProgress({
                percent: parseFloat(percentMatch[1]),
                speed: speedMatch ? speedMatch[1] : '--',
                eta: etaMatch ? etaMatch[1] : '--',
                status: 'downloading',
                playlistCurrent: currentPlaylistIndex,
                playlistTotal: totalPlaylistItems
              });
            }
          } else {
            // Only log non-progress lines to prevent terminal spam
            dispatchLog(`[yt-dlp] ${line.trim()}`);
          }
        }
      });

      command.stderr.on('data', (line) => {
        const trimmed = line.trim();
        if (trimmed) {
          if (/^ERROR:/i.test(trimmed)) {
            lastErrorLine = trimmed;
          }
          console.warn('[YT-DLP WARN]', trimmed);
          dispatchLog(`[yt-dlp WARN] ${trimmed}`);
        }
      });

      command.on('close', async (data) => {
        if (cancelled) {
          onProgress({ percent: 0, speed: '--', eta: '--', status: 'canceled' });
          resolve();
          return;
        }

        if (data.code === 0) {
          if (format === 'mp4' || format === 'video-only') {
            const targetCodec: 'h264' | 'hevc' = videoCodec === 'h265' ? 'hevc' : 'h264';
            const uniqueFiles = [...new Set(downloadedFiles)];

            for (const file of uniqueFiles) {
              if (cancelled) break;
              try {
                if (await exists(file)) {
                  const detectedCodec = await YtDlpService.getMediaVideoCodec(file);
                  if (detectedCodec) {
                    dispatchLog(`[codec-check] Probed ${file} -> codec: ${detectedCodec}`);
                  }
                  const isAllowedNative = videoCodec === 'smart'
                    ? (detectedCodec === 'h264' || detectedCodec === 'hevc')
                    : detectedCodec === targetCodec;
                  const needsTranscode = Boolean(detectedCodec && !isAllowedNative);
                  const needsAudioStrip = Boolean(detectedCodec) && !needsTranscode && format === 'video-only' && (await YtDlpService.hasAudioStream(file));

                  if (needsTranscode || needsAudioStrip) {
                    const durationSec = await YtDlpService.getMediaDuration(file);
                    onProgress({ percent: 0, speed: 'FFmpeg', eta: '--', status: 'processing' });
                    dispatchLog(
                      needsTranscode
                        ? `[codec-optimizer] Target is ${targetCodec.toUpperCase()}, found ${detectedCodec}. Transcoding with FFmpeg...`
                        : `[codec-optimizer] Stripping audio stream for video-only output: ${file}`
                    );

                    const tempFile = `${file}.opt.mp4`;
                    const encoderCandidates = needsTranscode
                      ? YtDlpService.buildEncoderCandidates(targetCodec, await YtDlpService.getAvailableEncoders())
                      : [{ encoder: 'copy', args: ['-c:v:0', 'copy'] }];

                    let succeeded = false;
                    let lastFfmpegStderr = '';
                    for (const candidate of encoderCandidates) {
                      if (cancelled) break;
                      const ffmpegArgs = [
                        '-hide_banner',
                        '-y',
                        '-i', file,
                        '-map', '0:v:0',
                        ...candidate.args,
                        ...(needsTranscode ? ['-pix_fmt:v:0', 'yuv420p', '-movflags', '+faststart'] : []),
                        ...(needsTranscode && targetCodec === 'hevc' ? ['-tag:v:0', 'hvc1'] : []),
                        '-map', '0:v:1?',
                        '-c:v:1', 'copy',
                        '-disposition:v:1', 'attached_pic',
                      ];
                      if (format === 'video-only') {
                        ffmpegArgs.push('-an');
                      } else {
                        ffmpegArgs.push('-map', '0:a?', '-c:a', 'copy');
                      }
                      ffmpegArgs.push(tempFile);

                      const ffmpegCommand = Command.sidecar('ffmpeg', ffmpegArgs);
                      lastFfmpegStderr = '';
                      ffmpegCommand.stderr.on('data', (line: string) => {
                        lastFfmpegStderr += line;
                        const timeMatch = line.match(/time=\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
                        if (timeMatch && durationSec > 0 && !cancelled) {
                          const currentSec =
                            parseInt(timeMatch[1], 10) * 3600 +
                            parseInt(timeMatch[2], 10) * 60 +
                            parseFloat(timeMatch[3]);
                          const percent = Math.min(99, Math.round((currentSec / durationSec) * 100));
                          onProgress({ percent, speed: candidate.encoder, eta: '--', status: 'processing' });
                        }
                      });

                      const ffmpegCode = await new Promise<number | null>((resFfmpeg, rejFfmpeg) => {
                        ffmpegCommand.on('close', (res) => resFfmpeg(res.code));
                        ffmpegCommand.on('error', (err) => rejFfmpeg(err));
                        ffmpegCommand.spawn().then((child) => {
                          childProcess = child;
                          if (cancelled) child.kill().catch(() => {});
                        }).catch(rejFfmpeg);
                      });

                      if (!cancelled && ffmpegCode === 0 && (await exists(tempFile))) {
                        await remove(file);
                        await rename(tempFile, file);
                        dispatchLog(`[codec-optimizer] Processed with ${candidate.encoder}: ${file}`);
                        succeeded = true;
                        break;
                      }

                      if (await exists(tempFile)) await remove(tempFile).catch(() => {});
                      if (!cancelled && candidate.encoder !== 'libx264' && candidate.encoder !== 'libx265' && candidate.encoder !== 'copy') {
                        YtDlpService.failedEncoders.add(candidate.encoder);
                      }
                      if (!cancelled && encoderCandidates.length > 1) {
                        dispatchLog(`[codec-optimizer WARN] ${candidate.encoder} failed, trying fallback...`);
                      }
                    }

                    if (!succeeded && !cancelled) {
                      dispatchLog(`[codec-optimizer ERROR] Transcoding failed for ${file}: ${lastFfmpegStderr.trim().slice(-300)}`);
                    }
                  } else if (detectedCodec) {
                    dispatchLog(`[codec-optimizer] Verified ${detectedCodec} in ${file}. No transcoding needed.`);
                  }
                }
              } catch (probeErr) {
                console.warn('Post-download codec verification failed:', probeErr);
              }
            }
          }

          onProgress({ percent: 100, speed: '--', eta: '--', status: 'done' });
          resolve();
          await notifySuccess('Download complete', `Task complete: ${options.url}`);
        } else {
          onProgress({ percent: 0, speed: '--', eta: '--', status: 'error' });
          reject(new Error(lastErrorLine || `Process exited with code ${data.code}`));
        }
      });

      command.on('error', (error) => {
        onProgress({ percent: 0, speed: '--', eta: '--', status: 'error' });
        reject(error);
      });

      command.spawn().then((child) => {
        childProcess = child;
        if (cancelled) child.kill().catch(() => {});
      }).catch(reject);
    });

    return { task, cancel: cancelFn! };
  }

  static async updateYtDlp(
    onProgress: (log: string) => void
  ): Promise<void> {
    try {
      const version = await invoke<string>('update_ytdlp');
      const message = `Updated yt-dlp successfully (${version}).`;
      onProgress(message);
      dispatchLog(`[yt-dlp update] ${message}`);
    } catch (error) {
      const message = `Update failed: ${String(error)}`;
      onProgress(message);
      dispatchLog(`[yt-dlp update ERROR] ${message}`);
      throw new Error(message);
    }
  }
}
