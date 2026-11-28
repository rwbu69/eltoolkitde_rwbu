use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::Instant;

pub struct CachedKhinsiderHtml {
    pub fetched_at: Instant,
    pub html: String,
}

pub struct AppState {
    pub close_to_tray: Mutex<bool>,
    pub canceled_khinsider_downloads: Mutex<HashSet<String>>,
    pub khinsider_request_gate: tokio::sync::Mutex<Option<Instant>>,
    pub khinsider_html_cache: Mutex<HashMap<String, CachedKhinsiderHtml>>,
    pub khinsider_enabled: Mutex<bool>,
    pub khinsider_download_slots: Arc<tokio::sync::Semaphore>,
    pub animethemes_enabled: Mutex<bool>,
    pub animethemes_cover_cache: Mutex<HashMap<String, String>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            close_to_tray: Mutex::new(true),
            canceled_khinsider_downloads: Mutex::new(HashSet::new()),
            khinsider_request_gate: tokio::sync::Mutex::new(None),
            khinsider_html_cache: Mutex::new(HashMap::new()),
            khinsider_enabled: Mutex::new(false),
            khinsider_download_slots: Arc::new(tokio::sync::Semaphore::new(2)),
            animethemes_enabled: Mutex::new(false),
            animethemes_cover_cache: Mutex::new(HashMap::new()),
        }
    }
}
