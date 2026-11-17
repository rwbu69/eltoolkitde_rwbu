import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import pLimit from 'p-limit';
import { YtDlpService, DownloadProgress, DownloadOptions } from '../services/ytdlp';
import { invoke } from '@tauri-apps/api/core';
import type { AudioBitrate, VideoCodec, VideoQuality } from '../config/mediaSettings';
import { isValidMediaUrl, normalizeConcurrency, normalizeRateLimit } from '../utils/validation';

const normalizeSettings = (settings: Partial<AppSettings> = {}): AppSettings => ({
  ...DEFAULT_SETTINGS,
  ...settings,
  defaultVideoQuality:
    (settings as { defaultVideoQuality?: string }).defaultVideoQuality === 'best' ? '1080p' :
    (settings as { defaultVideoQuality?: string }).defaultVideoQuality === 'mid' ? '720p' :
    (settings as { defaultVideoQuality?: string }).defaultVideoQuality === 'low' ? '360p' :
    settings.defaultVideoQuality ?? DEFAULT_SETTINGS.defaultVideoQuality,
  defaultVideoCodec:
    settings.defaultVideoCodec === 'h264' ? 'h264' : 'h265',
  defaultAudioBitrate:
    (settings as { defaultAudioBitrate?: string }).defaultAudioBitrate === '128k' ? '192k' :
    settings.defaultAudioBitrate ?? DEFAULT_SETTINGS.defaultAudioBitrate,
  maxConcurrentDownloads: normalizeConcurrency(settings.maxConcurrentDownloads),
  rateLimitSpeed: normalizeRateLimit(settings.rateLimitSpeed),
});

export interface AppSettings {
  defaultOutputDir: string;
  defaultVideoQuality: VideoQuality;
  defaultVideoCodec: VideoCodec;
  defaultAudioBitrate: AudioBitrate;
  cookiesFilePath: string;
  browserForCookies: string;
  closeToTray: boolean;
  enableConcurrentDownloads: boolean;
  maxConcurrentDownloads: number;
  rateLimitSpeed: string;
  theme: 'light' | 'dark';
  enableKhinsider: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultOutputDir: '',
  defaultVideoQuality: '1080p',
  defaultVideoCodec: 'h265',
  defaultAudioBitrate: '320k',
  cookiesFilePath: '',
  browserForCookies: '',
  closeToTray: true,
  enableConcurrentDownloads: true,
  maxConcurrentDownloads: 3,
  rateLimitSpeed: '',
  theme: 'light',
  enableKhinsider: false,
};

export type QueueItemStatus = 'pending' | 'fetching' | 'downloading' | 'expanded' | 'done' | 'error' | 'canceled';

export interface QueueDownloadOptions {
  outputDir: string;
  videoQuality: VideoQuality;
  videoCodec?: VideoCodec;
  audioBitrate: AudioBitrate;
  cookiesFilePath: string;
  browserForCookies: string;
  rateLimit: string;
}

export interface QueueItem {
  id: string;
  url: string;
  title: string;
  format: 'mp4' | 'mp3' | 'video-only';
  status: QueueItemStatus;
  options: QueueDownloadOptions;
  playlistItemCount?: number;
  progress?: DownloadProgress;
  error?: string;
  cancelFn?: () => void;
}

interface AppState {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  
  queue: QueueItem[];
  isQueuePaused: boolean;
  pauseReason: string;
  resumeQueue: () => void;
  addToQueue: (
    url: string,
    format: 'mp4' | 'mp3' | 'video-only',
    allowPlaylistExpansion?: boolean,
    options?: QueueDownloadOptions,
    knownTitle?: string
  ) => void;
  addBatchToQueue: (
    items: { url: string; title: string }[],
    format: 'mp4' | 'mp3' | 'video-only',
    options?: QueueDownloadOptions,
    playlistTitle?: string
  ) => void;
  retryItem: (id: string) => void;
  retryFailed: () => void;
  removeFromQueue: (id: string) => void;
  clearCompleted: (statuses?: QueueItemStatus[]) => void;
  cancelItem: (id: string) => void;
  cancelAllDownloads: () => void;
}

