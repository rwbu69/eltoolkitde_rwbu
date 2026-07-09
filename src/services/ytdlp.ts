import { invoke } from '@tauri-apps/api/core';
import { Command } from '@tauri-apps/plugin-shell';

export interface VideoInfo {
  title: string;
  thumbnail?: string;
  formats: any[];
}

export interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
  status: string; // 'fetching', 'downloading', 'done', 'error'
}

export interface DownloadOptions {
  url: string;
  format: 'mp4' | 'mp3' | 'video-only';
  outputDir: string;
  videoQuality?: 'best' | 'mid' | 'low';
  audioBitrate?: '320k' | '256k' | '192k';
  cookiesFilePath?: string;
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

  static async fetchVideoInfo(url: string, cookiesFilePath?: string): Promise<VideoInfo> {
    const ffmpegLocation = await this.getFfmpegLocation();
    const fetchArgs = ['--encoding', 'utf-8', '-J', '--no-check-certificate'];

    if (cookiesFilePath) {
      fetchArgs.push('--cookies', cookiesFilePath);
    }

    fetchArgs.push(url);

    if (ffmpegLocation) {
      fetchArgs.push('--ffmpeg-location', ffmpegLocation);
      const isWin = navigator.userAgent.toLowerCase().includes('windows');
      const nodeBinary = isWin ? 'node.exe' : 'node';
      const sep = isWin ? '\\' : '/';
      fetchArgs.push('--js-runtimes', `node:${ffmpegLocation}${sep}${nodeBinary}`);
    }

    const command = Command.sidecar('yt-dlp', fetchArgs);
    const output = await command.execute();

    if (output.code !== 0) {
      throw new Error(`Failed to fetch info: ${output.stderr}`);
    }

    const data = JSON.parse(output.stdout);
    return {
      title: data.title || url,
      thumbnail: data.thumbnail,
      formats: data.formats || [],
    };
  }

  static async downloadMedia(
    options: DownloadOptions,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<void> {
    const { url, format, outputDir, videoQuality = 'best', audioBitrate = '320k', cookiesFilePath } = options;
    const ffmpegLocation = await this.getFfmpegLocation();

    let formatArgs: string[] = [];
    
    // Video quality map
    const videoMap = {
      best: 'bestvideo',
      mid: 'bestvideo[height<=720]',
      low: 'bestvideo[height<=480]'
    };
    const vidArg = videoMap[videoQuality] || 'bestvideo';

    if (format === 'mp4') {
      formatArgs = ['-f', `${vidArg}+bestaudio/best`, '--merge-output-format', 'mp4'];
    } else if (format === 'video-only') {
      formatArgs = ['-f', vidArg, '--merge-output-format', 'mp4'];
    } else if (format === 'mp3') {
      formatArgs = ['-x', '--audio-format', 'mp3', '--audio-quality', audioBitrate];
    }

    let template = '%(title)s.%(ext)s'; // Standard template
    if (format === 'video-only') {
      template = '%(title)s-VIDEO.%(ext)s';
    }

    const dlArgs = [
      '--encoding', 'utf-8',
      '--newline',
      '--progress-delta', '1',
      ...formatArgs,
      '-o', template,
      '-P', outputDir
    ];

    if (cookiesFilePath) {
      dlArgs.push('--cookies', cookiesFilePath);
    }

    if (ffmpegLocation) {
      dlArgs.push('--ffmpeg-location', ffmpegLocation);
      const isWin = navigator.userAgent.toLowerCase().includes('windows');
      const nodeBinary = isWin ? 'node.exe' : 'node';
      const sep = isWin ? '\\' : '/';
      dlArgs.push('--js-runtimes', `node:${ffmpegLocation}${sep}${nodeBinary}`);
    }

    dlArgs.push('--no-check-certificate', url);

    return new Promise((resolve, reject) => {
      onProgress({ percent: 0, speed: '--', eta: '--', status: 'starting' });
      
      const command = Command.sidecar('yt-dlp', dlArgs);
      
      command.stdout.on('data', (line) => {
        if (!line.trim()) return;
        
        const dlMatch = line.match(/\[download\]\s+(\d+\.?\d*)%\s+of[ ~]+([^ ]+)\s+at\s+([^ ]+)\s+ETA\s+([^ ]+)/);
        if (dlMatch) {
          onProgress({
            percent: parseFloat(dlMatch[1]),
            speed: dlMatch[3],
            eta: dlMatch[4],
            status: 'downloading',
          });
        }
      });

      command.stderr.on('data', (line) => {
        if (line.trim()) {
          console.warn('[YT-DLP WARN]', line.trim());
        }
      });

      command.on('close', (data) => {
        if (data.code === 0) {
          onProgress({ percent: 100, speed: '--', eta: '--', status: 'done' });
          resolve();
        } else {
          onProgress({ percent: 0, speed: '--', eta: '--', status: 'error' });
          reject(new Error(`Process exited with code ${data.code}`));
        }
      });

      command.on('error', (error) => {
        onProgress({ percent: 0, speed: '--', eta: '--', status: 'error' });
        reject(error);
      });

      command.spawn().catch(reject);
    });
  }

  static async updateYtDlp(
    onProgress: (log: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = Command.sidecar('yt-dlp', ['-U']);
      
      command.stdout.on('data', (line) => {
        if (line.trim()) onProgress(line.trim());
      });

      command.stderr.on('data', (line) => {
        if (line.trim()) onProgress(`ERROR: ${line.trim()}`);
      });

      command.on('close', (data) => {
        if (data.code === 0) {
          onProgress('Update finished successfully.');
          resolve();
        } else {
          onProgress(`Update failed with code ${data.code}`);
          reject(new Error(`Update failed with code ${data.code}`));
        }
      });

      command.on('error', (error) => {
        onProgress(`Failed to start update: ${error}`);
        reject(error);
      });

      command.spawn().catch(reject);
    });
  }
}
