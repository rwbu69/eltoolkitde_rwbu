import { useEffect, useRef, useState } from 'react';
import pLimit from 'p-limit';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { tempDir } from '@tauri-apps/api/path';
import { ArrowLeft, Download, Film, LoaderCircle, Play, Search, Tv, X } from 'lucide-react';
import {
  AnimeThemesService,
  buildAnimeThemeFilename,
  type AnimeThemeAnime,
  type AnimeThemeOutputFormat,
  type AnimeThemeSuggestion,
  type AnimeThemeVideo,
} from '../services/animethemes';
import { useAppStore } from '../store/useAppStore';
import { joinPath } from '../utils/path';
import { dispatchDebug, notifySuccess } from '../utils/toolkitEvents';
import { Button } from './ui/Button';
import { CustomSelect } from './ui/CustomSelect';
import { InlineNotice } from './ui/InlineNotice';
import { Panel, PanelScrollArea } from './ui/Layout';
import { PathPicker } from './ui/PathPicker';
import { RateLimitNotice } from './ui/RateLimitNotice';
import { showToast } from './ui/Toast';
import { useRateLimitCooldown } from '../hooks/useRateLimitCooldown';

interface FlattenedThemeVideo {
  id: string;
  themeSlug: string;
  songTitle?: string;
  artists: string[];
  version?: number;
  episodes?: string;
  video: AnimeThemeVideo;
}

function CoverImage({ src, alt, className }: { src?: string; alt: string; className: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<'no-src' | 'loading' | 'loaded' | 'failed'>(src ? 'loading' : 'no-src');

  useEffect(() => {
    setState(src ? 'loading' : 'no-src');
  }, [src]);

  useEffect(() => {
    const img = imageRef.current;
    if (img?.complete && img.naturalWidth > 0) setState('loaded');
  }, [src]);

  return (
    <div className="relative flex items-center justify-center w-full h-full bg-panel">
      {state !== 'loaded' && <Tv className="absolute w-8 h-8 text-muted" />}
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
          onError={() => setState('failed')}
        />
      )}
    </div>
  );
}

function flattenAnimeThemes(anime: AnimeThemeAnime): FlattenedThemeVideo[] {
  const items: FlattenedThemeVideo[] = [];
  for (const theme of anime.themes) {
    for (const entry of theme.entries) {
      for (const video of entry.videos) {
        items.push({
          id: `${anime.slug}-${theme.slug}-v${entry.version ?? 1}-${video.basename}`,
          themeSlug: theme.slug,
          songTitle: theme.song_title,
          artists: theme.artists,
          version: entry.version,
          episodes: entry.episodes,
          video,
        });
      }
    }
  }
  return items;
}

