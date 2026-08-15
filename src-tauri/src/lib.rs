use std::sync::Mutex;
use tauri::Manager;

struct AppState {
    close_to_tray: Mutex<bool>,
}

#[tauri::command]
fn set_close_to_tray(enabled: bool, state: tauri::State<'_, AppState>) {
    let mut close_to_tray = state.close_to_tray.lock().unwrap();
    *close_to_tray = enabled;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = rustls::crypto::ring::default_provider().install_default();

    let mut builder = tauri::Builder::default()
        .manage(AppState {
            close_to_tray: Mutex::new(true),
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![set_close_to_tray]);

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        )).plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());
    }

    #[cfg(mobile)]
    {
        // FCM device tokens for push delivery (Phase 4) — mobile-only per
        // the plugin's own docs; Android auto-registers on init, no
        // action needed here beyond registering the plugin itself. The
        // actual permission request + getToken() call happens from the
        // Angular side (FcmTokenService).
        builder = builder.plugin(tauri_plugin_fcm::init());
    }

    builder
        .setup(|_app| {
            #[cfg(desktop)]
            {
                let app = _app;
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::TrayIconBuilder;
                use tauri::Manager;
                use window_vibrancy::{apply_vibrancy, apply_mica, NSVisualEffectMaterial};

                if let Some(window) = app.get_webview_window("main") {
                    #[cfg(target_os = "macos")]
                    apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                        .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");
                }


                let show_item = MenuItem::with_id(app, "show", "Show Rem-Lays", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app, "quit", "Quit Rem-Lays", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

                let _tray = TrayIconBuilder::new()
                    .menu(&menu)
                    .icon(app.default_window_icon().unwrap().clone())
                    .show_menu_on_left_click(true)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .on_window_event(|_window, _event| {
            #[cfg(desktop)]
            if let tauri::WindowEvent::CloseRequested { api, .. } = _event {
                let state = _window.state::<AppState>();
                let close_to_tray = *state.close_to_tray.lock().unwrap();
                if close_to_tray {
                    _window.hide().ok();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Rem-Lays");
}
