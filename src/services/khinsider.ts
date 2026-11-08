import { invoke } from '@tauri-apps/api/core';

export interface KhinsiderCategory {
  name: string;
  url: string;
}

export interface KhinsiderAlbum {
  title: string;
  url: string;
  cover_url?: string;
}

export interface KhinsiderTrack {
  title: string;
  source_url: string;
  mp3_url?: string;
  flac_url?: string;
}

export interface KhinsiderPage {
  title: string;
  categories: KhinsiderCategory[];
  albums: KhinsiderAlbum[];
  tracks: KhinsiderTrack[];
}

export const KHINSIDER_HOME = 'https://downloads.khinsider.com/';

export class KhinsiderService {
  static fetchPage(url: string): Promise<KhinsiderPage> {
    return invoke<KhinsiderPage>('fetch_khinsider_page', { url });
  }

  static search(query: string): Promise<KhinsiderPage> {
    const searchUrl = `https://downloads.khinsider.com/search?search=${encodeURIComponent(query)}`;
    return this.fetchPage(searchUrl);
  }

  static resolveTrack(url: string): Promise<{ mp3_url?: string; flac_url?: string }> {
    return invoke('resolve_khinsider_track', { url });
  }

  static downloadFile(
    url: string,
    outputDir: string,
    fileName: string,
    downloadId: string,
    subfolder?: string
  ): Promise<string> {
    return invoke<string>('download_khinsider_file', { url, outputDir, fileName, downloadId, subfolder });
  }

  static cancelDownload(downloadId: string): Promise<void> {
    return invoke('cancel_khinsider_download', { downloadId });
  }
}
