use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

/// Check for an available update.
/// Returns true if an update is available.
#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<bool, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(_)) => Ok(true),
        Ok(None) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

/// Download and install the pending update, then restart.
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        app.restart();
    }
    Ok(())
}