export default function AnimeThemesView() {
  const { settings, updateSettings } = useAppStore();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AnimeThemeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<AnimeThemeAnime[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<AnimeThemeAnime | null>(null);
  const requestedCoversRef = useRef<Set<string>>(new Set());
  const pendingCoversRef = useRef<Map<string, string>>(new Map());
  const coverFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardObserverRef = useRef<IntersectionObserver | null>(null);
  const [outputFormat, setOutputFormat] = useState<AnimeThemeOutputFormat>('h264');
  const [loading, setLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [error, setError] = useState('');
  const { cooldownSeconds, isRateLimited, handleError: handleRateLimitError } = useRateLimitCooldown();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const urlToIdRef = useRef<Record<string, string>>({});

  const [previewItem, setPreviewItem] = useState<FlattenedThemeVideo | null>(null);
  const [previewSrc, setPreviewSrc] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFallbackTried, setPreviewFallbackTried] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ url: string; percent: number }>('animethemes-download-progress', (event) => {
      const id = urlToIdRef.current[event.payload.url];
      if (!id) return;
      setStatusMap((prev) => ({
        ...prev,
        [id]: `Downloading ${event.payload.percent}%`,
      }));
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || isRateLimited) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    let cancelled = false;
    setSuggestLoading(true);
    const timer = setTimeout(() => {
      void AnimeThemesService.suggest(trimmed)
        .then((hits) => {
          if (!cancelled) setSuggestions(hits);
        })
        .catch((err) => {
          if (!cancelled) {
            setSuggestions([]);
            const msg = handleRateLimitError(err);
            if (msg) setError(msg);
          }
        })
        .finally(() => {
          if (!cancelled) setSuggestLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, isRateLimited, handleRateLimitError]);

  useEffect(() => {
    const flushQueue = () => {
      if (pendingCoversRef.current.size === 0) return;
      const batch = Array.from(pendingCoversRef.current.entries())
        .slice(0, 8)
        .map(([slug, title]) => ({ slug, title }));
      for (const item of batch) {
        pendingCoversRef.current.delete(item.slug);
      }
      if (pendingCoversRef.current.size > 0) {
        coverFlushTimerRef.current = setTimeout(flushQueue, 120);
      }
      void AnimeThemesService.fetchCovers(batch)
        .then((covers) => {
          if (Object.keys(covers).length === 0) return;
          setResults((prev) =>
            prev.map((anime) =>
              covers[anime.slug] ? { ...anime, cover_url: covers[anime.slug] } : anime
            )
          );
          setSelectedAnime((prev) =>
            prev && covers[prev.slug] ? { ...prev, cover_url: covers[prev.slug] } : prev
          );
        })
        .catch(() => {});
    };

    cardObserverRef.current = new IntersectionObserver(
      (entries) => {
        let added = false;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const slug = el.dataset.slug;
          const title = el.dataset.title;
          if (slug && title && !requestedCoversRef.current.has(slug)) {
            requestedCoversRef.current.add(slug);
            pendingCoversRef.current.set(slug, title);
            added = true;
          }
          cardObserverRef.current?.unobserve(el);
        }
        if (added) {
          if (coverFlushTimerRef.current) clearTimeout(coverFlushTimerRef.current);
          coverFlushTimerRef.current = setTimeout(flushQueue, 80);
        }
      },
      { rootMargin: '120px' }
    );

    return () => {
      cardObserverRef.current?.disconnect();
      if (coverFlushTimerRef.current) clearTimeout(coverFlushTimerRef.current);
    };
  }, []);

  const runSearch = async (term: string, autoSelectSlug?: string) => {
    const trimmed = term.trim();
    if (!trimmed || isRateLimited) return;
    setShowSuggestions(false);
    setLoading(true);
    setError('');
    setSelectedAnime(null);
    setSelectedIds(new Set());
    requestedCoversRef.current.clear();
    pendingCoversRef.current.clear();
    try {
      const list = await AnimeThemesService.search(trimmed);
      for (const item of list) {
        if (item.cover_url) requestedCoversRef.current.add(item.slug);
      }
      setResults(list);
      if (autoSelectSlug) {
        const matched = list.find((a) => a.slug === autoSelectSlug);
        if (matched) setSelectedAnime(matched);
      }
    } catch (err) {
      const friendly = handleRateLimitError(err, 'Could not search AnimeThemes. Please try again.');
      if (friendly) setError(friendly);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    void runSearch(query);
  };

  const openPreview = (item: FlattenedThemeVideo) => {
    dispatchDebug('animethemes', 'Opening video preview', item.video.link);
    setPreviewItem(item);
    setPreviewSrc(item.video.link);
    setPreviewLoading(false);
    setPreviewFallbackTried(false);
  };

  const handlePreviewError = async () => {
    if (!previewItem || previewFallbackTried) return;
    dispatchDebug('animethemes', 'Direct preview failed; falling back to local $TEMP download', previewItem.video.link);
    setPreviewFallbackTried(true);
    setPreviewLoading(true);
    try {
      const dir = await tempDir();
      const tempPath = joinPath(dir, `eltoolkit-preview-${previewItem.video.basename}`);
      await AnimeThemesService.downloadRaw(previewItem.video.link, tempPath);
      const assetUrl = convertFileSrc(tempPath);
      dispatchDebug('animethemes', 'Preview fallback ready', assetUrl);
      setPreviewSrc(assetUrl);
    } catch (err) {
      const friendly = handleRateLimitError(err, 'Preview could not be loaded.');
      if (friendly) showToast('Preview failed to load.', 'error', friendly);
    } finally {
      setPreviewLoading(false);
    }
  };

  const downloadItems = async (anime: AnimeThemeAnime, items: FlattenedThemeVideo[]) => {
    if (!settings.defaultOutputDir) {
      showToast('Select an output folder first.', 'warning');
      return;
    }
    const limit = pLimit(2);
    let completed = 0;

    await Promise.all(
      items.map((item) =>
        limit(async () => {
          urlToIdRef.current[item.video.link] = item.id;
          const fileName = buildAnimeThemeFilename({
            showTitle: anime.title,
            themeSlug: item.themeSlug,
            version: item.version,
            resolution: item.video.resolution,
            nc: item.video.nc,
            format: outputFormat,
          });
          try {
            await AnimeThemesService.downloadAndConvert({
              url: item.video.link,
              outputDir: settings.defaultOutputDir,
              fileName,
              format: outputFormat,
              metadata: {
                songTitle: item.songTitle,
                artists: item.artists,
                showTitle: anime.title,
                year: anime.year,
              },
              onStatus: (label) => setStatusMap((prev) => ({ ...prev, [item.id]: label })),
            });
            completed += 1;
          } catch (err) {
            const friendly = handleRateLimitError(err, 'Download or conversion failed.');
            setStatusMap((prev) => ({
              ...prev,
              [item.id]: friendly ?? 'Rate limited — wait a moment',
            }));
          }
        })
      )
    );

    if (completed > 0) {
      await notifySuccess('AnimeThemes download complete', `Saved ${completed} theme${completed === 1 ? '' : 's'}.`);
    }
  };

  const flattened = selectedAnime ? flattenAnimeThemes(selectedAnime) : [];
  const allSelected = flattened.length > 0 && selectedIds.size === flattened.length;

  return (
    <div className="flex flex-col w-full h-full min-h-0 gap-3 overflow-hidden pb-16 lg:pb-0">
      <div className="flex flex-col w-full h-full min-h-0 gap-3">
        {/* Top Control Strip */}
        <Panel className="shrink-0 overflow-visible z-20">
          <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center">
            <form onSubmit={handleSearch} className="flex flex-1 gap-2 min-w-0">
              <div ref={searchBoxRef} className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setShowSuggestions(false);
                  }}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  placeholder="Search anime, song, or artist (e.g. Frieren, Kessoku Band)..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl border-2 border-subtleborder bg-appbg text-xs font-mono text-ink placeholder:text-muted focus:outline-none focus:border-oshipink"
                />
                {showSuggestions && (suggestLoading || suggestions.length > 0) && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-panel border-2 border-gameborder rounded-xl shadow-game-thick overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
                    {suggestLoading && suggestions.length === 0 ? (
                      <div className="px-3 py-2.5 flex items-center gap-2 font-mono text-xs text-muted">
                        <LoaderCircle className="w-3.5 h-3.5 animate-spin text-oshipink" />
                        <span>Searching...</span>
                      </div>
                    ) : (
                      suggestions.map((s) => (
                        <button
                          key={s.slug}
                          type="button"
                          onClick={() => {
                            setQuery(s.title);
                            void runSearch(s.title, s.slug);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-appbg border-b last:border-b-0 border-subtleborder/60 flex items-center justify-between gap-2 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="font-zen font-bold text-xs text-ink truncate">{s.title}</p>
                            {s.english_title && s.english_title !== s.title && (
                              <p className="font-mono text-[10px] text-muted truncate">{s.english_title}</p>
                            )}
                          </div>
                          {s.year && (
                            <span className="font-mono text-[10px] text-toska font-bold shrink-0">{s.year}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <Button type="submit" variant="primary" size="md" isLoading={loading} disabled={isRateLimited} icon={Search}>
                {isRateLimited ? `Wait ${cooldownSeconds}s` : 'Search'}
              </Button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-2.5 shrink-0">
              <div className="w-full lg:w-52 shrink-0">
                <CustomSelect
                  value={outputFormat}
                  onChange={(val) => setOutputFormat(val as AnimeThemeOutputFormat)}
                  options={[
                    { value: 'h264', label: 'H.264 MP4 (Resolume)' },
                    { value: 'hevc', label: 'H.265 / HEVC MP4' },
                    { value: 'webm', label: 'Original WebM' },
                  ]}
                />
              </div>

              <div className="w-full lg:w-60 shrink-0">
                <PathPicker
                  value={settings.defaultOutputDir}
                  onChange={(dir) => updateSettings({ defaultOutputDir: dir })}
                  placeholder="Output folder..."
                  directory={true}
                />
              </div>
            </div>
          </div>
        </Panel>

        <RateLimitNotice source="Anime Themes Downloader" seconds={cooldownSeconds} />
        {error && !isRateLimited && <InlineNotice message={error} tone="error" />}

        {/* Main Content Panel */}
        <Panel className="flex-1 min-h-0 overflow-hidden" noPadding>
          <PanelScrollArea className="p-4 min-h-0 overflow-y-auto">
            {loading && !selectedAnime ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <LoaderCircle className="w-7 h-7 animate-spin text-oshipink mb-3" />
                <p className="font-zen font-bold text-sm text-ink">Searching AnimeThemes...</p>
                <p className="font-mono text-xs text-muted mt-1">
                  Fetching shows, songs, and video variants.
                </p>
              </div>
            ) : !selectedAnime ? (
              results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl border-2 border-subtleborder bg-appbg flex items-center justify-center mb-3 text-oshipink">
                    <Film className="w-5 h-5" />
                  </div>
                  <p className="font-zen font-bold text-sm text-ink">Anime Themes Downloader</p>
                  <p className="font-mono text-xs text-muted max-w-sm mt-1">
                    Search any anime to preview OP/ED/Insert themes and download them as H.264, H.265, or WebM.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 lg:gap-3">
                  {results.map((anime) => (
                    <button
                      key={anime.slug}
                      type="button"
                      data-slug={anime.slug}
                      data-title={anime.title}
                      ref={(el) => {
                        if (el && !anime.cover_url && !requestedCoversRef.current.has(anime.slug)) {
                          cardObserverRef.current?.observe(el);
                        }
                      }}
                      onClick={() => {
                        setSelectedAnime(anime);
                        setSelectedIds(new Set());
                      }}
                      className="group text-left bg-appbg border-2 border-subtleborder hover:border-oshipink rounded-2xl overflow-hidden transition-all flex flex-row lg:flex-col items-stretch"
                    >
                      <div className="w-16 h-20 lg:w-full lg:h-auto lg:aspect-[3/4] shrink-0 overflow-hidden border-r lg:border-r-0 lg:border-b border-subtleborder">
                        <CoverImage
                          src={anime.cover_url}
                          alt={anime.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                      <div className="p-2.5 flex flex-col gap-1 flex-1 justify-between min-w-0">
                        <div>
                          <span className="font-zen font-bold text-xs text-ink line-clamp-2 leading-snug block">
                            {anime.title}
                          </span>
                          {anime.english_title && anime.english_title !== anime.title && (
                            <span className="font-mono text-[10px] text-muted line-clamp-1 mt-0.5 block">
                              {anime.english_title}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-muted">
                          <span>{anime.year ?? '—'}</span>
                          <span className="text-toska font-bold">{anime.themes.length} themes</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="flex flex-col gap-3">
                {/* Detail Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-subtleborder">
                  <div className="flex items-center gap-3 min-w-0">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={ArrowLeft}
                      onClick={() => setSelectedAnime(null)}
                    >
                      Back
                    </Button>
                    <div className="min-w-0">
                      <h2 className="font-zen font-black text-sm text-ink truncate">{selectedAnime.title}</h2>
                      <p className="font-mono text-[10px] text-muted truncate">
                        {selectedAnime.english_title && selectedAnime.english_title !== selectedAnime.title
                          ? `${selectedAnime.english_title} • `
                          : ''}
                        {selectedAnime.year ? `${selectedAnime.year} • ` : ''}
                        {flattened.length} video variant{flattened.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (allSelected) {
                          setSelectedIds(new Set());
                        } else {
                          setSelectedIds(new Set(flattened.map((i) => i.id)));
                        }
                      }}
                    >
                      {allSelected ? 'Clear selection' : 'Select all'}
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      icon={Download}
                      disabled={selectedIds.size === 0}
                      onClick={() =>
                        void downloadItems(
                          selectedAnime,
                          flattened.filter((item) => selectedIds.has(item.id))
                        )
                      }
                    >
                      Download ({selectedIds.size})
                    </Button>
                  </div>
                </div>

                {/* Theme List */}
                <div className="flex flex-col gap-2">
                  {flattened.map((item) => {
                    const checked = selectedIds.has(item.id);
                    const status = statusMap[item.id];
                    const targetFile = buildAnimeThemeFilename({
                      showTitle: selectedAnime.title,
                      themeSlug: item.themeSlug,
                      version: item.version,
                      resolution: item.video.resolution,
                      nc: item.video.nc,
                      format: outputFormat,
                    });

                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 bg-appbg border border-subtleborder rounded-xl px-3 py-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(item.id);
                                else next.delete(item.id);
                                return next;
                              });
                            }}
                            className="accent-oshipink rounded shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md bg-softpink text-oshipink font-mono font-bold text-[10px]">
                                {item.themeSlug}
                                {item.version && item.version > 1 ? ` v${item.version}` : ''}
                              </span>
                              {item.video.resolution && (
                                <span className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder font-mono text-[10px] text-ink">
                                  {item.video.resolution}p
                                </span>
                              )}
                              {item.video.nc && (
                                <span className="px-1.5 py-0.5 rounded bg-toska/15 text-toska font-mono font-bold text-[10px]">
                                  NC
                                </span>
                              )}
                              {item.video.subbed && (
                                <span className="px-1.5 py-0.5 rounded bg-panel border border-subtleborder font-mono text-[10px] text-muted">
                                  Subbed
                                </span>
                              )}
                              {status && (
                                <span className="font-mono text-[10px] font-bold text-toska ml-1">
                                  {status}
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-[11px] text-ink truncate mt-0.5" title={targetFile}>
                              {item.songTitle ? `${item.songTitle}${item.artists.length > 0 ? ` — ${item.artists.join(', ')}` : ''}` : targetFile}
                            </p>
                            {item.songTitle && (
                              <p className="font-mono text-[10px] text-muted truncate" title={targetFile}>
                                {targetFile}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={Play}
                            onClick={() => openPreview(item)}
                          >
                            Preview
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            icon={Download}
                            onClick={() => void downloadItems(selectedAnime, [item])}
                          >
                            Download
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </PanelScrollArea>
        </Panel>
      </div>

      {/* Preview Modal */}
      {previewItem && selectedAnime && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-panel border-2 border-gameborder rounded-2xl shadow-game-thick overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-subtleborder bg-appbg">
              <div className="min-w-0">
                <p className="font-zen font-bold text-xs text-ink truncate">
                  {selectedAnime.title} — {previewItem.themeSlug}
                  {previewItem.songTitle ? ` (${previewItem.songTitle})` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-1 rounded-lg text-muted hover:text-ink hover:bg-panel"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-black flex items-center justify-center min-h-[260px] relative">
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-mono text-white/80 bg-black/60 z-10">
                  <LoaderCircle className="w-4 h-4 animate-spin text-oshipink" />
                  <span>Buffering local preview...</span>
                </div>
              )}
              <video
                key={previewSrc}
                src={previewSrc}
                controls
                autoPlay
                playsInline
                onError={() => void handlePreviewError()}
                className="w-full max-h-[380px]"
              />
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 bg-appbg border-t border-subtleborder">
              <span className="font-mono text-[11px] text-muted truncate pr-3">
                {buildAnimeThemeFilename({
                  showTitle: selectedAnime.title,
                  themeSlug: previewItem.themeSlug,
                  version: previewItem.version,
                  resolution: previewItem.video.resolution,
                  nc: previewItem.video.nc,
                  format: outputFormat,
                })}
              </span>
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={Download}
                onClick={() => {
                  const current = previewItem;
                  setPreviewItem(null);
                  void downloadItems(selectedAnime, [current]);
                }}
              >
                Download
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
