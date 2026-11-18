import { invoke } from '@tauri-apps/api/core';
import { Command } from '@tauri-apps/plugin-shell';
import { exists, remove, rename } from '@tauri-apps/plugin-fs';
import type { VideoCodec } from '../config/mediaSettings';
import { dispatchLog, notifySuccess } from '../utils/toolkitEvents';

export interface PlaylistItem {
  title: string;
  id: string;
  url?: string;
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
  private static async getFfmpegLocation(): Promise<string | null> {
    try {
      return await invoke<string>('setup_ffmpeg_location');
    } catch (e) {
      console.warn('Failed to setup ffmpeg location:', e);
      return null;
    }
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

  static async fetchVideoInfo(url: string, cookiesFilePath?: string, browserForCookies?: string): Promise<VideoInfo> {
    const ffmpegLocation = await this.getFfmpegLocation();
    const fetchArgs = [
      '--encoding', 'utf-8',
      '-J',
      '--flat-playlist',
      '--extractor-args', 'youtube:player_client=android,web'
    ];

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
      videoCodec = 'h265',
      audioBitrate = '320k',
      cookiesFilePath,
      browserForCookies,
      rateLimit
    } = options;
    const ffmpegLocation = await this.getFfmpegLocation();

    let formatArgs: string[] = [];
    
    // Video quality map
    const videoMap: Record<string, string> = {
      '4k': 'bestvideo[height<=2160]',
      '1440p': 'bestvideo[height<=1440]',
      '1080p': 'bestvideo[height<=1080]',
      '720p': 'bestvideo[height<=720]',
      '480p': 'bestvideo[height<=480]',
      '360p': 'bestvideo[height<=360]'
    };
    const vidArg = videoMap[videoQuality] || 'bestvideo';
    const sortCodecs = videoCodec === 'h264' ? 'vcodec:h264,vcodec:h265' : 'vcodec:h265,vcodec:h264';

    if (format === 'mp4') {
      formatArgs = [
        '-f', `${vidArg}+bestaudio/best`, 
        '-S', `${sortCodecs},res,acodec:m4a`,
        '--merge-output-format', 'mp4'
      ];
    } else if (format === 'video-only') {
      formatArgs = [
        '-f', vidArg, 
        '-S', `${sortCodecs},res`,
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
      '--extractor-args', 'youtube:player_client=android,web',
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

    dlArgs.push('--', url);

    let currentPlaylistIndex = 0;
    let totalPlaylistItems = 0;
    let cancelFn: () => void;
    let cancelled = false;
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
          // Suppress harmless SABR format negotiation warnings from terminal output
          if (trimmed.includes('SABR-only streaming experiment')) {
            return;
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
            const targetEncoder = videoCodec === 'h264' ? 'libx264' : 'libx265';
            const expectedCodec = videoCodec === 'h264' ? 'h264' : 'hevc';
            const uniqueFiles = [...new Set(downloadedFiles)];

            for (const file of uniqueFiles) {
              if (cancelled) break;
              try {
                if (await exists(file)) {
                  const detectedCodec = await YtDlpService.getMediaVideoCodec(file);
                  if (detectedCodec) {
                    dispatchLog(`[codec-check] Probed ${file} -> codec: ${detectedCodec}`);
                  }
                  if (detectedCodec && detectedCodec !== expectedCodec) {
                    onProgress({ percent: 99, speed: '--', eta: '--', status: 'processing' });
                    dispatchLog(`[codec-optimizer] Target is ${videoCodec.toUpperCase()} (${expectedCodec}), but found ${detectedCodec}. Transcoding with FFmpeg...`);
                    
                    const tempFile = `${file}.opt.mp4`;
                    const ffmpegArgs = [
                      '-hide_banner',
                      '-y',
                      '-i', file,
                      '-map', '0:v:0',
                      '-c:v:0', targetEncoder,
                      '-crf', '22',
                      '-preset', 'fast',
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
                    const ffmpegRes = await ffmpegCommand.execute();
                    if (ffmpegRes.code === 0 && (await exists(tempFile))) {
                      await remove(file);
                      await rename(tempFile, file);
                      dispatchLog(`[codec-optimizer] Successfully transcoded to ${targetEncoder}: ${file}`);
                    } else {
                      if (await exists(tempFile)) await remove(tempFile);
                      dispatchLog(`[codec-optimizer ERROR] Transcoding failed: ${ffmpegRes.stderr}`);
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
          reject(new Error(`Process exited with code ${data.code}`));
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
