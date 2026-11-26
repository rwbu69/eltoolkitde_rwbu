use std::fs;
use std::process::Command as ProcessCommand;
use tauri::Manager;

#[tauri::command]
pub async fn update_ytdlp(app: tauri::AppHandle) -> Result<String, String> {
    tokio::task::spawn_blocking(move || update_ytdlp_blocking(app))
        .await
        .map_err(|e| format!("Task join error: {e}"))?
}

fn update_ytdlp_blocking(app: tauri::AppHandle) -> Result<String, String> {
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
