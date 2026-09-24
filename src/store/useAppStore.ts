import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import pLimit from 'p-limit';
import { YtDlpService, DownloadProgress, DownloadOptions } from '../services/ytdlp';
import { invoke } from '@tauri-apps/api/core';

export interface AppSettings {
  defaultOutputDir: string;
  defaultVideoQuality: 'best' | 'mid' | 'low';
  defaultAudioBitrate: '320k' | '256k' | '192k';
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
  defaultVideoQuality: 'best',
  defaultAudioBitrate: '320k',
  cookiesFilePath: '',
  browserForCookies: '',
  closeToTray: true,
  enableConcurrentDownloads: true,
  maxConcurrentDownloads: 3,
  rateLimitSpeed: '',
  theme: 'light',
};

export type QueueItemStatus = 'pending' | 'fetching' | 'downloading' | 'done' | 'error';

export interface QueueItem {
  id: string;
  url: string;
  title: string;
  format: 'mp4' | 'mp3' | 'video-only';
  status: QueueItemStatus;
  progress?: DownloadProgress;
  error?: string;
  cancelFn?: () => void;
}

interface AppState {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  
  queue: QueueItem[];
  addToQueue: (url: string, format: 'mp4' | 'mp3' | 'video-only') => void;
  removeFromQueue: (id: string) => void;
  clearCompleted: () => void;
  cancelItem: (id: string) => void;
}

// Create a singleton limit outside the store to easily recreate it if limit changes
let activeLimit = pLimit(DEFAULT_SETTINGS.maxConcurrentDownloads);

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
      
      addToQueue: async (url, format) => {
        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const newItem: QueueItem = {
          id,
          url,
          title: 'Queued item...',
          format,
          status: 'pending'
        };
        
        set((state) => ({ queue: [...state.queue, newItem] }));
        
        // Push the item to the processing pool
        activeLimit(async () => {
          const state = get();
          const { settings } = state;
          
          if (!settings.defaultOutputDir) {
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
            
            // If it's a playlist, we need to extract the items and queue them individually instead!
            if (info.isPlaylist && info.entries && info.entries.length > 0) {
              set((s) => ({
                queue: s.queue.filter(q => q.id !== id) // Remove the playlist parent item
              }));
              
              // Queue each entry
              for (const entry of info.entries) {
                // Construct URL from ID
                const entryUrl = entry.url || (entry.id.length === 11 ? `https://www.youtube.com/watch?v=${entry.id}` : entry.id);
                get().addToQueue(entryUrl, format);
              }
              return;
            }

            // Not a playlist, proceed to download
            set((s) => ({
              queue: s.queue.map(q => q.id === id ? { ...q, title: info.title, status: 'downloading' } : q)
            }));

            const options: DownloadOptions = {
              url,
              format,
              outputDir: settings.defaultOutputDir,
              videoQuality: settings.defaultVideoQuality,
              audioBitrate: settings.defaultAudioBitrate,
              cookiesFilePath: settings.cookiesFilePath,
              browserForCookies: settings.browserForCookies,
              rateLimit: settings.rateLimitSpeed
            };

            const { task, cancel } = await YtDlpService.downloadMedia(options, (progress) => {
              set((s) => ({
                queue: s.queue.map(q => q.id === id ? { ...q, progress, status: progress.status === 'done' || progress.status === 'error' ? progress.status : 'downloading' } : q)
              }));
            });

            // Store cancel function
            set((s) => ({
              queue: s.queue.map(q => q.id === id ? { ...q, cancelFn: cancel } : q)
            }));

            await task;

          } catch (error: any) {
            set((s) => ({
              queue: s.queue.map(q => q.id === id ? { ...q, status: 'error', error: error.message || String(error) } : q)
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

      clearCompleted: () => {
        set((state) => ({
          queue: state.queue.filter(q => q.status !== 'done' && q.status !== 'error')
        }));
      },

      cancelItem: (id) => {
        set((state) => {
          const queue = state.queue.map(q => {
            if (q.id === id) {
              if (q.cancelFn) {
                q.cancelFn();
              }
              return { ...q, status: 'error' as QueueItemStatus, error: 'Canceled by user' };
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
