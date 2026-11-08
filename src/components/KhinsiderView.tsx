import { useEffect, useRef, useState } from 'react';
import pLimit from 'p-limit';
import { listen } from '@tauri-apps/api/event';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { ArrowLeft, Download, ExternalLink, FolderOpen, LoaderCircle, Music2, Search, X } from 'lucide-react';
import { KhinsiderService, KHINSIDER_HOME, type KhinsiderAlbum, type KhinsiderPage, type KhinsiderTrack } from '../services/khinsider';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import { InlineNotice } from './ui/InlineNotice';
import { PageLayout, Panel, PanelScrollArea, SectionHeader } from './ui/Layout';
import { showToast } from './ui/Toast';
import { PathPicker } from './ui/PathPicker';

function CoverImage({ src, alt, className }: { src?: string; alt: string; className: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<'no-src' | 'loading' | 'loaded' | 'failed'>(src ? 'loading' : 'no-src');

  useEffect(() => {
    setState(src ? 'loading' : 'no-src');
  }, [src]);

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      setState('loaded');
    }
  }, [src]);

  const handleError = () => {
    setState('failed');
    if (import.meta.env.DEV && src) {
      console.warn('[Khinsider cover] failed', { url: src });
    }
  };

  return (
    <div className="relative flex items-center justify-center w-full h-full bg-panel" data-cover-state={state} aria-busy={state === 'loading'}>
      {state !== 'loaded' && <Music2 className="absolute w-8 h-8 text-muted" aria-label={state === 'failed' ? 'Cover unavailable' : 'Cover loading'} />}
      {src && (
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className={`${className} transition-opacity ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setState('loaded')}
          onError={handleError}
        />
      )}
    </div>
  );
}

function logCoverDiagnostics(page: KhinsiderPage) {
  if (!import.meta.env.DEV) return;
  console.table(page.albums.map((item) => {
    const url = item.cover_url ? new URL(item.cover_url) : undefined;
    const path = url?.pathname ?? '';
    return {
      title: item.title,
      rawUrl: item.cover_url ?? '(none)',
      finalUrl: item.cover_url ?? '(none)',
      host: url?.host ?? '(none)',
      hasSpecialCharacters: /[\s%()[\]{}]/.test(path),
      extension: path.split('.').pop() || '(none)',
      state: item.cover_url ? 'pending' : 'no-src',
    };
  }));
}

export default function KhinsiderView() {
  const [page, setPage] = useState<KhinsiderPage | null>(null);
  const [album, setAlbum] = useState<KhinsiderPage | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<KhinsiderAlbum | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadState, setDownloadState] = useState<Record<string, string>>({});
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [resolvingTracks, setResolvingTracks] = useState(false);
  const [selectedDownloadMenuOpen, setSelectedDownloadMenuOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const coverCacheRef = useRef(new Map<string, string>());
  const { settings, updateSettings } = useAppStore();
  const selectedCount = selectedTracks.size;

  const loadPage = async (loader: () => Promise<KhinsiderPage>) => {
    setLoading(true);
    setError('');
    try {
      const nextPage = await loader();
      nextPage.albums = nextPage.albums.map((item) => {
        const cachedCover = coverCacheRef.current.get(item.url);
        return cachedCover ? { ...item, cover_url: cachedCover } : item;
      });
      nextPage.albums.forEach((item) => {
        if (item.cover_url) coverCacheRef.current.set(item.url, item.cover_url);
      });
      logCoverDiagnostics(nextPage);
      setPage(nextPage);
      setAlbum(null);
      setSelectedAlbum(null);
      setSelectedTracks(new Set());
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : String(reason);
      setError(detail);
      showToast('Khinsider could not be loaded.', 'error', detail);
    } finally {
      setResolvingTracks(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage(() => KhinsiderService.fetchPage(KHINSIDER_HOME));
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<{ id: string; percent?: number }>('khinsider-download-progress', (event) => {
      const { id, percent } = event.payload;
      setDownloadState((current) => ({
        ...current,
        [id]: percent === undefined ? 'Downloading...' : `Downloading ${percent}%`,
      }));
    }).then((cleanup) => { unlisten = cleanup; });
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedCount > 0 && selectedCount < (album?.tracks.length ?? 0);
    }
  }, [selectedCount, album?.tracks.length]);

  const openAlbum = async (selected: KhinsiderAlbum) => {
    setLoading(true);
    setError('');
    try {
      setSelectedAlbum(selected);
      const albumPage = await KhinsiderService.fetchPage(selected.url);
      const resolvedCover = albumPage.cover_url ?? selected.cover_url;
      if (resolvedCover) {
        coverCacheRef.current.set(selected.url, resolvedCover);
        setSelectedAlbum({ ...selected, cover_url: resolvedCover });
        setPage((current) => current ? {
          ...current,
          albums: current.albums.map((item) => item.url === selected.url ? { ...item, cover_url: resolvedCover } : item),
        } : current);
      }
      setResolvingTracks(true);
      const resolveLimit = pLimit(2);
      const tracks = await Promise.all(albumPage.tracks.map((track) => resolveLimit(async () => {
        if (!track.source_url.startsWith('https://downloads.khinsider.com/')) return track;
        try {
          return { ...track, ...await KhinsiderService.resolveTrack(track.source_url) };
        } catch {
          return track;
        }
      })));
      setAlbum({ ...albumPage, tracks });
      setSelectedTracks(new Set());
      setResolvingTracks(false);
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : String(reason);
      setError(detail);
      showToast('Album could not be opened.', 'error', detail);
    } finally {
      setLoading(false);
    }
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim()) void loadPage(() => KhinsiderService.search(query.trim()));
  };

  const notifyNative = async (title: string, body: string) => {
    let granted = await isPermissionGranted();
    if (!granted) granted = await requestPermission() === 'granted';
    if (granted) sendNotification({ title, body });
  };

  const downloadTrack = async (track: KhinsiderTrack, format: 'mp3' | 'flac', subfolder?: string, nativeNotification = true): Promise<boolean> => {
    const url = format === 'mp3' ? track.mp3_url : track.flac_url;
    if (!url) return false;
    if (!settings.defaultOutputDir) {
      showToast('Select an output folder before downloading.', 'warning');
      return false;
    }
    const key = `${track.source_url}:${format}`;
    setDownloadState((current) => ({ ...current, [key]: 'Downloading...' }));
    try {
      await KhinsiderService.downloadFile(url, settings.defaultOutputDir, `${track.title}.${format}`, key, subfolder);
      setDownloadState((current) => ({ ...current, [key]: 'Downloaded' }));
      showToast(`${track.title}.${format} downloaded.`, 'success');
      if (nativeNotification) await notifyNative('Download complete', `${track.title}.${format} was saved.`);
      return true;
    } catch (reason) {
      setDownloadState((current) => ({ ...current, [key]: reason instanceof Error && reason.message.includes('canceled') ? 'Canceled' : 'Failed' }));
      showToast('Track download failed.', 'error', reason instanceof Error ? reason.message : String(reason));
      return false;
    }
  };

  const cancelTrackDownload = async (track: KhinsiderTrack, format: 'mp3' | 'flac') => {
    const key = `${track.source_url}:${format}`;
    await KhinsiderService.cancelDownload(key);
    setDownloadState((current) => ({ ...current, [key]: 'Canceling...' }));
  };

  const toggleTrack = (trackUrl: string) => {
    setSelectedTracks((current) => {
      const next = new Set(current);
      if (next.has(trackUrl)) next.delete(trackUrl);
      else next.add(trackUrl);
      return next;
    });
  };

  const toggleAllTracks = () => {
    if (!album) return;
    setSelectedTracks(selectedCount === album.tracks.length
      ? new Set()
      : new Set(album.tracks.map((track) => track.source_url)));
  };

  const downloadSelected = async (format: 'mp3' | 'flac', allTracks = false) => {
    if (!album || !settings.defaultOutputDir) {
      showToast('Select an output folder before downloading.', 'warning');
      return;
    }
    const tracks = album.tracks.filter((track) => {
      const url = format === 'mp3' ? track.mp3_url : track.flac_url;
      return (allTracks || selectedTracks.has(track.source_url)) && Boolean(url);
    });
    if (!tracks.length) {
      showToast(allTracks ? `No ${format.toUpperCase()} tracks are available.` : `Select at least one track with ${format.toUpperCase()} available.`, 'warning');
      return;
    }
    setError('');
    const limit = pLimit(settings.enableConcurrentDownloads ? settings.maxConcurrentDownloads : 1);
    const results = await Promise.all(tracks.map((track) => limit(() => downloadTrack(track, format, album.title, false))));
    const completed = results.filter(Boolean).length;
    const failed = results.length - completed;
    if (failed === 0) {
      showToast(`${completed} ${format.toUpperCase()} tracks downloaded.`, 'success');
      await notifyNative(
        'Batch download complete',
        `${completed} ${format.toUpperCase()} track${completed === 1 ? '' : 's'} were saved.`,
      );
    } else if (completed > 0) {
      showToast(`${completed} of ${results.length} ${format.toUpperCase()} tracks downloaded.`, 'warning', `${failed} track${failed === 1 ? '' : 's'} failed.`);
    } else {
      showToast(`No ${format.toUpperCase()} tracks were downloaded.`, 'error', 'All selected downloads failed.');
    }
  };

  return (
    <PageLayout>
      <div className="flex flex-col w-full min-h-0 gap-4">
        <SectionHeader title="Khinsider browser" />
        <Panel className="flex-1 min-h-0">
          <div className="flex flex-col h-full min-h-0 gap-4">
            <form onSubmit={submitSearch} className="flex gap-2 shrink-0">
              <input
                className="game-input kh-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search game, album, or artist..."
                aria-label="Search Khinsider"
              />
              <Button
                type="submit"
                variant="primary"
                icon={Search}
                disabled={!query.trim()}
                aria-label="Search Khinsider"
                title="Search Khinsider"
                className="kh-control-md w-[48px] px-0"
              />
            </form>

            {error && !album && (
              <Button
                onClick={() => void loadPage(() => query.trim() ? KhinsiderService.search(query.trim()) : KhinsiderService.fetchPage(KHINSIDER_HOME))}
                className="kh-control-md self-start px-3"
              >
                Retry
              </Button>
            )}
            {loading ? (
              <div className="flex items-center justify-center flex-1 gap-2 font-mono text-sm text-muted">
                <LoaderCircle className="w-5 h-5 animate-spin" /> Fetching Khinsider...
              </div>
            ) : album ? (
              <PanelScrollArea>
                <div className="flex items-center justify-between gap-3 pb-3 border-b-2 border-gameborder">
                  <Button
                    icon={ArrowLeft}
                    onClick={() => setAlbum(null)}
                    aria-label="Back to soundtrack list"
                    className="kh-control-md min-w-[88px] px-3"
                  >
                    Back
                  </Button>
                  <span className="rounded-lg bg-appbg px-3 py-2 font-mono text-[10px] font-bold text-ink">
                    {album.tracks.length} tracks
                  </span>
                </div>
                <div className="flex flex-col gap-4 mt-4 sm:flex-row">
                  <div className="flex items-center justify-center w-32 h-32 overflow-hidden rounded-2xl bg-appbg border-gameborder border-3 shrink-0">
                    <CoverImage src={selectedAlbum?.cover_url} alt="" className="object-cover w-full h-full" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-black uppercase text-toska">Album details</p>
                    <h3 className="mt-1 text-2xl font-black font-zen text-ink">{album.title}</h3>
                    <p className="mt-1 font-mono text-xs text-muted">{album.tracks.length} track(s)</p>
                  </div>
                </div>
                {resolvingTracks && (
                  <InlineNotice tone="info" message="Preparing available MP3 and FLAC formats..." detail="Requests are limited to avoid triggering Khinsider rate limits." />
                )}
                <div className="flex flex-col gap-3 mt-4">
                  <div className="kh-container sticky top-2 z-10 order-2 flex flex-wrap items-center gap-3 bg-panel">
                    <div className="flex items-center gap-2">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={album.tracks.length > 0 && selectedCount === album.tracks.length}
                        onChange={toggleAllTracks}
                        aria-label="Select all tracks"
                        aria-checked={selectedCount > 0 && selectedCount < album.tracks.length ? 'mixed' : selectedCount === album.tracks.length}
                        className="h-4 w-4 accent-oshipink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oshipink"
                      />
                      <span className="kh-meta font-bold text-ink" aria-live="polite">
                        {selectedCount} of {album.tracks.length} selected
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedTracks(new Set())}
                        className={`kh-control-sm border-0 bg-transparent px-2 font-bold text-toska underline-offset-2 shadow-none hover:underline ${selectedCount === 0 ? 'invisible pointer-events-none' : ''}`}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="relative flex flex-wrap items-center gap-2 sm:ml-auto">
                      <Button
                        variant="primary"
                        icon={Download}
                        disabled={selectedCount === 0}
                        title={selectedCount === 0 ? 'Select at least one track first' : 'Choose MP3 or FLAC for the selected tracks'}
                        aria-haspopup="menu"
                        aria-expanded={selectedDownloadMenuOpen}
                        onClick={() => setSelectedDownloadMenuOpen((open) => !open)}
                        className="kh-control-md px-3"
                      >
                        Download selected ({selectedCount})
                      </Button>
                      {selectedDownloadMenuOpen && selectedCount > 0 && (
                        <div className="absolute right-0 top-full z-20 mt-2 flex min-w-[180px] flex-col gap-1 rounded-xl border-2 border-gameborder bg-panel p-2 shadow-game-thin" role="menu" aria-label="Selected download format">
                          <span className="px-2 py-1 font-mono text-[10px] font-bold text-muted">Choose format</span>
                          <Button role="menuitem" onClick={() => { setSelectedDownloadMenuOpen(false); void downloadSelected('mp3'); }} className="kh-control-sm px-2">MP3 selected</Button>
                          <Button role="menuitem" onClick={() => { setSelectedDownloadMenuOpen(false); void downloadSelected('flac'); }} className="kh-control-sm px-2">FLAC selected</Button>
                        </div>
                      )}
                      <Button onClick={() => void downloadSelected('mp3', true)} icon={Download} className="kh-control-md px-3">Download all (MP3)</Button>
                      <Button onClick={() => void downloadSelected('flac', true)} icon={Download} className="kh-control-md px-3">Download all (FLAC)</Button>
                    </div>
                  </div>
                  <div className="kh-container order-1 flex flex-wrap items-center gap-2">
                    <label className="kh-meta flex items-center gap-1 font-black text-ink shrink-0" title="Download folder">
                      <FolderOpen className="w-4 h-4 text-toska" />
                      <span>Folder</span>
                    </label>
                    <div className="min-w-[220px] flex-1" title={settings.defaultOutputDir || 'No download folder selected'}>
                      <PathPicker
                        value={settings.defaultOutputDir}
                        onChange={(path) => updateSettings({ defaultOutputDir: path })}
                        placeholder="Select download folder..."
                        compact
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 mt-3">
                  {album.tracks.length ? album.tracks.map((track, index) => (
                    <div key={track.source_url} className={`kh-track-row kh-container grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 transition-colors ${selectedTracks.has(track.source_url) ? 'border-oshipink bg-softpink' : ''}`}>
                      <label className="flex items-center min-w-0 gap-2 min-h-[40px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTracks.has(track.source_url)}
                          onChange={() => toggleTrack(track.source_url)}
                          className="accent-oshipink"
                          aria-label={`Select ${track.title}`}
                        />
                        <span className="font-mono text-xs text-ink truncate"><span className="mr-2 text-muted">{String(index + 1).padStart(2, '0')}</span>{track.title}</span>
                      </label>
                      <div className="flex items-center justify-end gap-1 shrink-0">
                        {(['mp3', 'flac'] as const).map((format) => {
                          const available = format === 'mp3' ? track.mp3_url : track.flac_url;
                          const stateKey = `${track.source_url}:${format}`;
                          return available ? (
                            <Button
                              key={format}
                              onClick={() => void (downloadState[stateKey]?.startsWith('Downloading') ? cancelTrackDownload(track, format) : downloadTrack(track, format))}
                              title={downloadState[stateKey]?.startsWith('Downloading') ? `Cancel ${format.toUpperCase()}` : (downloadState[stateKey] ?? `Download ${format.toUpperCase()}`)}
                              className="kh-control-sm px-2"
                              icon={downloadState[stateKey]?.startsWith('Downloading') ? X : Download}
                            >
                              {format.toUpperCase()}
                            </Button>
                          ) : null;
                        })}
                        <a className="ml-2 rounded-md p-1 text-toska focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oshipink" href={track.mp3_url ?? track.flac_url ?? track.source_url} target="_blank" rel="noreferrer" title="Open source page" aria-label={`Open source page for ${track.title}`}>
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      <span className="col-span-2 font-mono text-[10px] text-muted">
                        {(['mp3', 'flac'] as const)
                          .map((format) => downloadState[`${track.source_url}:${format}`])
                          .filter(Boolean)
                          .join(' / ')}
                      </span>
                    </div>
                  )) : <InlineNotice message="No tracks were detected on this album page yet." tone="warning" />}
                </div>
              </PanelScrollArea>
            ) : page ? (
              <PanelScrollArea className="text-ink">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] font-black uppercase text-toska">Khinsider</p>
                    <h3 className="text-xl font-black font-zen text-ink">{page.title}</h3>
                  </div>
                  <span className="font-mono text-[10px] text-muted">{page.albums.length} soundtracks found</span>
                </div>
                {page.categories.length > 0 && (
                  <section className="mt-4">
                    <h4 className="mb-2 font-mono text-xs font-black uppercase text-toska">Categories</h4>
                    <div className="flex flex-wrap gap-2">
                      {page.categories.slice(0, 24).map((category) => <button key={category.url} className="px-3 py-2 text-xs font-bold border-2 rounded-xl game-btn-secondary" onClick={() => { setQuery(''); void loadPage(() => KhinsiderService.fetchPage(category.url)); }}>{category.name}</button>)}
                    </div>
                  </section>
                )}
                <section className="mt-5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="font-mono text-xs font-black uppercase text-toska">Soundtracks</h4>
                    <span className="font-mono text-[10px] text-muted">Select an album to view tracks</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {page.albums.map((item) => (
                      <button key={item.url} className="flex items-center gap-3 p-3 text-left border-2 rounded-2xl border-gameborder bg-appbg hover:border-oshipink" onClick={() => void openAlbum(item)}>
                        <div className="flex items-center justify-center w-20 h-20 overflow-hidden rounded-xl bg-panel shrink-0">
                          <CoverImage src={item.cover_url} alt="" className="object-cover w-full h-full" />
                        </div>
                        <div className="min-w-0 text-ink">
                          <span className="block font-bold font-zen line-clamp-2 text-ink">{item.title}</span>
                          <span className="block mt-1 font-mono text-[10px] text-muted">Open album details</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  {!page.albums.length && <InlineNotice message="No soundtrack cards were detected on this page." tone="warning" />}
                </section>
              </PanelScrollArea>
            ) : null}
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
}
