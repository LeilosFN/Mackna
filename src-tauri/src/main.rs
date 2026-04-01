#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use tauri::{Manager, Window, State};
use window_shadows::set_shadow;
use std::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};
use discord_rich_presence::{activity::{self, Activity}, DiscordIpc, DiscordIpcClient};
use serde::{Deserialize, Serialize};
use tiny_http::{Server, Response};

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

#[derive(Serialize, Clone)]
struct AuthPayload {
    id: String,
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
            let app_handle = app.handle();
            
            // Apply window shadow for better aesthetics
            #[cfg(target_os = "windows")]
            set_shadow(&window, true).expect("Unsupported platform!");

            // Start local auth server on port 4080
            std::thread::spawn(move || {
                let server = Server::http("127.0.0.1:4080").expect("Failed to start auth server on port 4080");
                println!("Auth server listening on http://127.0.0.1:4080");

                for request in server.incoming_requests() {
                    let url = request.url().to_string();
                    
                    let response = if url.starts_with("/auth") {
                        let mut user_id_found = None;
                        if let Some(query) = url.split('?').nth(1) {
                            for param in query.split('&') {
                                if param.starts_with("id=") {
                                    user_id_found = Some(param[3..].to_string());
                                    break;
                                }
                            }
                        }

                        if let Some(user_id) = user_id_found {
                            println!("Received Auth ID: {}", user_id);
                            let _ = app_handle.emit_all("auth-received", AuthPayload { id: user_id.clone() });
                            
                            Response::from_string(format!(r#"
                                <html>
                                    <head>
                                        <title>Authentication Completed - Leilos</title>
                                        <style>
                                            :root {{
                                                /* Gold & Black Theme */
                                                --primary: #D4AF37; /* Metallic Gold */
                                                --primary-hover: #F5Edc3; /* Pale Gold/Cream */
                                                --secondary: #1a1a1a; /* Dark Grey */
                                                --bg-dark: #050505; /* Deep Black */
                                                --bg-card: #0a0a0a; /* Slightly lighter black for cards */
                                                --text-main: #ffffff;
                                                --text-muted: #b8b8b8;
                                                --gold-gradient: linear-gradient(135deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C);
                                                --font-orbitron: 'Orbitron', sans-serif;
                                                --font-rajdhani: 'Rajdhani', sans-serif;
                                            }}

                                            * {{
                                                margin: 0;
                                                padding: 0;
                                                box-sizing: border-box;
                                            }}

                                            body {{
                                                background-color: var(--bg-dark);
                                                color: var(--text-main);
                                                font-family: var(--font-rajdhani);
                                                line-height: 1.6;
                                                overflow-x: hidden;
                                                min-height: 100vh;
                                                display: flex;
                                                flex-direction: column;
                                                justify-content: center;
                                                align-items: center;
                                            }}

                                            /* Luxury Texture Overlay */
                                            body::before {{
                                                content: "";
                                                position: fixed;
                                                top: 0;
                                                left: 0;
                                                width: 100%;
                                                height: 100%;
                                                background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23D4AF37' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
                                                pointer-events: none;
                                                z-index: -1;
                                            }}

                                            .auth-card {{
                                                background: var(--bg-card);
                                                border: 1px solid rgba(212,175,55,0.1);
                                                padding: 60px 50px;
                                                border-radius: 8px;
                                                text-align: center;
                                                transition: transform 0.3s ease, box-shadow 0.3s ease;
                                                position: relative;
                                                overflow: hidden;
                                                max-width: 450px;
                                                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                                            }}

                                            .auth-card::after {{
                                                content: "";
                                                position: absolute;
                                                top: 0;
                                                left: 0;
                                                width: 100%;
                                                height: 2px;
                                                background: var(--gold-gradient);
                                            }}

                                            .user-info {{
                                                display: flex;
                                                align-items: center;
                                                gap: 15px;
                                                background: rgba(255,255,255,0.02);
                                                padding: 15px;
                                                border-radius: 4px;
                                                margin-bottom: 25px;
                                                border: 1px solid rgba(212,175,55,0.05);
                                                text-align: left;
                                            }}

                                            .user-id {{
                                                font-family: 'Consolas', monospace;
                                                color: var(--primary);
                                                font-size: 0.9em;
                                                letter-spacing: 1px;
                                            }}

                                            h1 {{
                                                font-family: var(--font-orbitron);
                                                text-transform: uppercase;
                                                letter-spacing: 2px;
                                                background: var(--gold-gradient);
                                                -webkit-background-clip: text;
                                                -webkit-text-fill-color: transparent;
                                                margin-bottom: 25px;
                                                font-size: 2.2em;
                                                font-weight: 900;
                                                line-height: 1.1;
                                            }}

                                            p {{
                                                color: var(--text-muted);
                                                margin-bottom: 40px;
                                                font-size: 1.1em;
                                                line-height: 1.6;
                                            }}

                                            .btn-close {{
                                                display: inline-block;
                                                background: transparent;
                                                border: 2px solid var(--primary);
                                                color: var(--primary);
                                                padding: 15px 40px;
                                                font-size: 0.9em;
                                                font-family: var(--font-orbitron);
                                                text-transform: uppercase;
                                                cursor: pointer;
                                                position: relative;
                                                overflow: hidden;
                                                z-index: 1;
                                                width: 100%;
                                                font-weight: bold;
                                                letter-spacing: 2px;
                                                transition: all 0.3s ease;
                                            }}

                                            .btn-close::before {{
                                                content: "";
                                                position: absolute;
                                                top: 0;
                                                left: 0;
                                                width: 0%;
                                                height: 100%;
                                                background: var(--primary);
                                                transition: width 0.3s ease;
                                                z-index: -1;
                                            }}

                                            .btn-close:hover {{
                                                color: var(--bg-dark);
                                            }}

                                            .btn-close:hover::before {{
                                                width: 100%;
                                            }}
                                        </style>
                                    </head>
                                    <body>
                                        <div class="auth-card">
                                            <h1>AUTHENTICATION<br>SUCCESSFUL</h1>
                                            
                                            <div class="user-info">
                                                <div style="width: 40px; height: 40px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--bg-dark); font-weight: bold; font-family: var(--font-orbitron);">L</div>
                                                <div>
                                                    <div style="font-size: 10px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px;">Session ID</div>
                                                    <div class="user-id">{}</div>
                                                </div>
                                            </div>

                                            <p>The launcher has successfully received your credentials. You can safely close this window and return to the game.</p>
                                            
                                            <button class="btn-close" onclick="window.close()">Close Tab</button>
                                        </div>
                                        <script>
                                            setTimeout(() => {{ window.close(); }}, 5000);
                                        </script>
                                    </body>
                                </html>
                            "#, user_id))
                                .with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap())
                        } else {
                            Response::from_string("Missing ID").with_status_code(400)
                        }
                    } else {
                        Response::from_string("Not Found").with_status_code(404)
                    };

                    let _ = request.respond(response);
                }
            });
            
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
