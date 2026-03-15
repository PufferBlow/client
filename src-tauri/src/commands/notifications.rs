use tauri::AppHandle;

/// Update the tray icon badge with the current unread count.
/// Pass 0 to clear the badge.
#[tauri::command]
pub async fn set_tray_badge(count: u32, app: AppHandle) -> Result<(), String> {
    // Badge rendering is platform-specific:
    // macOS: use the dock badge API
    // Windows/Linux: update the tray icon tooltip to include count
    if let Some(tray) = app.tray_by_id("main") {
        let label = if count > 0 {
            format!("Pufferblow ({} unread)", count)
        } else {
            "Pufferblow".to_string()
        };
        tray.set_tooltip(Some(&label)).map_err(|e| e.to_string())?;
    }
    Ok(())
}
