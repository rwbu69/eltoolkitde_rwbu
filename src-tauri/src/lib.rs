use std::fs;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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
                    if (file_name.starts_with("ffmpeg-") || file_name == "ffmpeg") && !file_name.ends_with(".exe") {
                        ffmpeg_path = Some(entry.path());
                    } else if (file_name.starts_with("ffprobe-") || file_name == "ffprobe") && !file_name.ends_with(".exe") {
                        ffprobe_path = Some(entry.path());
                    } else if (file_name.starts_with("node-") || file_name == "node") && !file_name.ends_with(".exe") {
                        node_path = Some(entry.path());
                    }
                } else {
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
    }

    if let Some(ffmpeg) = ffmpeg_path {
        let dest = temp_dir.join(if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" });
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
        let dest = temp_dir.join(if cfg!(windows) { "ffprobe.exe" } else { "ffprobe" });
        if !dest.exists() {
            let _ = fs::hard_link(&ffprobe, &dest).or_else(|_| fs::copy(&ffprobe, &dest).map(|_| ()));
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
