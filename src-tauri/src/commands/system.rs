use std::fs;
use tauri::Manager;
use crate::state::AppState;

#[tauri::command]
pub fn set_close_behavior(state: tauri::State<'_, AppState>, close_to_tray: bool) {
    if let Ok(mut c) = state.close_to_tray.lock() {
        *c = close_to_tray;
    }
}

#[tauri::command]
pub fn safe_rename(old_path: String, new_path: String) -> Result<(), String> {
    let old = std::path::Path::new(&old_path);
    let new = std::path::Path::new(&new_path);
    if !old.is_file() {
        return Err("The source file does not exist.".to_string());
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

    let is_case_only_rename = old
        .file_name()
        .and_then(|a| new.file_name().map(|b| a.to_string_lossy().eq_ignore_ascii_case(&b.to_string_lossy())))
        .unwrap_or(false);

    if new.exists() && !is_case_only_rename {
        return Err("The destination file already exists.".to_string());
    }

    std::fs::rename(old, new).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_splashscreen(window: tauri::Window) {
    if let Some(splashscreen) = window.app_handle().get_webview_window("splashscreen") {
        let _ = splashscreen.close();
    }
    if let Some(main_window) = window.app_handle().get_webview_window("main") {
        let _ = main_window.show();
        let _ = main_window.set_focus();
    }
}

#[tauri::command]
pub fn setup_ffmpeg_location(app: tauri::AppHandle) -> Result<String, String> {
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
    let mut qjs_path = None;

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
                    } else if (file_name.starts_with("qjs-") || file_name == "qjs")
                        && !file_name.ends_with(".exe")
                    {
                        qjs_path = Some(entry.path());
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
                    if file_name.starts_with("qjs.exe")
                        || (file_name.starts_with("qjs-") && file_name.ends_with(".exe"))
                    {
                        qjs_path = Some(entry.path());
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

    if let Some(qjs) = qjs_path {
        let dest = temp_dir.join(if cfg!(windows) { "qjs.exe" } else { "qjs" });
        if !dest.exists() {
            let _ = fs::hard_link(&qjs, &dest).or_else(|_| fs::copy(&qjs, &dest).map(|_| ()));
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
