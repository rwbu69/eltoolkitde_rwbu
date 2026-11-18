mod commands;
mod state;

use state::AppState;
use tauri::{Manager, WindowEvent};
use tauri_plugin_notification::NotificationExt;

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .setup(|app| {
            app.manage(AppState::default());

            #[cfg(desktop)]
            {
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
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(desktop)]
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
            commands::system::setup_ffmpeg_location,
            commands::updater::update_ytdlp,
            commands::system::close_splashscreen,
            commands::system::safe_rename,
            commands::system::set_close_behavior,
            commands::khinsider::fetch_khinsider_page,
            commands::khinsider::resolve_khinsider_track,
            commands::khinsider::download_khinsider_file,
            commands::khinsider::set_khinsider_enabled,
            commands::khinsider::clear_khinsider_cache,
            commands::khinsider::cancel_khinsider_download,
            commands::audio::read_audio_tags,
            commands::audio::write_audio_tags,
            commands::audio::detect_audio_bpm,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
