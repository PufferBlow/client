mod commands;
mod tray;

use commands::{credentials, notifications, updater};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_stronghold::Builder::new(|password| {
                // derive a key from the password — use argon2 or similar
                password.as_bytes().to_vec()
            })
            .build(),
        )
        .setup(|app| {
            tray::setup_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            credentials::save_credentials,
            credentials::load_credentials,
            credentials::clear_credentials,
            notifications::set_tray_badge,
            updater::check_for_updates,
            updater::install_update,
        ])
        // Hide window on close instead of quitting
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Pufferblow");
}
