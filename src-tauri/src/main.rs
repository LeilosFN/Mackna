#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use tauri::{Manager, Window};
use window_shadows::set_shadow;

mod launcher;
mod downloader;
mod process;
mod injector;

#[tauri::command]
async fn install_game(window: Window, install_path: String) -> Result<(), String> {
    let url = "http://79.116.51.74:4080/28.30.7z".to_string();
    downloader::download_and_install(window, url, install_path).await
}

#[tauri::command]
async fn select_folder() -> Result<String, String> {
    let result = rfd::FileDialog::new()
        .set_title("Select Fortnite Installation Folder")
        .pick_folder();
    
    match result {
        Some(path) => Ok(path.to_str().unwrap_or("").to_string()),
        None => Err("No folder selected".to_string()),
    }
}

#[tauri::command]
async fn launch_game(
    window: Window,
    fortnite_path: String,
    email: String,
    password: String,
    backend_url: String,
    host_url: String,
    manual_exchange_code: Option<String>,
) -> Result<bool, String> {
    launcher::launch(
        window,
        fortnite_path,
        email,
        password,
        backend_url,
        host_url,
        manual_exchange_code,
    ).await
}

#[tauri::command]
async fn kill_fortnite() -> Result<bool, String> {
    launcher::kill_fortnite_processes().await
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            
            // Apply window shadow for better aesthetics
            #[cfg(target_os = "windows")]
            set_shadow(&window, true).expect("Unsupported platform!");
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            select_folder,
            launch_game,
            kill_fortnite,
            install_game,
            launcher::check_is_game_running
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
