use scraper::{Html, Selector};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::process::Command as ProcessCommand;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_notification::NotificationExt;

struct AppState {
    close_to_tray: Mutex<bool>,
    canceled_khinsider_downloads: Mutex<HashSet<String>>,
    khinsider_request_gate: tokio::sync::Mutex<Option<Instant>>,
    khinsider_html_cache: Mutex<HashMap<String, CachedKhinsiderHtml>>,
    khinsider_enabled: Mutex<bool>,
    khinsider_download_slots: Arc<tokio::sync::Semaphore>,
}

const KHINSIDER_BASE_URL: &str = "https://downloads.khinsider.com";
const KHINSIDER_REQUEST_INTERVAL: Duration = Duration::from_millis(900);
const KHINSIDER_CACHE_TTL: Duration = Duration::from_secs(300);
const KHINSIDER_CACHE_MAX_ENTRIES: usize = 100;

struct CachedKhinsiderHtml {
    fetched_at: Instant,
    html: String,
}

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
struct KhinsiderCategory {
    name: String,
    url: String,
}

#[derive(Debug, Serialize)]
struct KhinsiderAlbum {
    title: String,
    url: String,
    cover_url: Option<String>,
}

#[derive(Debug, Serialize)]
struct KhinsiderTrack {
    title: String,
    source_url: String,
    mp3_url: Option<String>,
    flac_url: Option<String>,
}

#[derive(Debug, Serialize)]
struct KhinsiderAudioLinks {
    mp3_url: Option<String>,
    flac_url: Option<String>,
}

#[derive(Debug, Serialize)]
struct KhinsiderPage {
    title: String,
    categories: Vec<KhinsiderCategory>,
    albums: Vec<KhinsiderAlbum>,
    tracks: Vec<KhinsiderTrack>,
    cover_url: Option<String>,
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
async fn fetch_khinsider_page(
    state: tauri::State<'_, AppState>,
    url: String,
) -> Result<KhinsiderPage, String> {
    ensure_khinsider_enabled(&state)?;
    let html = fetch_khinsider_html(&state, &url).await?;
    Ok(parse_khinsider_html(&html, &url))
}

#[tauri::command]
async fn resolve_khinsider_track(
    state: tauri::State<'_, AppState>,
    url: String,
) -> Result<KhinsiderAudioLinks, String> {
    ensure_khinsider_enabled(&state)?;
    let html = fetch_khinsider_html(&state, &url).await?;
    Ok(parse_audio_links(&html))
}

#[tauri::command]
async fn download_khinsider_file(
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
fn set_khinsider_enabled(state: tauri::State<'_, AppState>, enabled: bool) -> Result<(), String> {
    let mut is_enabled = state
        .khinsider_enabled
        .lock()
        .map_err(|_| "Khinsider state is unavailable.".to_string())?;
    *is_enabled = enabled;
    Ok(())
}

#[tauri::command]
fn clear_khinsider_cache(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state
        .khinsider_html_cache
        .lock()
        .map_err(|_| "Khinsider cache is unavailable.".to_string())?
        .clear();
    Ok(())
}

#[tauri::command]
fn cancel_khinsider_download(state: tauri::State<'_, AppState>, download_id: String) {
    if let Ok(mut canceled) = state.canceled_khinsider_downloads.lock() {
        canceled.insert(download_id);
    }
}

#[tauri::command]
fn set_close_behavior(state: tauri::State<'_, AppState>, close_to_tray: bool) {
    if let Ok(mut c) = state.close_to_tray.lock() {
        *c = close_to_tray;
    }
}

#[tauri::command]
fn safe_rename(old_path: String, new_path: String) -> Result<(), String> {
    let old = std::path::Path::new(&old_path);
    let new = std::path::Path::new(&new_path);
    if !old.is_file() {
        return Err("The source file does not exist.".to_string());
    }
    if new.exists() {
        return Err("The destination file already exists.".to_string());
    }

    let old_parent = old
        .parent()
        .ok_or_else(|| "The source path has no parent.".to_string())?;
    let new_parent = new
        .parent()
        .ok_or_else(|| "The destination path has no parent.".to_string())?;
    let old_parent = old_parent.canonicalize().map_err(|e| e.to_string())?;
    let new_parent = new_parent.canonicalize().map_err(|e| e.to_string())?;
    if old_parent != new_parent {
        return Err("Renaming across directories is not allowed.".to_string());
    }

    std::fs::rename(old, new).map_err(|e| e.to_string())
}

#[tauri::command]
async fn close_splashscreen(window: tauri::Window) {
    if let Some(splashscreen) = window.app_handle().get_webview_window("splashscreen") {
        let _ = splashscreen.close();
    }
    if let Some(main_window) = window.app_handle().get_webview_window("main") {
        let _ = main_window.show();
        let _ = main_window.set_focus();
    }
}

#[tauri::command]
fn setup_ffmpeg_location(app: tauri::AppHandle) -> Result<String, String> {
    let mut search_dirs = vec![];

    // 1. Utama: Gunakan Tauri Resource Directory (Sangat akurat di macOS .app dan Linux AppImage)
    if let Ok(resource_dir) = app.path().resource_dir() {
        search_dirs.push(resource_dir);
    }

    // 2. Cadangan: Gunakan path executable
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            search_dirs.push(parent.to_path_buf());

            // Khusus macOS fallback
            if cfg!(target_os = "macos") {
                if let Some(contents) = parent.parent() {
                    search_dirs.push(contents.join("Resources"));
                    search_dirs.push(contents.join("MacOS"));
                }
            }
        }
    }

