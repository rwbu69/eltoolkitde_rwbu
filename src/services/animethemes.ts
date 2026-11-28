import { invoke } from '@tauri-apps/api/core';
import { Command } from '@tauri-apps/plugin-shell';
import { exists, remove, rename } from '@tauri-apps/plugin-fs';
import { joinPath } from '../utils/path';
import { dispatchDebug, dispatchLog } from '../utils/toolkitEvents';
import { YtDlpService } from './ytdlp';

export interface AnimeThemeVideo {
  basename: string;
  resolution?: number;
  nc: boolean;
  subbed: boolean;
  link: string;
}

export interface AnimeThemeEntry {
  version?: number;
  episodes?: string;
  videos: AnimeThemeVideo[];
}

export interface AnimeThemeItem {
  theme_type: string;
  sequence?: number;
  slug: string;
  song_title?: string;
  artists: string[];
  entries: AnimeThemeEntry[];
}

export interface AnimeThemeAnime {
  slug: string;
  title: string;
  english_title?: string;
  year?: number;
  cover_url?: string;
  themes: AnimeThemeItem[];
}

export interface AnimeThemeSuggestion {
  slug: string;
  title: string;
  english_title?: string;
  year?: number;
}

export type AnimeThemeOutputFormat = 'h264' | 'hevc' | 'webm';

export function sanitizeAnimeFilenamePart(value: string): string {
  const withoutControls = Array.from(value, (ch) => (ch.charCodeAt(0) < 32 ? ' ' : ch)).join('');
  return withoutControls
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
}

export function buildAnimeThemeFilename(params: {
  showTitle: string;
  themeSlug: string;
  version?: number;
  resolution?: number;
  nc?: boolean;
  format: AnimeThemeOutputFormat;
}): string {
  const show = sanitizeAnimeFilenamePart(params.showTitle) || 'Anime';
  const theme = sanitizeAnimeFilenamePart(params.themeSlug) || 'Theme';
  const versionSuffix = params.version && params.version > 1 ? ` v${params.version}` : '';
  const tags: string[] = [];
  if (params.resolution) tags.push(`${params.resolution}p`);
  if (params.nc) tags.push('NC');
  const tagSuffix = tags.length > 0 ? ` (${tags.join(' ')})` : '';
  const ext = params.format === 'webm' ? 'webm' : 'mp4';

  return `${show} - ${theme}${versionSuffix}${tagSuffix}.${ext}`;
}

export class AnimeThemesService {
  private static suggestCache = new Map<string, AnimeThemeSuggestion[]>();

  static async suggest(query: string): Promise<AnimeThemeSuggestion[]> {
    const key = query.trim().toLowerCase();
    if (key.length < 2) return [];
    const cached = this.suggestCache.get(key);
    if (cached) return cached;

    const results = await invoke<AnimeThemeSuggestion[]>('animethemes_suggest', { query: query.trim() });
    if (this.suggestCache.size > 50) {
      const firstKey = this.suggestCache.keys().next().value;
      if (firstKey) this.suggestCache.delete(firstKey);
    }
    this.suggestCache.set(key, results);
    dispatchDebug('animethemes', `Suggest "${key}" -> ${results.length} hits`);
    return results;
  }

  static async search(query: string): Promise<AnimeThemeAnime[]> {
    const started = performance.now();
    dispatchDebug('animethemes', 'Searching GraphQL API', { query });
    try {
      const results = await invoke<AnimeThemeAnime[]>('animethemes_search', { query });
      dispatchDebug('animethemes', `Search returned ${results.length} anime`, {
        ms: Math.round(performance.now() - started),
      });
      return results;
    } catch (err) {
      dispatchDebug('animethemes', 'Search failed', String(err));
      throw err;
    }
  }

  static fetchCovers(items: { slug: string; title: string }[]): Promise<Record<string, string>> {
    if (items.length === 0) return Promise.resolve({});
    return invoke<Record<string, string>>('animethemes_fetch_covers', { items });
  }

