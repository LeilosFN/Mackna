#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use tauri::{Manager, Window, State};
use window_shadows::set_shadow;
use std::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};
use discord_rich_presence::{activity::{self, Activity}, DiscordIpc, DiscordIpcClient};
use serde::Deserialize;

mod launcher;
mod process;
mod injector;

#[derive(Deserialize)]
struct RpcConfig {
  client_id: String,
  state: String,
  details: String,
  large_image: String,
  large_text: String,
  small_image: String,
  small_text: String,
  button_1_text: String,
  button_1_url: String,
  button_2_text: String,
  button_2_url: String,
  enable_timer: bool,
}

struct RpcClient {
  client: Option<DiscordIpcClient>,
  start_time: Option<i64>,
}

#[tauri::command]
fn start_rpc(config: RpcConfig, state: State<RwLock<RpcClient>>) -> Result<(), String> {
  let mut rpc_client = state.write().map_err(|e| e.to_string())?;
  
  if rpc_client.client.is_none() {
    let mut client = DiscordIpcClient::new(&config.client_id)
      .map_err(|e| e.to_string())?;
    client.connect().map_err(|e| e.to_string())?;
    rpc_client.client = Some(client);
  }

  let mut activity = Activity::new().details(&config.details);

  if config.state != "none" {
    activity = activity.state(&config.state);
  }

  let mut assets = activity::Assets::new();
  if config.large_image != "none" {
    assets = assets.large_image(&config.large_image);
  }
  if config.large_text != "none" {
    assets = assets.large_text(&config.large_text);
  }
  if config.small_image != "none" {
    assets = assets.small_image(&config.small_image);
  }
  if config.small_text != "none" {
    assets = assets.small_text(&config.small_text);
  }
  activity = activity.assets(assets);

  let mut buttons = Vec::new();
  if config.button_1_text != "none" && config.button_1_url != "none" {
    buttons.push(activity::Button::new(&config.button_1_text, &config.button_1_url));
  }
  if config.button_2_text != "none" && config.button_2_url != "none" {
    buttons.push(activity::Button::new(&config.button_2_text, &config.button_2_url));
  }
  if !buttons.is_empty() {
    activity = activity.buttons(buttons);
  }

  if config.enable_timer {
    let time_unix = if let Some(start) = rpc_client.start_time {
      start
    } else {
      let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|t| t.as_secs() as i64)
        .unwrap_or(0);
      rpc_client.start_time = Some(now);
      now
    };
    activity = activity.timestamps(activity::Timestamps::new().start(time_unix));
  } else {
    rpc_client.start_time = None;
  }

  if let Some(client) = &mut rpc_client.client {
    client.set_activity(activity).map_err(|e| e.to_string())?;
  }

  Ok(())
}

#[tauri::command]
fn stop_rpc(state: State<RwLock<RpcClient>>) -> Result<(), String> {
  let mut rpc_client = state.write().map_err(|e| e.to_string())?;
  
  if let Some(mut client) = rpc_client.client.take() {
    client.close().map_err(|e| e.to_string())?;
  }
  
  rpc_client.start_time = None;
  
  Ok(())
}

#[tauri::command]
fn clear_rpc(state: State<RwLock<RpcClient>>) -> Result<(), String> {
  let mut rpc_client = state.write().map_err(|e| e.to_string())?;
  
  if let Some(client) = &mut rpc_client.client {
    client.clear_activity().map_err(|e| e.to_string())?;
  } else {
    return Err("Discord RPC not initialized".to_string());
  }
  
  Ok(())
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
async fn check_file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
async fn check_fortnite_version(path: String) -> Result<bool, String> {
    let version_file = std::path::Path::new(&path).join("Engine").join("Build").join("Build.version");
    if !version_file.exists() {
        return Ok(false);
    }

    let content = std::fs::read_to_string(version_file).map_err(|e| e.to_string())?;
    
    // Parse as JSON to check the BranchName
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
        if let Some(branch_name) = json.get("BranchName").and_then(|v| v.as_str()) {
            if branch_name.contains("28.30") {
                return Ok(true);
            }
        }
    }
    
    // Fallback if parsing fails or structure is slightly different, just check if the string contains "28.30"
    if content.contains("28.30") {
        return Ok(true);
    }

    Ok(false)
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
    redirect_dll: String,
    console_dll: String,
    game_server_dll: String,
) -> Result<bool, String> {
    launcher::launch(
        window,
        fortnite_path,
        email,
        password,
        backend_url,
        host_url,
        manual_exchange_code,
        redirect_dll,
        console_dll,
        game_server_dll,
    ).await
}

#[tauri::command]
async fn kill_fortnite(window: Window) -> Result<bool, String> {
    launcher::kill_fortnite_processes(window).await
}

fn main() {
    tauri::Builder::default()
        .manage(RwLock::new(RpcClient { 
            client: None,
            start_time: None,
        }))
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
            launcher::check_is_game_running,
            start_rpc,
            stop_rpc,
            clear_rpc,
            check_file_exists,
            check_fortnite_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
