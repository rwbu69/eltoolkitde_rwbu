use std::fs;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn setup_ffmpeg_location() -> Result<String, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let sidecar_dir = exe_path.parent().unwrap();
    
    let temp_dir = std::env::temp_dir().join("eltoolkit_ffmpeg");
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let mut ffmpeg_path = None;
    let mut ffprobe_path = None;
    let mut node_path = None;

    if let Ok(entries) = fs::read_dir(sidecar_dir) {
        for entry in entries.flatten() {
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name.starts_with("ffmpeg-") && !file_name.ends_with(".exe") && !cfg!(windows) {
                ffmpeg_path = Some(entry.path());
            } else if file_name.starts_with("ffprobe-") && !file_name.ends_with(".exe") && !cfg!(windows) {
                ffprobe_path = Some(entry.path());
            } else if file_name.starts_with("node-") && !file_name.ends_with(".exe") && !cfg!(windows) {
                node_path = Some(entry.path());
            } else if cfg!(windows) {
                if file_name.starts_with("ffmpeg.exe") || (file_name.starts_with("ffmpeg-") && file_name.ends_with(".exe")) {
                    ffmpeg_path = Some(entry.path());
                }
                if file_name.starts_with("ffprobe.exe") || (file_name.starts_with("ffprobe-") && file_name.ends_with(".exe")) {
                    ffprobe_path = Some(entry.path());
                }
                if file_name.starts_with("node.exe") || (file_name.starts_with("node-") && file_name.ends_with(".exe")) {
                    node_path = Some(entry.path());
                }
            }
        }
    }

    if let Some(ffmpeg) = ffmpeg_path {
        let dest = temp_dir.join(if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" });
        if !dest.exists() {
            let _ = fs::hard_link(&ffmpeg, &dest).or_else(|_| fs::copy(&ffmpeg, &dest).map(|_| ()));
        }
    }

    if let Some(ffprobe) = ffprobe_path {
        let dest = temp_dir.join(if cfg!(windows) { "ffprobe.exe" } else { "ffprobe" });
        if !dest.exists() {
            let _ = fs::hard_link(&ffprobe, &dest).or_else(|_| fs::copy(&ffprobe, &dest).map(|_| ()));
        }
    }

    if let Some(node) = node_path {
        let dest = temp_dir.join(if cfg!(windows) { "node.exe" } else { "node" });
        if !dest.exists() {
            let _ = fs::hard_link(&node, &dest).or_else(|_| fs::copy(&node, &dest).map(|_| ()));
        }
    }

    Ok(temp_dir.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, setup_ffmpeg_location])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