  static downloadRaw(url: string, destPath: string): Promise<string> {
    return invoke<string>('animethemes_download', { url, destPath });
  }

  static async downloadAndConvert(options: {
    url: string;
    outputDir: string;
    fileName: string;
    format: AnimeThemeOutputFormat;
    metadata?: {
      songTitle?: string;
      artists?: string[];
      showTitle?: string;
      year?: number;
    };
    onStatus?: (label: string) => void;
  }): Promise<string> {
    const { url, outputDir, fileName, format, metadata, onStatus } = options;
    const finalPath = joinPath(outputDir, fileName);

    if (await exists(finalPath)) {
      onStatus?.('Already exists');
      return finalPath;
    }

    if (format === 'webm') {
      onStatus?.('Downloading WebM...');
      await this.downloadRaw(url, finalPath);
      onStatus?.('Saved');
      return finalPath;
    }

    const tempWebm = `${finalPath}.source.webm`;
    const tempMp4 = `${finalPath}.part.mp4`;

    try {
      onStatus?.('Downloading WebM...');
      await this.downloadRaw(url, tempWebm);

      const durationSec = await YtDlpService.getMediaDuration(tempWebm);
      const available = await YtDlpService.getAvailableEncoders();
      const candidates = YtDlpService.buildEncoderCandidates(format, available);
      dispatchDebug('animethemes', 'Transcode plan', {
        fileName,
        format,
        durationSec,
        candidates: candidates.map((c) => c.encoder),
      });

      let converted = false;
      for (const candidate of candidates) {
        onStatus?.(`Converting ${format.toUpperCase()} (${candidate.encoder})...`);
        const metadataArgs: string[] = [];
        if (metadata?.songTitle) metadataArgs.push('-metadata', `title=${metadata.songTitle}`);
        if (metadata?.artists && metadata.artists.length > 0) {
          metadataArgs.push('-metadata', `artist=${metadata.artists.join(', ')}`);
        }
        if (metadata?.showTitle) metadataArgs.push('-metadata', `album=${metadata.showTitle}`);
        if (metadata?.year) metadataArgs.push('-metadata', `date=${metadata.year}`);

        const args = [
          '-hide_banner',
          '-y',
          '-i', tempWebm,
          '-map', '0:v:0',
          ...candidate.args,
          '-pix_fmt:v:0', 'yuv420p',
          '-movflags', '+faststart',
          ...(format === 'hevc' ? ['-tag:v:0', 'hvc1'] : []),
          '-map', '0:a?',
          '-c:a', 'aac',
          '-b:a', '192k',
          ...metadataArgs,
          tempMp4,
        ];

        const cmd = Command.sidecar('ffmpeg', args);
        cmd.stderr.on('data', (line: string) => {
          const m = line.match(/time=\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
          if (m && durationSec > 0) {
            const cur = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
            const pct = Math.min(99, Math.round((cur / durationSec) * 100));
            onStatus?.(`Converting ${format.toUpperCase()} ${pct}%`);
          }
        });

        const res = await cmd.execute();
        if (res.code === 0 && (await exists(tempMp4))) {
          await rename(tempMp4, finalPath);
          dispatchLog(`[animethemes] Converted ${fileName} with ${candidate.encoder}`);
          converted = true;
          break;
        }

        if (await exists(tempMp4)) await remove(tempMp4).catch(() => {});
        if (candidate.encoder !== 'libx264' && candidate.encoder !== 'libx265') {
          YtDlpService.failedEncoders.add(candidate.encoder);
        }
      }

      if (!converted) {
        throw new Error(`FFmpeg failed to convert ${fileName} to ${format.toUpperCase()}.`);
      }

      onStatus?.('Saved');
      return finalPath;
    } finally {
      if (await exists(tempWebm)) await remove(tempWebm).catch(() => {});
      if (await exists(tempMp4)) await remove(tempMp4).catch(() => {});
    }
  }
}