// Create a singleton limit outside the store to easily recreate it if limit changes
let activeLimit = pLimit(DEFAULT_SETTINGS.maxConcurrentDownloads);
let downloadGeneration = 0;
const MAX_PLAYLIST_ITEMS = 500;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      
      updateSettings: (updates) => {
        set((state) => {
          const nextSettings = normalizeSettings({ ...state.settings, ...updates });
          
          // Sync with Rust backend for close behavior
          if (updates.closeToTray !== undefined) {
            invoke('set_close_behavior', { closeToTray: nextSettings.closeToTray }).catch(console.error);
          }
          if (updates.enableKhinsider !== undefined) {
            invoke('set_khinsider_enabled', { enabled: nextSettings.enableKhinsider }).catch(console.error);
            if (!nextSettings.enableKhinsider) {
              invoke('clear_khinsider_cache').catch(console.error);
            }
          }
          
          // Re-create the limit pool if concurrency settings changed
          if (updates.maxConcurrentDownloads !== undefined || updates.enableConcurrentDownloads !== undefined) {
            const newLimit = nextSettings.enableConcurrentDownloads ? Math.max(1, nextSettings.maxConcurrentDownloads) : 1;
            activeLimit = pLimit(newLimit);
          }
          
          return { settings: nextSettings };
        });
      },

      queue: [],
      isQueuePaused: false,
      pauseReason: '',

      resumeQueue: () => {
        set({ isQueuePaused: false, pauseReason: '' });
      },
      
      addToQueue: async (url, format, allowPlaylistExpansion = false, providedOptions, knownTitle) => {
        const generation = downloadGeneration;
        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const state = get();
        const queueOptions = providedOptions ?? {
          outputDir: state.settings.defaultOutputDir,
          videoQuality: state.settings.defaultVideoQuality,
          videoCodec: state.settings.defaultVideoCodec,
          audioBitrate: state.settings.defaultAudioBitrate,
          cookiesFilePath: state.settings.cookiesFilePath,
          browserForCookies: state.settings.browserForCookies,
          rateLimit: state.settings.rateLimitSpeed,
        };
        if (!isValidMediaUrl(url)) {
          set((currentState) => ({
            queue: [...currentState.queue, {
              id,
              url,
              title: 'Invalid URL',
              format,
              status: 'error',
              options: queueOptions,
              error: 'Enter a valid http:// or https:// media URL.',
            }],
          }));
          return;
        }
        const newItem: QueueItem = {
          id,
          url,
          title: knownTitle || 'Queued item...',
          format,
          status: 'pending',
          options: queueOptions,
        };
        
        set((s) => ({ queue: [...s.queue, newItem] }));
        
        // Push the item to the processing pool
        activeLimit(async () => {
          while (get().isQueuePaused) {
            if (generation !== downloadGeneration || get().queue.find(q => q.id === id)?.status === 'canceled') {
              return;
            }
            await new Promise(r => setTimeout(r, 800));
          }

          if (generation !== downloadGeneration || get().queue.find(q => q.id === id)?.status === 'canceled') {
            set((s) => ({ queue: s.queue.map(q => q.id === id ? { ...q, status: 'canceled' as QueueItemStatus, error: 'Canceled by user' } : q) }));
            return;
          }

          if (!queueOptions.outputDir) {
            set((s) => ({
              queue: s.queue.map(q => q.id === id ? { ...q, status: 'error', error: 'No output directory set in settings.' } : q)
            }));
            return;
          }

          try {
            let finalTitle = knownTitle;

            // Only fetch metadata if title is unknown or if playlist expansion is explicitly requested
            if (!finalTitle || allowPlaylistExpansion) {
              set((s) => ({
                queue: s.queue.map(q => q.id === id ? { ...q, status: 'fetching' } : q)
              }));
              
              const info = await YtDlpService.fetchVideoInfo(url, queueOptions.cookiesFilePath, queueOptions.browserForCookies);

              if (generation !== downloadGeneration || get().queue.find(q => q.id === id)?.status === 'canceled') {
                set((s) => ({ queue: s.queue.map(q => q.id === id ? { ...q, status: 'canceled' as QueueItemStatus, error: 'Canceled by user' } : q) }));
                return;
              }
              
              // If it's a playlist, extract items and queue them in batch without double-fetching!
              if (info.isPlaylist && info.entries && info.entries.length > 0) {
                const entries = info.entries;
                if (entries.length > MAX_PLAYLIST_ITEMS) {
                  set((s) => ({
                    queue: s.queue.map(q => q.id === id ? {
                      ...q,
                      title: info.title,
                      playlistItemCount: entries.length,
                      status: 'error',
                      error: `Playlist has ${entries.length} items. The maximum supported size is ${MAX_PLAYLIST_ITEMS}.`,
                    } : q),
                  }));
                  return;
                }
                if (!allowPlaylistExpansion) {
                  set((s) => ({
                    queue: s.queue.map(q => q.id === id ? {
                      ...q,
                      title: info.title,
                      playlistItemCount: entries.length,
                      status: 'error' as QueueItemStatus,
                      error: 'Playlist detected. Inspect and confirm it before queueing.'
                    } : q)
                  }));
                  return;
                }
                set((s) => ({
                  queue: s.queue.map(q => q.id === id ? {
                    ...q,
                    title: `${info.title} (${entries.length} items)`,
                    playlistItemCount: entries.length,
                    status: 'expanded' as QueueItemStatus,
                    error: 'Playlist added to the queue'
                  } : q)
                }));
                
                // Add all entries directly using addBatchToQueue with known titles
                get().addBatchToQueue(
                  entries.map(e => ({
                    url: e.url || (e.id && e.id.length === 11 ? `https://www.youtube.com/watch?v=${e.id}` : e.id),
                    title: e.title || e.id
                  })),
                  format,
                  queueOptions
                );
                return;
              }

              finalTitle = info.title;
            }

            // Not a playlist (or known individual track), proceed to download directly
            set((s) => ({
              queue: s.queue.map(q => q.id === id ? { ...q, title: finalTitle || q.title, status: 'downloading' } : q)
            }));

            const downloadOptions: DownloadOptions = {
              url,
              format,
              ...queueOptions
            };

            const { task, cancel } = await YtDlpService.downloadMedia(downloadOptions, (progress) => {
              set((s) => ({
                queue: s.queue.map(q => q.id === id ? {
                  ...q,
                  progress,
                  status: progress.status === 'done' || progress.status === 'error' || progress.status === 'canceled'
                    ? progress.status
                    : 'downloading'
                } : q)
              }));
            });

            // Store cancel function
            set((s) => ({
              queue: s.queue.map(q => q.id === id ? { ...q, cancelFn: cancel } : q)
            }));

            await task;

          } catch (error: any) {
            const errMsg = error?.message || String(error);
            const isRateLimit = /rate-limited|429|This content isn't available, try again later/i.test(errMsg);

            if (isRateLimit) {
              set({
                isQueuePaused: true,
                pauseReason: 'YouTube rate limit detected. Remaining downloads paused to protect your IP.'
              });
            }

            set((s) => ({
              queue: s.queue.map(q => q.id === id && q.status !== 'canceled'
                ? { ...q, status: 'error', error: errMsg }
                : q)
            }));
          }
        });
      },

      addBatchToQueue: (items, format, providedOptions, playlistTitle) => {
        const generation = downloadGeneration;
        const state = get();
        const queueOptions = providedOptions ?? {
          outputDir: state.settings.defaultOutputDir,
          videoQuality: state.settings.defaultVideoQuality,
          videoCodec: state.settings.defaultVideoCodec,
          audioBitrate: state.settings.defaultAudioBitrate,
          cookiesFilePath: state.settings.cookiesFilePath,
          browserForCookies: state.settings.browserForCookies,
          rateLimit: state.settings.rateLimitSpeed,
        };

        const newItems: QueueItem[] = [];

        // If a playlist title is provided, add an "expanded" card representing the playlist container
        if (playlistTitle) {
          newItems.push({
            id: `${Date.now()}-playlist-${Math.random().toString(36).substring(2, 9)}`,
            url: items[0]?.url || '',
            title: `${playlistTitle} (${items.length} items)`,
            format,
            status: 'expanded',
            playlistItemCount: items.length,
            options: queueOptions,
            error: 'Playlist added to the queue'
          });
        }

        const validEntries = items.filter(it => isValidMediaUrl(it.url));

        validEntries.forEach((it) => {
          const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          newItems.push({
            id,
            url: it.url,
            title: it.title || 'Queued item...',
            format,
            status: 'pending',
            options: queueOptions,
          });
        });

        set((s) => ({ queue: [...s.queue, ...newItems] }));

        // Enqueue each item into activeLimit with knownTitle so it skips redundant fetchVideoInfo
        newItems
          .filter(it => it.status === 'pending')
          .forEach((it) => {
            const id = it.id;
            const url = it.url;

            activeLimit(async () => {
              while (get().isQueuePaused) {
                if (generation !== downloadGeneration || get().queue.find(q => q.id === id)?.status === 'canceled') {
                  return;
                }
                await new Promise(r => setTimeout(r, 800));
              }

              if (generation !== downloadGeneration || get().queue.find(q => q.id === id)?.status === 'canceled') {
                set((s) => ({ queue: s.queue.map(q => q.id === id ? { ...q, status: 'canceled' as QueueItemStatus, error: 'Canceled by user' } : q) }));
                return;
              }

              if (!queueOptions.outputDir) {
                set((s) => ({
                  queue: s.queue.map(q => q.id === id ? { ...q, status: 'error', error: 'No output directory set in settings.' } : q)
                }));
                return;
              }

              try {
                set((s) => ({
                  queue: s.queue.map(q => q.id === id ? { ...q, status: 'downloading' } : q)
                }));

                const downloadOptions: DownloadOptions = {
                  url,
                  format,
                  ...queueOptions
                };

                const { task, cancel } = await YtDlpService.downloadMedia(downloadOptions, (progress) => {
                  set((s) => ({
                    queue: s.queue.map(q => q.id === id ? {
                      ...q,
                      progress,
                      status: progress.status === 'done' || progress.status === 'error' || progress.status === 'canceled'
                        ? progress.status
                        : 'downloading'
                    } : q)
                  }));
                });

                // Store cancel function
                set((s) => ({
                  queue: s.queue.map(q => q.id === id ? { ...q, cancelFn: cancel } : q)
                }));

                await task;

              } catch (error: any) {
                const errMsg = error?.message || String(error);
                const isRateLimit = /rate-limited|429|This content isn't available, try again later/i.test(errMsg);

                if (isRateLimit) {
                  set({
                    isQueuePaused: true,
                    pauseReason: 'YouTube rate limit detected. Remaining downloads paused to protect your IP.'
                  });
                }

                set((s) => ({
                  queue: s.queue.map(q => q.id === id && q.status !== 'canceled'
                    ? { ...q, status: 'error', error: errMsg }
                    : q)
                }));
              }
            });
          });
      },

      removeFromQueue: (id) => {
        set((state) => {
          const item = state.queue.find(q => q.id === id);
          if (item?.cancelFn) {
            item.cancelFn();
          }
          return { queue: state.queue.filter(q => q.id !== id) };
        });
      },

      retryItem: (id) => {
        const item = get().queue.find(q => q.id === id);
        if (!item || (item.status !== 'error' && item.status !== 'canceled')) return;
        get().addToQueue(item.url, item.format, true, item.options);
      },

      retryFailed: () => {
        const failedItems = get().queue.filter(q => q.status === 'error');
        failedItems.forEach(item => {
          get().addToQueue(item.url, item.format, true, item.options);
        });
      },

      clearCompleted: (statuses = ['done', 'error', 'canceled', 'expanded']) => {
        set((state) => ({
          queue: state.queue.filter(q => !statuses.includes(q.status))
        }));
      },

      cancelItem: (id) => {
        set((state) => {
          const queue = state.queue.map(q => {
            if (q.id === id) {
              if (q.cancelFn) {
                q.cancelFn();
              }
              return { ...q, status: 'canceled' as QueueItemStatus, error: 'Canceled by user' };
            }
            return q;
          });
          return { queue };
        });
      },

      cancelAllDownloads: () => {
        downloadGeneration += 1;
        set((state) => {
          const queue = state.queue.map(q => {
            if (q.status === 'pending' || q.status === 'fetching' || q.status === 'downloading') {
              q.cancelFn?.();
              return { ...q, status: 'canceled' as QueueItemStatus, error: 'Canceled by user' };
            }
            return q;
          });
          return { queue, isQueuePaused: false, pauseReason: '' };
        });
      }
    }),
    {
      name: 'eltoolkit-storage',
      partialize: (state) => ({
        settings: {
          ...state.settings,
        },
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        settings: normalizeSettings((persistedState as Partial<AppState>)?.settings),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Initialize limit on app load
          const { enableConcurrentDownloads, maxConcurrentDownloads } = state.settings;
          const newLimit = enableConcurrentDownloads ? Math.max(1, maxConcurrentDownloads) : 1;
          activeLimit = pLimit(newLimit);
        }
      }
    }
  )
);
