use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::time::{Duration, Instant};
use tauri::Emitter;

const ANIMETHEMES_GRAPHQL_URL: &str = "https://rs.animethemes.moe/graphql";
const ANILIST_GRAPHQL_URL: &str = "https://graphql.anilist.co";
const ANIMETHEMES_REFERER: &str = "https://animethemes.moe/";
const USER_AGENT: &str = "ElToolkitDeRWBU/0.1.4";

const ANIME_FIELDS_FRAGMENT: &str = r#"
  slug
  year
  title { romaji english }
  images { nodes { link facet } }
  themes {
    type
    sequence
    slug
    song {
      title { romaji }
      staff {
        artist {
          name { main }
        }
      }
    }
    entries {
      version
      episodes
      videos {
        nodes {
          basename
          resolution
          nc
          subbed
          link
        }
      }
    }
  }
"#;

fn ensure_animethemes_enabled(state: &AppState) -> Result<(), String> {
    state
        .animethemes_enabled
        .lock()
        .map(|enabled| {
            if *enabled {
                Ok(())
            } else {
                Err("AnimeThemes is disabled. Enable it in Settings first.".to_string())
            }
        })
        .unwrap_or_else(|_| Err("AnimeThemes state is unavailable.".to_string()))
}

#[derive(Debug, Serialize)]
pub struct AnimeThemeVideo {
    pub basename: String,
    pub resolution: Option<u32>,
    pub nc: bool,
    pub subbed: bool,
    pub link: String,
}

#[derive(Debug, Serialize)]
pub struct AnimeThemeEntry {
    pub version: Option<u32>,
    pub episodes: Option<String>,
    pub videos: Vec<AnimeThemeVideo>,
}

#[derive(Debug, Serialize)]
pub struct AnimeThemeItem {
    pub theme_type: String,
    pub sequence: Option<u32>,
    pub slug: String,
    pub song_title: Option<String>,
    pub artists: Vec<String>,
    pub entries: Vec<AnimeThemeEntry>,
}

#[derive(Debug, Serialize)]
pub struct AnimeThemeAnime {
    pub slug: String,
    pub title: String,
    pub english_title: Option<String>,
    pub year: Option<u32>,
    pub cover_url: Option<String>,
    pub themes: Vec<AnimeThemeItem>,
}