    let temp_dir = std::env::temp_dir().join("eltoolkit_ffmpeg");
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let mut ffmpeg_path = None;
    let mut ffprobe_path = None;
    let mut node_path = None;

    for dir in search_dirs {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let file_name = entry.file_name().to_string_lossy().to_string();

                if !cfg!(windows) {
                    if (file_name.starts_with("ffmpeg-") || file_name == "ffmpeg")
                        && !file_name.ends_with(".exe")
                    {
                        ffmpeg_path = Some(entry.path());
                    } else if (file_name.starts_with("ffprobe-") || file_name == "ffprobe")
                        && !file_name.ends_with(".exe")
                    {
                        ffprobe_path = Some(entry.path());
                    } else if (file_name.starts_with("node-") || file_name == "node")
                        && !file_name.ends_with(".exe")
                    {
                        node_path = Some(entry.path());
                    }
                } else {
                    if file_name.starts_with("ffmpeg.exe")
                        || (file_name.starts_with("ffmpeg-") && file_name.ends_with(".exe"))
                    {
                        ffmpeg_path = Some(entry.path());
                    }
                    if file_name.starts_with("ffprobe.exe")
                        || (file_name.starts_with("ffprobe-") && file_name.ends_with(".exe"))
                    {
                        ffprobe_path = Some(entry.path());
                    }
                    if file_name.starts_with("node.exe")
                        || (file_name.starts_with("node-") && file_name.ends_with(".exe"))
                    {
                        node_path = Some(entry.path());
                    }
                }
            }
        }
    }

    if let Some(ffmpeg) = ffmpeg_path {
        let dest = temp_dir.join(if cfg!(windows) {
            "ffmpeg.exe"
        } else {
            "ffmpeg"
        });
        if !dest.exists() {
            let _ = fs::hard_link(&ffmpeg, &dest).or_else(|_| fs::copy(&ffmpeg, &dest).map(|_| ()));
        }
        // Pastikan izin eksekusi di unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(mut perms) = fs::metadata(&dest).map(|m| m.permissions()) {
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&dest, perms);
            }
        }
    }

    if let Some(ffprobe) = ffprobe_path {
        let dest = temp_dir.join(if cfg!(windows) {
            "ffprobe.exe"
        } else {
            "ffprobe"
        });
        if !dest.exists() {
            let _ =
                fs::hard_link(&ffprobe, &dest).or_else(|_| fs::copy(&ffprobe, &dest).map(|_| ()));
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(mut perms) = fs::metadata(&dest).map(|m| m.permissions()) {
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&dest, perms);
            }
        }
    }

    if let Some(node) = node_path {
        let dest = temp_dir.join(if cfg!(windows) { "node.exe" } else { "node" });
        if !dest.exists() {
            let _ = fs::hard_link(&node, &dest).or_else(|_| fs::copy(&node, &dest).map(|_| ()));
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(mut perms) = fs::metadata(&dest).map(|m| m.permissions()) {
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&dest, perms);
            }
        }
    }

    Ok(temp_dir.to_string_lossy().into_owned())
}

