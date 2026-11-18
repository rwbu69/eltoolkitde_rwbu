use crate::state::{AppState, CachedKhinsiderHtml};
use scraper::{Html, Selector};
use serde::Serialize;
use std::fs;
use std::io::Write;
use std::time::{Duration, Instant};
use tauri::Emitter;

const KHINSIDER_BASE_URL: &str = "https://downloads.khinsider.com";
const KHINSIDER_REQUEST_INTERVAL: Duration = Duration::from_millis(900);
const KHINSIDER_CACHE_TTL: Duration = Duration::from_secs(300);
const KHINSIDER_CACHE_MAX_ENTRIES: usize = 100;

fn ensure_khinsider_enabled(state: &AppState) -> Result<(), String> {
    state
        .khinsider_enabled
        .lock()
        .map(|enabled| {
            if *enabled {
                Ok(())
            } else {
                Err("Khinsider is disabled. Enable it in Settings first.".to_string())
            }
        })
        .unwrap_or_else(|_| Err("Khinsider state is unavailable.".to_string()))
}

#[derive(Debug, Serialize)]
pub struct KhinsiderCategory {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Serialize)]
pub struct KhinsiderAlbum {
    pub title: String,
    pub url: String,
    pub cover_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct KhinsiderTrack {
    pub title: String,
    pub source_url: String,
    pub mp3_url: Option<String>,
    pub flac_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct KhinsiderAudioLinks {
    pub mp3_url: Option<String>,
    pub flac_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct KhinsiderPage {
    pub title: String,
    pub categories: Vec<KhinsiderCategory>,
    pub albums: Vec<KhinsiderAlbum>,
    pub tracks: Vec<KhinsiderTrack>,
    pub cover_url: Option<String>,
}

fn normalize_cover_url(raw: &str) -> Option<String> {
    let value = raw.trim();
    if value.is_empty() || value.starts_with("data:") || value.contains("placeholder") {
        return None;
    }
    let decoded = value.replace("%2520", "%20");
    let normalized = if decoded.starts_with("//") {
        format!("https:{decoded}")
    } else if decoded.starts_with('/') {
        format!("https://vgmtreasurechest.com{decoded}")
    } else if decoded.starts_with("http://") {
        decoded.replacen("http://", "https://", 1)
    } else if decoded.starts_with("https://") {
        decoded
    } else {
        return None;
    };
    if !normalized.contains("vgmtreasurechest.com/soundtracks/") {
        return None;
    }
    Some(normalized)
}

fn absolute_khinsider_url(href: &str) -> Option<String> {
    if href.starts_with("https://") {
        Some(href.to_string())
    } else if href.starts_with('/') {
        Some(format!("{KHINSIDER_BASE_URL}{href}"))
    } else {
        None
    }
}

fn image_source(image: scraper::ElementRef<'_>) -> Option<String> {
    ["data-src", "data-original", "data-lazy-src", "src"]
        .iter()
        .find_map(|attribute| image.value().attr(attribute))
        .and_then(normalize_cover_url)
}

fn cover_from_ancestors(
    element: scraper::ElementRef<'_>,
    image_selector: &Selector,
) -> Option<String> {
    let mut current = element.parent();
    for _ in 0..5 {
        let parent = current.and_then(scraper::ElementRef::wrap)?;
        if let Some(image) = parent.select(image_selector).find_map(image_source) {
            return Some(image);
        }
        current = parent.parent();
    }
    None
}

fn text_content(element: scraper::ElementRef<'_>) -> String {
    element
        .text()
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_audio_url(href: &str) -> bool {
    let path = href.split('?').next().unwrap_or(href).to_lowercase();
    path.ends_with(".mp3") || path.ends_with(".flac")
}

fn audio_title(href: &str, fallback: String) -> String {
    if !fallback.is_empty() {
        return fallback;
    }

    href.rsplit('/')
        .next()
        .unwrap_or("Untitled track")
        .replace("%20", " ")
}

fn set_audio_url(links: &mut KhinsiderAudioLinks, url: String) {
    let path = url.split('?').next().unwrap_or(&url).to_lowercase();
    if path.ends_with(".flac") {
        links.flac_url = Some(url);
    } else if path.ends_with(".mp3") {
        links.mp3_url = Some(url);
    }
}

fn is_allowed_audio_host(url: &str) -> bool {
    let Some(host) = url
        .strip_prefix("https://")
        .and_then(|value| value.split('/').next())
    else {
        return false;
    };
    host == "vgmtreasurechest.com" || host.ends_with(".vgmtreasurechest.com")
}

fn safe_file_name(file_name: &str) -> String {
    let sanitized = file_name
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            character if character.is_control() => '_',
            character => character,
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string();
    if sanitized.is_empty() {
        "untitled-track".to_string()
    } else {
        sanitized
    }
}

fn parse_khinsider_html(html: &str, page_url: &str) -> KhinsiderPage {
    let document = Html::parse_document(html);
    let title_selector = Selector::parse("title").expect("valid selector");
    let link_selector = Selector::parse("a[href]").expect("valid selector");
    let image_selector = Selector::parse("img[src], img[data-src]").expect("valid selector");
    let title = document
        .select(&title_selector)
        .next()
        .map(text_content)
        .unwrap_or_else(|| page_url.to_string());
    let mut categories = Vec::new();
    let mut albums = Vec::new();
    let mut tracks = Vec::new();
    let mut seen_categories = std::collections::HashSet::new();
    let mut seen_albums = std::collections::HashSet::new();
    let mut seen_tracks = std::collections::HashSet::new();

    for link in document.select(&link_selector) {
        let Some(href) = link.value().attr("href") else {
            continue;
        };
        let Some(url) = absolute_khinsider_url(href) else {
            continue;
        };
        let label = text_content(link);

        if is_audio_url(href) {
            if seen_tracks.insert(url.clone()) {
                tracks.push(KhinsiderTrack {
                    title: audio_title(href, label),
                    source_url: url.clone(),
                    mp3_url: (!url.starts_with(KHINSIDER_BASE_URL)
                        && !url.to_lowercase().ends_with(".flac"))
                    .then_some(url.clone()),
                    flac_url: (!url.starts_with(KHINSIDER_BASE_URL)
                        && url.to_lowercase().ends_with(".flac"))
                    .then_some(url),
                });
            }
        } else if href.contains("/game-soundtracks/album/") {
            if label.is_empty() {
                continue;
            }
            if is_audio_url(href) {
                if seen_tracks.insert(url.clone()) {
                    tracks.push(KhinsiderTrack {
                        title: audio_title(href, label),
                        source_url: url,
                        mp3_url: None,
                        flac_url: None,
                    });
                }
            } else if seen_albums.insert(url.clone()) {
                let cover_url = link
                    .select(&image_selector)
                    .find_map(image_source)
                    .or_else(|| cover_from_ancestors(link, &image_selector));
                albums.push(KhinsiderAlbum {
                    title: label,
                    url: url.clone(),
                    cover_url,
                });
            }
        } else if href.contains("/game-soundtracks/") && !href.contains("/album/") {
            if label.is_empty() {
                continue;
            }
            if seen_categories.insert(url.clone()) {
                categories.push(KhinsiderCategory { name: label, url });
            }
        }
    }

    if !albums.is_empty() {
        for album in &mut albums {
            if album.cover_url.is_some() {
                continue;
            }
            album.cover_url = document.select(&image_selector).find_map(|image| {
                let src = image_source(image)?;
                let alt = image.value().attr("alt").unwrap_or_default().to_lowercase();
                if alt.contains(&album.title.to_lowercase()) {
                    Some(src)
                } else {
                    None
                }
            });
        }
    }

    let cover_url = if page_url.contains("/album/") {
        document.select(&image_selector).find_map(image_source)
    } else {
        None
    };

    KhinsiderPage {
        title,
        categories,
        albums,
        tracks,
        cover_url,
    }
}

async fn wait_for_khinsider_request_slot(state: &AppState) {
    let mut last_request = state.khinsider_request_gate.lock().await;
    if let Some(previous) = *last_request {
        let elapsed = previous.elapsed();
        if elapsed < KHINSIDER_REQUEST_INTERVAL {
            tokio::time::sleep(KHINSIDER_REQUEST_INTERVAL - elapsed).await;
        }
    }
    *last_request = Some(Instant::now());
}

fn retry_after_duration(response: &reqwest::Response) -> Option<Duration> {
    response
        .headers()
        .get("retry-after")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
        .map(Duration::from_secs)
}

async fn fetch_khinsider_html(state: &AppState, url: &str) -> Result<String, String> {
    if !url.starts_with(KHINSIDER_BASE_URL) {
        return Err("Only downloads.khinsider.com pages are supported.".to_string());
    }
    if let Ok(cache) = state.khinsider_html_cache.lock() {
        if let Some(entry) = cache.get(url) {
            if entry.fetched_at.elapsed() < KHINSIDER_CACHE_TTL {
                return Ok(entry.html.clone());
            }
        }
    }
    let client = reqwest::Client::builder()
        .user_agent("ElToolkitDeRWBU/0.1 (+https://github.com/rwbu69/eltoolkitde_rwbu)")
        .build()
        .map_err(|error| format!("Could not create Khinsider client: {error}"))?;
    for attempt in 0..3 {
        wait_for_khinsider_request_slot(state).await;
        let response = client
            .get(url)
            .header("Accept", "text/html,application/xhtml+xml")
            .header("Accept-Language", "en-US,en;q=0.9")
            .header("Referer", KHINSIDER_BASE_URL)
            .send()
            .await
            .map_err(|error| format!("Khinsider request failed: {error}"))?;
        let status = response.status();
        if status.is_success() {
            let html = response
                .text()
                .await
                .map_err(|error| format!("Could not read Khinsider response: {error}"))?;
            if let Ok(mut cache) = state.khinsider_html_cache.lock() {
                cache.insert(
                    url.to_string(),
                    CachedKhinsiderHtml {
                        fetched_at: Instant::now(),
                        html: html.clone(),
                    },
                );
                while cache.len() > KHINSIDER_CACHE_MAX_ENTRIES {
                    if let Some(oldest_url) = cache
                        .iter()
                        .min_by_key(|(_, entry)| entry.fetched_at)
                        .map(|(url, _)| url.clone())
                    {
                        cache.remove(&oldest_url);
                    } else {
                        break;
                    }
                }
            }
            return Ok(html);
        }
        if !matches!(status.as_u16(), 403 | 429 | 500..=599) || attempt == 2 {
            return Err(format!(
                "Khinsider returned HTTP {status}. The site may be rate-limiting or blocking automated requests."
            ));
        }
        let backoff = Duration::from_secs(2u64.pow(attempt + 1));
        tokio::time::sleep(retry_after_duration(&response).unwrap_or(backoff)).await;
    }
    Err("Khinsider request could not be completed.".to_string())
}

fn parse_audio_links(html: &str) -> KhinsiderAudioLinks {
    let document = Html::parse_document(html);
    let selector = Selector::parse("a[href]").expect("valid selector");
    let mut links = KhinsiderAudioLinks {
        mp3_url: None,
        flac_url: None,
    };
    for link in document.select(&selector) {
        let Some(href) = link.value().attr("href") else {
            continue;
        };
        if is_audio_url(href) && !href.starts_with(KHINSIDER_BASE_URL) {
            if let Some(url) = absolute_khinsider_url(href) {
                set_audio_url(&mut links, url);
            }
        }
    }
    links
}

#[tauri::command]
pub async fn fetch_khinsider_page(
    state: tauri::State<'_, AppState>,
    url: String,
) -> Result<KhinsiderPage, String> {
    ensure_khinsider_enabled(&state)?;
    let html = fetch_khinsider_html(&state, &url).await?;
    Ok(parse_khinsider_html(&html, &url))
}

#[tauri::command]
pub async fn resolve_khinsider_track(
    state: tauri::State<'_, AppState>,
    url: String,
) -> Result<KhinsiderAudioLinks, String> {
    ensure_khinsider_enabled(&state)?;
    let html = fetch_khinsider_html(&state, &url).await?;
    Ok(parse_audio_links(&html))
}

#[tauri::command]
pub async fn download_khinsider_file(
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
    url: String,
    output_dir: String,
    file_name: String,
    download_id: String,
    subfolder: Option<String>,
) -> Result<String, String> {
    ensure_khinsider_enabled(&state)?;
    if !is_allowed_audio_host(&url) || !is_audio_url(&url) {
        return Err("Only MP3 or FLAC files from vgmtreasurechest.com are supported.".to_string());
    }

    let base_directory = std::path::Path::new(&output_dir);
    let directory = subfolder
        .filter(|value| !value.trim().is_empty())
        .map(|value| base_directory.join(safe_file_name(&value)))
        .unwrap_or_else(|| base_directory.to_path_buf());
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create output folder: {error}"))?;
    let target = directory.join(safe_file_name(&file_name));
    if target.exists() {
        return Err("A file with this name already exists.".to_string());
    }

    let _download_slot = state
        .khinsider_download_slots
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| "Khinsider download queue is unavailable.".to_string())?;
    let client = reqwest::Client::builder()
        .user_agent("ElToolkitDeRWBU/0.1 (+https://github.com/rwbu69/eltoolkitde_rwbu)")
        .build()
        .map_err(|error| format!("Could not create download client: {error}"))?;
    let mut response = 'download: loop {
        for attempt in 0..3 {
            wait_for_khinsider_request_slot(&state).await;
            let response = client
                .get(&url)
                .header("Accept", "audio/mpeg,audio/flac,*/*;q=0.8")
                .send()
                .await
                .map_err(|error| format!("Download request failed: {error}"))?;
            if response.status().is_success() {
                break 'download response;
            }
            let status = response.status();
            if !matches!(status.as_u16(), 429 | 500..=599) {
                return Err(format!("Audio server returned HTTP {status}."));
            }
            if attempt == 2 {
                return Err(format!(
                    "Audio server returned HTTP {status} after retries."
                ));
            }
            let delay = retry_after_duration(&response)
                .unwrap_or_else(|| Duration::from_secs(2u64.pow(attempt + 1)));
            tokio::time::sleep(delay).await;
        }
        return Err("Audio server request could not be completed.".to_string());
    };
    let total_bytes = response.content_length();
    let mut downloaded_bytes = 0u64;
    let mut file = fs::File::create(&target)
        .map_err(|error| format!("Could not create output file: {error}"))?;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("Download stream failed: {error}"))?
    {
        if state
            .canceled_khinsider_downloads
            .lock()
            .map(|mut canceled| canceled.remove(&download_id))
            .unwrap_or(false)
        {
            let _ = fs::remove_file(&target);
            return Err("Download canceled.".to_string());
        }
        file.write_all(&chunk)
            .map_err(|error| format!("Could not write output file: {error}"))?;
        downloaded_bytes += chunk.len() as u64;
        let percent = total_bytes
            .filter(|total| *total > 0)
            .map(|total| (downloaded_bytes as f64 / total as f64 * 100.0).round() as u8);
        let _ = app.emit(
            "khinsider-download-progress",
            serde_json::json!({
                "id": download_id,
                "percent": percent,
                "downloadedBytes": downloaded_bytes,
                "totalBytes": total_bytes
            }),
        );
    }

    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn set_khinsider_enabled(state: tauri::State<'_, AppState>, enabled: bool) -> Result<(), String> {
    let mut is_enabled = state
        .khinsider_enabled
        .lock()
        .map_err(|_| "Khinsider state is unavailable.".to_string())?;
    *is_enabled = enabled;
    Ok(())
}

#[tauri::command]
pub fn clear_khinsider_cache(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state
        .khinsider_html_cache
        .lock()
        .map_err(|_| "Khinsider cache is unavailable.".to_string())?
        .clear();
    Ok(())
}

#[tauri::command]
pub fn cancel_khinsider_download(state: tauri::State<'_, AppState>, download_id: String) {
    if let Ok(mut canceled) = state.canceled_khinsider_downloads.lock() {
        canceled.insert(download_id);
    }
}