#[derive(Debug, Serialize)]
pub struct AnimeThemeSuggestion {
    pub slug: String,
    pub title: String,
    pub english_title: Option<String>,
    pub year: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
struct DownloadProgressPayload {
    url: String,
    percent: u8,
}

#[derive(Debug, Deserialize)]
struct GraphQlResponse<T> {
    data: Option<T>,
    errors: Option<Vec<GraphQlError>>,
}

#[derive(Debug, Deserialize)]
struct GraphQlError {
    message: String,
}

#[derive(Debug, Deserialize)]
struct SearchData {
    search: Option<SearchBuckets>,
}

#[derive(Debug, Deserialize)]
struct SearchBuckets {
    anime: Option<AnimePage>,
    songs: Option<SongPage>,
    artists: Option<ArtistPage>,
}

#[derive(Debug, Deserialize)]
struct AnimePage {
    data: Vec<RawAnime>,
}

#[derive(Debug, Deserialize)]
struct SongPage {
    data: Vec<RawSongResult>,
}

#[derive(Debug, Deserialize)]
struct ArtistPage {
    data: Vec<RawArtistResult>,
}

#[derive(Debug, Deserialize)]
struct RawSongResult {
    themes: Option<Vec<RawSlugTheme>>,
}

#[derive(Debug, Deserialize)]
struct RawArtistResult {
    #[serde(rename = "songStaff")]
    song_staff: Option<Vec<RawArtistSongStaff>>,
}

#[derive(Debug, Deserialize)]
struct RawArtistSongStaff {
    song: Option<RawSongResult>,
}

#[derive(Debug, Deserialize)]
struct RawSlugTheme {
    anime: Option<RawAnimeSummary>,
}

#[derive(Debug, Deserialize)]
struct RawAnimeSummary {
    slug: String,
    year: Option<u32>,
    title: Option<RawTitle>,
}

#[derive(Debug, Deserialize)]
struct RawAnime {
    slug: String,
    year: Option<u32>,
    title: RawTitle,
    images: Option<RawImageConnection>,
    themes: Option<Vec<RawTheme>>,
}

#[derive(Debug, Deserialize)]
struct RawTitle {
    romaji: Option<String>,
    english: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawImageConnection {
    nodes: Vec<RawImage>,
}

#[derive(Debug, Deserialize)]
struct RawImage {
    link: String,
    facet: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawTheme {
    #[serde(rename = "type")]
    theme_type: Option<String>,
    sequence: Option<u32>,
    slug: Option<String>,
    song: Option<RawSong>,
    entries: Option<Vec<RawEntry>>,
}

#[derive(Debug, Deserialize)]
struct RawSong {
    title: Option<RawSongTitle>,
    staff: Option<Vec<RawStaff>>,
}

#[derive(Debug, Deserialize)]
struct RawSongTitle {
    romaji: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawStaff {
    artist: Option<RawStaffArtist>,
}

#[derive(Debug, Deserialize)]
struct RawStaffArtist {
    name: Option<RawArtistName>,
}

#[derive(Debug, Deserialize)]
struct RawArtistName {
    main: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawEntry {
    version: Option<u32>,
    episodes: Option<String>,
    videos: Option<RawVideoConnection>,
}

#[derive(Debug, Deserialize)]
struct RawVideoConnection {
    nodes: Vec<RawVideo>,
}

#[derive(Debug, Deserialize)]
struct RawVideo {
    basename: String,
    resolution: Option<u32>,
    nc: Option<bool>,
    subbed: Option<bool>,
    link: String,
}

#[derive(Debug, Deserialize)]
struct AniListCoverImage {
    large: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AniListMedia {
    #[serde(rename = "coverImage")]
    cover_image: Option<AniListCoverImage>,
}

#[derive(Debug, Deserialize)]
struct AniListPage {
    media: Vec<AniListMedia>,
}

#[derive(Debug, Deserialize)]
pub struct CoverLookupItem {
    pub slug: String,
    pub title: String,
}

#[tauri::command]
pub async fn animethemes_fetch_covers(
    state: tauri::State<'_, AppState>,
    items: Vec<CoverLookupItem>,
) -> Result<std::collections::HashMap<String, String>, String> {
    ensure_animethemes_enabled(&state)?;
    let mut resolved = std::collections::HashMap::new();
    let mut uncached = Vec::new();

    if let Ok(cache) = state.animethemes_cover_cache.lock() {
        for item in items {
            if let Some(url) = cache.get(&item.slug) {
                resolved.insert(item.slug, url.clone());
            } else if uncached.len() < 8 {
                uncached.push(item);
            }
        }
    }

    if uncached.is_empty() {
        return Ok(resolved);
    }

    let mut fields = String::new();
    for (i, item) in uncached.iter().enumerate() {
        let escaped = item.title.replace('\\', "\\\\").replace('"', "\\\"");
        fields.push_str(&format!(
            "m{i}: Page(perPage: 1) {{ media(search: \"{escaped}\", type: ANIME) {{ coverImage {{ large }} }} }}\n"
        ));
    }

    let client = build_client(5)?;
    let payload = serde_json::json!({ "query": format!("query {{\n{fields}}}") });
    let Ok(res) = client
        .post(ANILIST_GRAPHQL_URL)
        .header("Content-Type", "application/json")
        .body(payload.to_string())
        .send()
        .await
    else {
        return Ok(resolved);
    };

    if !res.status().is_success() {
        return Ok(resolved);
    }

    let Ok(text) = res.text().await else {
        return Ok(resolved);
    };
    let Ok(parsed) = serde_json::from_str::<
        GraphQlResponse<std::collections::HashMap<String, Option<AniListPage>>>,
    >(&text) else {
        return Ok(resolved);
    };
    let Some(data) = parsed.data else {
        return Ok(resolved);
    };

    if let Ok(mut cache) = state.animethemes_cover_cache.lock() {
        if cache.len() > 250 {
            cache.clear();
        }
        for (i, item) in uncached.into_iter().enumerate() {
            if let Some(Some(page)) = data.get(&format!("m{i}")) {
                if let Some(url) = page
                    .media
                    .first()
                    .and_then(|m| m.cover_image.as_ref())
                    .and_then(|c| c.large.clone())
                {
                    cache.insert(item.slug.clone(), url.clone());
                    resolved.insert(item.slug, url);
                }
            }
        }
    }

    Ok(resolved)
}

fn build_client(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {e}"))
}

fn rate_limit_error(res: &reqwest::Response) -> String {
    let retry_after = res
        .headers()
        .get("retry-after")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.trim().parse::<u64>().ok())
        .filter(|&secs| secs > 0)
        .unwrap_or(60);
    format!("RATE_LIMIT:{retry_after}")
}

async fn post_graphql<T: for<'de> Deserialize<'de>>(
    client: &reqwest::Client,
    query: &str,
    variables: serde_json::Value,
) -> Result<T, String> {
    let payload = serde_json::json!({
        "query": query,
        "variables": variables,
    });

    let res = client
        .post(ANIMETHEMES_GRAPHQL_URL)
        .header("Content-Type", "application/json")
        .body(payload.to_string())
        .send()
        .await
        .map_err(|e| format!("AnimeThemes request failed: {e}"))?;

    if res.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err(rate_limit_error(&res));
    }