#[tauri::command]
fn update_ytdlp(app: tauri::AppHandle) -> Result<String, String> {
    let mut search_dirs = vec![];
    if let Ok(resource_dir) = app.path().resource_dir() {
        search_dirs.push(resource_dir);
    }
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            search_dirs.push(parent.to_path_buf());
        }
    }

    let binary_name = if cfg!(windows) {
        "yt-dlp.exe"
    } else {
        "yt-dlp"
    };
    let binary_path = search_dirs
        .into_iter()
        .map(|dir| dir.join(binary_name))
        .find(|path| path.is_file())
        .ok_or_else(|| format!("Could not find {binary_name}."))?;
    let temp_path = binary_path.with_extension(if cfg!(windows) {
        "exe.download"
    } else {
        "download"
    });
    let backup_path = binary_path.with_extension(if cfg!(windows) {
        "exe.backup"
    } else {
        "backup"
    });
    let url = if cfg!(windows) {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    } else if cfg!(target_os = "macos") {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
    } else {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
    };

    let _ = fs::remove_file(&temp_path);
    let download = ProcessCommand::new(if cfg!(windows) { "curl.exe" } else { "curl" })
        .args(["--fail", "--location", "--retry", "3", "--output"])
        .arg(&temp_path)
        .arg(url)
        .status()
        .map_err(|e| format!("Failed to start downloader: {e}"))?;
    if !download.success() {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("yt-dlp download failed with status {download}"));
    }

    let version = ProcessCommand::new(&temp_path)
        .arg("--version")
        .output()
        .map_err(|e| format!("Downloaded yt-dlp could not be started: {e}"))?;
    if !version.status.success() {
        let _ = fs::remove_file(&temp_path);
        return Err("Downloaded yt-dlp failed executable validation.".to_string());
    }

    let _ = fs::remove_file(&backup_path);
    fs::rename(&binary_path, &backup_path).map_err(|e| format!("Could not back up yt-dlp: {e}"))?;
    if let Err(error) = fs::rename(&temp_path, &binary_path) {
        let _ = fs::rename(&backup_path, &binary_path);
        return Err(format!("Could not install updated yt-dlp: {error}"));
    }
    let _ = fs::remove_file(&backup_path);
    Ok(String::from_utf8_lossy(&version.stdout).trim().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(AppState {
                close_to_tray: Mutex::new(true),
                canceled_khinsider_downloads: Mutex::new(HashSet::new()),
                khinsider_request_gate: tokio::sync::Mutex::new(None),
                khinsider_html_cache: Mutex::new(HashMap::new()),
                khinsider_enabled: Mutex::new(false),
                khinsider_download_slots: Arc::new(tokio::sync::Semaphore::new(2)),
            });

            let quit_i = MenuItem::with_id(app, "quit", "Keluar", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Tampilkan", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let close_to_tray = {
                        let state = window.app_handle().state::<AppState>();
                        let val = *state.close_to_tray.lock().unwrap();
                        val
                    };

                    if close_to_tray {
                        window.hide().unwrap();
                        api.prevent_close();

                        let _ = window
                            .app_handle()
                            .notification()
                            .builder()
                            .title("ElToolkit is hidden")
                            .body("App is currently running in the background.")
                            .show();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            setup_ffmpeg_location,
            update_ytdlp,
            close_splashscreen,
            safe_rename,
            set_close_behavior,
            fetch_khinsider_page,
            resolve_khinsider_track,
            download_khinsider_file,
            set_khinsider_enabled,
            clear_khinsider_cache,
            cancel_khinsider_download
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
