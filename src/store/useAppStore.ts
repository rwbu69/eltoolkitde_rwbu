import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import pLimit from 'p-limit';
import { YtDlpService, DownloadProgress, DownloadOptions } from '../services/ytdlp';
import { invoke } from '@tauri-apps/api/core';
import type { AudioBitrate, VideoQuality } from '../config/mediaSettings';

const normalizeSettings = (settings: Partial<AppSettings> = {}): AppSettings => ({
  ...DEFAULT_SETTINGS,
  ...settings,
  defaultVideoQuality:
    (settings as { defaultVideoQuality?: string }).defaultVideoQuality === 'best' ? '1080p' :
    (settings as { defaultVideoQuality?: string }).defaultVideoQuality === 'mid' ? '720p' :
    (settings as { defaultVideoQuality?: string }).defaultVideoQuality === 'low' ? '360p' :
    settings.defaultVideoQuality ?? DEFAULT_SETTINGS.defaultVideoQuality,
  defaultAudioBitrate:
    (settings as { defaultAudioBitrate?: string }).defaultAudioBitrate === '128k' ? '192k' :
    settings.defaultAudioBitrate ?? DEFAULT_SETTINGS.defaultAudioBitrate,
});

export interface AppSettings {
  defaultOutputDir: string;
  defaultVideoQuality: VideoQuality;
  defaultAudioBitrate: AudioBitrate;
  cookiesFilePath: string;
  browserForCookies: string;
  closeToTray: boolean;
  enableConcurrentDownloads: boolean;
  maxConcurrentDownloads: number;
  rateLimitSpeed: string;
  theme: 'light' | 'dark';
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultOutputDir: '',
  defaultVideoQuality: '1080p',
  defaultAudioBitrate: '320k',
  cookiesFilePath: '',
  browserForCookies: '',
  closeToTray: true,
  enableConcurrentDownloads: true,
  maxConcurrentDownloads: 3,
  rateLimitSpeed: '',
  theme: 'light',
};

export type QueueItemStatus = 'pending' | 'fetching' | 'downloading' | 'expanded' | 'done' | 'error' | 'canceled';

export interface QueueDownloadOptions {
  outputDir: string;
  videoQuality: VideoQuality;
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
  addToQueue: (url: string, format: 'mp4' | 'mp3' | 'video-only', allowPlaylistExpansion?: boolean, options?: QueueDownloadOptions) => void;
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

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      
      updateSettings: (updates) => {
        set((state) => {
          const nextSettings = { ...state.settings, ...updates };
          
          // Sync with Rust backend for close behavior
          if (updates.closeToTray !== undefined) {
            invoke('set_close_behavior', { closeToTray: nextSettings.closeToTray }).catch(console.error);
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
      
      addToQueue: async (url, format, allowPlaylistExpansion = false, providedOptions) => {
        const generation = downloadGeneration;
        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const state = get();
        const queueOptions = providedOptions ?? {
          outputDir: state.settings.defaultOutputDir,
          videoQuality: state.settings.defaultVideoQuality,
          audioBitrate: state.settings.defaultAudioBitrate,
          cookiesFilePath: state.settings.cookiesFilePath,
          browserForCookies: state.settings.browserForCookies,
          rateLimit: state.settings.rateLimitSpeed,
        };
        const newItem: QueueItem = {
          id,
          url,
          title: 'Queued item...',
          format,
          status: 'pending',
          options: queueOptions,
        };
        
        set((state) => ({ queue: [...state.queue, newItem] }));
        
        // Push the item to the processing pool
        activeLimit(async () => {
          if (generation !== downloadGeneration || get().queue.find(q => q.id === id)?.status === 'canceled') {
            set((s) => ({ queue: s.queue.map(q => q.id === id ? { ...q, status: 'canceled' as QueueItemStatus, error: 'Canceled by user' } : q) }));
            return;
          }

          const state = get();
          const { settings } = state;
          
          if (!queueOptions.outputDir) {
            set((s) => ({
              queue: s.queue.map(q => q.id === id ? { ...q, status: 'error', error: 'No output directory set in settings.' } : q)
            }));
            return;
          }

          try {
            // 1. Fetch Info first
            set((s) => ({
              queue: s.queue.map(q => q.id === id ? { ...q, status: 'fetching' } : q)
            }));
            
            const info = await YtDlpService.fetchVideoInfo(url, settings.cookiesFilePath, settings.browserForCookies);

            if (generation !== downloadGeneration || get().queue.find(q => q.id === id)?.status === 'canceled') {
              set((s) => ({ queue: s.queue.map(q => q.id === id ? { ...q, status: 'canceled' as QueueItemStatus, error: 'Canceled by user' } : q) }));
              return;
            }
            
            // If it's a playlist, we need to extract the items and queue them individually instead!
            if (info.isPlaylist && info.entries && info.entries.length > 0) {
              if (!allowPlaylistExpansion) {
                set((s) => ({
                  queue: s.queue.map(q => q.id === id ? {
                    ...q,
                    title: info.title,
                    playlistItemCount: info.entries?.length,
                    status: 'error' as QueueItemStatus,
                    error: 'Playlist detected. Inspect and confirm it before queueing.'
                  } : q)
                }));
                return;
              }
              set((s) => ({
                queue: s.queue.map(q => q.id === id ? {
                  ...q,
                  title: `${info.title} (${info.entries?.length ?? 0} items)`,
                  playlistItemCount: info.entries?.length,
                  status: 'expanded' as QueueItemStatus,
                  error: 'Playlist added to the queue'
                } : q)
              }));
              
              // Queue each entry
              for (const entry of info.entries) {
                if (generation !== downloadGeneration) break;
                // Construct URL from ID
                const entryUrl = entry.url || (entry.id.length === 11 ? `https://www.youtube.com/watch?v=${entry.id}` : entry.id);
                get().addToQueue(entryUrl, format, false, queueOptions);
              }
              return;
            }

            // Not a playlist, proceed to download
            set((s) => ({
              queue: s.queue.map(q => q.id === id ? { ...q, title: info.title, status: 'downloading' } : q)
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
            set((s) => ({
              queue: s.queue.map(q => q.id === id && q.status !== 'canceled'
                ? { ...q, status: 'error', error: error.message || String(error) }
                : q)
            }));
          }
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
          return { queue };
        });
      }
    }),
    {
      name: 'eltoolkit-storage',
      partialize: (state) => ({ settings: state.settings }), // Only persist settings, not the queue
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