    if !res.status().is_success() {
        return Err(format!("AnimeThemes returned HTTP {}", res.status()));
    }

    let text = res
        .text()
        .await
        .map_err(|e| format!("Failed to read AnimeThemes response: {e}"))?;

    let parsed: GraphQlResponse<T> = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse AnimeThemes response: {e}"))?;

    if let Some(errors) = parsed.errors {
        if let Some(first) = errors.first() {
            return Err(format!("AnimeThemes API error: {}", first.message));
        }
    }

    parsed
        .data
        .ok_or_else(|| "AnimeThemes returned empty data.".to_string())
}

fn map_raw_anime(anime: RawAnime) -> AnimeThemeAnime {
    let cover_url = anime.images.and_then(|conn| {
        conn.nodes
            .iter()
            .find(|img| img.facet.as_deref() == Some("LARGE_COVER"))
            .or_else(|| conn.nodes.first())
            .map(|img| img.link.clone())
    });

    let themes = anime
        .themes
        .unwrap_or_default()
        .into_iter()
        .filter_map(|t| {
            let entries: Vec<AnimeThemeEntry> = t
                .entries
                .unwrap_or_default()
                .into_iter()
                .filter_map(|e| {
                    let videos: Vec<AnimeThemeVideo> = e
                        .videos
                        .map(|v| v.nodes)
                        .unwrap_or_default()
                        .into_iter()
                        .map(|v| AnimeThemeVideo {
                            basename: v.basename,
                            resolution: v.resolution,
                            nc: v.nc.unwrap_or(false),
                            subbed: v.subbed.unwrap_or(false),
                            link: v.link,
                        })
                        .collect();
                    if videos.is_empty() {
                        None
                    } else {
                        Some(AnimeThemeEntry {
                            version: e.version,
                            episodes: e.episodes,
                            videos,
                        })
                    }
                })
                .collect();

            if entries.is_empty() {
                return None;
            }

            let song_title = t
                .song
                .as_ref()
                .and_then(|s| s.title.as_ref())
                .and_then(|st| st.romaji.clone())
                .filter(|s| !s.trim().is_empty());

            let mut seen_artists = HashSet::new();
            let artists: Vec<String> = t
                .song
                .as_ref()
                .and_then(|s| s.staff.as_ref())
                .into_iter()
                .flatten()
                .filter_map(|st| {
                    st.artist
                        .as_ref()
                        .and_then(|a| a.name.as_ref())
                        .and_then(|n| n.main.as_ref())
                        .map(|s| s.trim().to_string())
                })
                .filter(|name| !name.is_empty() && seen_artists.insert(name.clone()))
                .collect();

            let theme_type = t.theme_type.unwrap_or_else(|| "OP".to_string());
            let slug = t.slug.unwrap_or_else(|| {
                t.sequence
                    .map(|seq| format!("{theme_type}{seq}"))
                    .unwrap_or_else(|| theme_type.clone())
            });

            Some(AnimeThemeItem {
                theme_type,
                sequence: t.sequence,
                slug,
                song_title,
                artists,
                entries,
            })
        })
        .collect();

    let title = anime
        .title
        .romaji
        .clone()
        .or_else(|| anime.title.english.clone())
        .unwrap_or_else(|| anime.slug.clone());

    AnimeThemeAnime {
        slug: anime.slug,
        title,
        english_title: anime.title.english,
        year: anime.year,
        cover_url,
        themes,
    }
}

#[tauri::command]
pub fn set_animethemes_enabled(state: tauri::State<'_, AppState>, enabled: bool) {
    if let Ok(mut guard) = state.animethemes_enabled.lock() {
        *guard = enabled;
    }
}

#[tauri::command]
pub async fn animethemes_search(
    state: tauri::State<'_, AppState>,
    query: String,
) -> Result<Vec<AnimeThemeAnime>, String> {
    ensure_animethemes_enabled(&state)?;
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let gql = format!(
        r#"
        query ($q: String!) {{
          search(search: $q, first: 10) {{
            anime {{
              data {{
                {ANIME_FIELDS_FRAGMENT}
              }}
            }}
            songs {{
              data {{
                themes {{
                  anime {{ slug }}
                }}
              }}
            }}
            artists {{
              data {{
                songStaff {{
                  song {{
                    themes {{
                      anime {{ slug }}
                    }}
                  }}
                }}
              }}
            }}
          }}
        }}
        "#
    );

    let client = build_client(20)?;
    let data: SearchData =
        post_graphql(&client, &gql, serde_json::json!({ "q": trimmed })).await?;

    let mut results = Vec::new();
    let mut seen_slugs = HashSet::new();
    let mut extra_slugs = Vec::new();

    if let Some(buckets) = data.search {
        if let Some(anime_page) = buckets.anime {
            for raw in anime_page.data {
                if seen_slugs.insert(raw.slug.clone()) {
                    results.push(map_raw_anime(raw));
                }
            }
        }

        if let Some(song_page) = buckets.songs {
            for song in song_page.data {
                for t in song.themes.unwrap_or_default() {
                    if let Some(a) = t.anime {
                        if seen_slugs.insert(a.slug.clone()) {
                            extra_slugs.push(a.slug);
                        }
                    }
                }
            }
        }

        if let Some(artist_page) = buckets.artists {
            for artist in artist_page.data {
                for staff in artist.song_staff.unwrap_or_default() {
                    if let Some(song) = staff.song {
                        for t in song.themes.unwrap_or_default() {
                            if let Some(a) = t.anime {
                                if seen_slugs.insert(a.slug.clone()) {
                                    extra_slugs.push(a.slug);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    extra_slugs.truncate(4);
    if !extra_slugs.is_empty() {
        let mut fields = String::new();
        for (idx, slug) in extra_slugs.iter().enumerate() {
            let safe_slug = slug.replace('"', "");
            fields.push_str(&format!(
                "a{idx}: anime(slug: \"{safe_slug}\") {{ {ANIME_FIELDS_FRAGMENT} }}\n"
            ));
        }
        let batch_query = format!("query {{\n{fields}}}");
        if let Ok(mut map) = post_graphql::<std::collections::HashMap<String, Option<RawAnime>>>(
            &client,
            &batch_query,
            serde_json::json!({}),
        )
        .await
        {
            for idx in 0..extra_slugs.len() {
                if let Some(Some(raw)) = map.remove(&format!("a{idx}")) {
                    results.push(map_raw_anime(raw));
                }
            }
        }
    }

    if let Ok(cache) = state.animethemes_cover_cache.lock() {
        for anime in &mut results {
            if let Some(cached) = cache.get(&anime.slug) {
                anime.cover_url = Some(cached.clone());
            } else {
                anime.cover_url = None;
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn animethemes_download(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    url: String,
    dest_path: String,
) -> Result<String, String> {
    ensure_animethemes_enabled(&state)?;

    if !url.starts_with("https://v.animethemes.moe/") {
        return Err("Invalid AnimeThemes video URL.".to_string());
    }

    let dest = std::path::PathBuf::from(&dest_path);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create output folder: {e}"))?;
    }

    let part_path = std::path::PathBuf::from(format!("{dest_path}.part"));
    let client = build_client(300)?;

    let mut res = client
        .get(&url)
        .header("Referer", ANIMETHEMES_REFERER)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {e}"))?;

    if res.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err(rate_limit_error(&res));
    }

    if !res.status().is_success() {
        return Err(format!("Video CDN returned HTTP {}", res.status()));
    }

    let total_bytes = res.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut last_percent: u8 = 0;
    let mut last_emit = Instant::now();

    let mut file =
        fs::File::create(&part_path).map_err(|e| format!("Failed to create temp file: {e}"))?;

    let write_res: Result<(), String> = async {
        while let Some(chunk) = res
            .chunk()
            .await
            .map_err(|e| format!("Stream read error: {e}"))?
        {
            file.write_all(&chunk)
                .map_err(|e| format!("File write error: {e}"))?;
            downloaded += chunk.len() as u64;

            if total_bytes > 0 {
                let pct = ((downloaded as f64 / total_bytes as f64) * 100.0).min(100.0) as u8;
                if pct >= last_percent.saturating_add(2)
                    || last_emit.elapsed() >= Duration::from_millis(180)
                {
                    last_percent = pct;
                    last_emit = Instant::now();
                    let _ = app.emit(
                        "animethemes-download-progress",
                        DownloadProgressPayload {
                            url: url.clone(),
                            percent: pct,
                        },
                    );
                }
            }
        }
        file.flush().map_err(|e| format!("File flush error: {e}"))?;
        Ok(())
    }
    .await;

    if let Err(err) = write_res {
        drop(file);
        let _ = fs::remove_file(&part_path);
        return Err(err);
    }

    drop(file);
    fs::rename(&part_path, &dest).map_err(|e| {
        let _ = fs::remove_file(&part_path);
        format!("Failed to finalize file: {e}")
    })?;

    let _ = app.emit(
        "animethemes-download-progress",
        DownloadProgressPayload { url, percent: 100 },
    );

    Ok(dest_path)
}

#[tauri::command]
pub async fn animethemes_suggest(
    state: tauri::State<'_, AppState>,
    query: String,
) -> Result<Vec<AnimeThemeSuggestion>, String> {
    ensure_animethemes_enabled(&state)?;
    let trimmed = query.trim();
    if trimmed.len() < 2 {
        return Ok(Vec::new());
    }

    let gql = r#"
        query ($q: String!) {
          search(search: $q, first: 4) {
            anime {
              data {
                slug
                year
                title { romaji english }
              }
            }
            songs {
              data {
                themes {
                  anime {
                    slug
                    year
                    title { romaji english }
                  }
                }
              }
            }
            artists {
              data {
                songStaff {
                  song {
                    themes {
                      anime {
                        slug
                        year
                        title { romaji english }
                      }
                    }
                  }
                }
              }
            }
          }
        }
    "#;

    let client = build_client(10)?;
    let data: SearchData =
        post_graphql(&client, gql, serde_json::json!({ "q": trimmed })).await?;

    let mut suggestions = Vec::new();
    let mut seen = HashSet::new();

    let push_summary = |slug: String,
                        year: Option<u32>,
                        title: Option<RawTitle>,
                        seen: &mut HashSet<String>,
                        out: &mut Vec<AnimeThemeSuggestion>| {
        if !seen.insert(slug.clone()) {
            return;
        }
        let romaji = title.as_ref().and_then(|t| t.romaji.clone());
        let english = title.and_then(|t| t.english);
        let display = romaji.or_else(|| english.clone()).unwrap_or_else(|| slug.clone());
        out.push(AnimeThemeSuggestion {
            slug,
            title: display,
            english_title: english,
            year,
        });
    };

    if let Some(buckets) = data.search {
        if let Some(anime_page) = buckets.anime {
            for raw in anime_page.data {
                push_summary(raw.slug, raw.year, Some(raw.title), &mut seen, &mut suggestions);
            }
        }
        if let Some(song_page) = buckets.songs {
            for song in song_page.data {
                for t in song.themes.unwrap_or_default() {
                    if let Some(a) = t.anime {
                        push_summary(a.slug, a.year, a.title, &mut seen, &mut suggestions);
                    }
                }
            }
        }
        if let Some(artist_page) = buckets.artists {
            for artist in artist_page.data {
                for staff in artist.song_staff.unwrap_or_default() {
                    if let Some(song) = staff.song {
                        for t in song.themes.unwrap_or_default() {
                            if let Some(a) = t.anime {
                                push_summary(a.slug, a.year, a.title, &mut seen, &mut suggestions);
                            }
                        }
                    }
                }
            }
        }
    }

    suggestions.truncate(6);
    Ok(suggestions)
}
