use keyring::Entry;

const SERVICE: &str = "space.pufferblow.client";

/// Save the instance URL and auth token to the OS keychain.
/// Called from the frontend authStore after successful login.
#[tauri::command]
pub async fn save_credentials(instance_url: String, token: String) -> Result<(), String> {
    let url_entry = Entry::new(SERVICE, "instance_url").map_err(|e| e.to_string())?;
    url_entry
        .set_password(&instance_url)
        .map_err(|e| e.to_string())?;

    let token_entry = Entry::new(SERVICE, "auth_token").map_err(|e| e.to_string())?;
    token_entry
        .set_password(&token)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Load saved credentials. Returns None if not set.
/// Called on app launch to skip the login screen if already authenticated.
#[tauri::command]
pub async fn load_credentials() -> Result<Option<(String, String)>, String> {
    let url_entry = Entry::new(SERVICE, "instance_url").map_err(|e| e.to_string())?;
    let token_entry = Entry::new(SERVICE, "auth_token").map_err(|e| e.to_string())?;

    match (url_entry.get_password(), token_entry.get_password()) {
        (Ok(url), Ok(token)) => Ok(Some((url, token))),
        _ => Ok(None),
    }
}

/// Remove credentials from the OS keychain on logout.
#[tauri::command]
pub async fn clear_credentials() -> Result<(), String> {
    let _ = Entry::new(SERVICE, "instance_url").and_then(|e| e.delete_password());
    let _ = Entry::new(SERVICE, "auth_token").and_then(|e| e.delete_password());
    Ok(())
}
