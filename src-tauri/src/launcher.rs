use tauri::{Window, Manager};
use std::path::PathBuf;
use std::fs;
use std::thread;
use std::time::Duration;
use crate::process;
use crate::downloader::download_file;
use crate::injector::DllInjector;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::Value;
use winapi::um::winuser::{GetAsyncKeyState, VK_CONTROL, VK_SHIFT, VK_MENU};

async fn get_exchange_code(email: &str, password: &str, backend_url: &str) -> Result<String, String> {
    // Ensure backend_url doesn't have trailing slash for consistency
    let base_url = backend_url.trim_end_matches('/');
    let client = reqwest::Client::new();

    // 1. OAuth Token Request
    // Use the Fortnite Launcher Client ID (publicly known)
    // Authorization: basic MzQ0NmNkNzI2OTRjNGE0NDg1ZDgxYjc3YWRiYjIxNDE6OTIwOWQ0YTVlMjVhNDU3YTliMDcxMzhjYjcyNzYzMDQ=
    let token_url = format!("{}/account/api/oauth/token", base_url);
    let auth_header = "basic MzQ0NmNkNzI2OTRjNGE0NDg1ZDgxYjc3YWRiYjIxNDE6OTIwOWQ0YTVlMjVhNDU3YTliMDcxMzhjYjcyNzYzMDQ=";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_static(auth_header));
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/x-www-form-urlencoded"));

    let params = [
        ("grant_type", "password"),
        ("username", email),
        ("password", password),
    ];

    println!("Requesting token from: {}", token_url);
    let response = client.post(&token_url)
        .headers(headers)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Login request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Login failed ({}): {}", status, text));
    }

    let token_data: Value = response.json().await
        .map_err(|e| format!("Failed to parse login response: {}", e))?;
    
    let access_token = token_data["access_token"].as_str()
        .ok_or("No access_token in response")?;

    // 2. Exchange Code Request
    let exchange_url = format!("{}/account/api/oauth/exchange", base_url);
    let mut exchange_headers = HeaderMap::new();
    exchange_headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("bearer {}", access_token)).unwrap());

    let exchange_res = client.get(&exchange_url)
        .headers(exchange_headers)
        .send()
        .await
        .map_err(|e| format!("Exchange request failed: {}", e))?;

    if !exchange_res.status().is_success() {
        let status = exchange_res.status();
        let text = exchange_res.text().await.unwrap_or_default();
        return Err(format!("Exchange failed ({}): {}", status, text));
    }

    let exchange_data: Value = exchange_res.json().await
        .map_err(|e| format!("Failed to parse exchange response: {}", e))?;
    
    let code = exchange_data["code"].as_str()
        .ok_or("No code in exchange response")?;

    Ok(code.to_string())
}

#[tauri::command]
pub async fn launch(
    window: Window,
    fortnite_path: String,
    email: String,
    password: String,
    backend_url: String,
    host_url: String,
    manual_exchange_code: Option<String>,
) -> Result<bool, String> {
    // FORCE IP FOR TESTING removed to respect configStore


    println!("Launching Fortnite...");
    println!("Path: {}", fortnite_path);
    println!("Backend: {}", backend_url);

    // 1. Verify Path
    let path = PathBuf::from(&fortnite_path);
    let exe_path = path.join("FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe");
    let launcher_path = path.join("FortniteGame\\Binaries\\Win64\\FortniteLauncher.exe");
    let eac_path = path.join("FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping_EAC.exe");

    if !exe_path.exists() {
        return Err(format!("Fortnite executable not found at {:?}", exe_path));
    }

    // 2. Kill Existing Processes (Retrac style)
    let processes_to_kill = [
        "FortniteClient-Win64-Shipping_BE.exe",
        "FortniteClient-Win64-Shipping_EAC.exe",
        "FortniteClient-Win64-Shipping.exe",
        "EpicGamesLauncher.exe",
        "FortniteLauncher.exe",
        "FortniteCrashHandler.exe",
        "UnrealCEFSubProcess.exe",
        "CrashReportClient.exe",
    ];
    let _ = process::kill_all(&processes_to_kill);

    // 3. Download and Copy DLLs
    // New logic: Download DLLs from CDN to AppData, then copy to Game Binaries
    
    // Define paths
    let app_dir = window.app_handle().path_resolver().app_data_dir()
        .ok_or("Failed to resolve app data directory")?;
    let downloaded_dlls_dir = app_dir.join("dlls");
    let binaries_path = path.join("FortniteGame\\Binaries\\Win64");

    // Create directories if not exist
    if !downloaded_dlls_dir.exists() {
        fs::create_dir_all(&downloaded_dlls_dir).map_err(|e| format!("Failed to create DLL download dir: {}", e))?;
    }

    // List of DLLs to download
    let dlls_to_download = [
        ("Leilos_Tellurium.dll", "https://cdn.leilos.qzz.io/download/dlls/Leilos_Tellurium.dll"),
        ("Leilos_Client.dll", "https://cdn.leilos.qzz.io/download/dlls/Leilos_Client.dll"),
    ];

    println!("Downloading DLLs from CDN...");
    for (name, url) in dlls_to_download.iter() {
        let dest_path = downloaded_dlls_dir.join(name);
        println!("Downloading {}...", name);
        
        // Try download, log error but continue (maybe using cached version)
        match download_file(url, &dest_path).await {
            Ok(_) => println!("Downloaded {}", name),
            Err(e) => println!("Warning: Failed to download {}: {}. Using cached version if available.", name, e),
        }
        
        // Copy to Game Binaries
        if dest_path.exists() {
             let game_dest = binaries_path.join(name);
             if let Err(e) = fs::copy(&dest_path, &game_dest) {
                 println!("Warning: Failed to copy {:?} to {:?}: {}", dest_path, game_dest, e);
             } else {
                 println!("Copied {:?} to {:?}", dest_path, game_dest);
             }
        } else {
             println!("Error: DLL {} not found after download attempt.", name);
        }
    }

    // 3.5. Specific Copy for Injection REMOVED in favor of LoadLibraryA injection
    // Old logic removed to comply with new requirements.

    // 4. Start Suspended Processes (EAC Bypass)
    println!("Starting suspended processes...");
    if launcher_path.exists() {
        // Ignore errors if they fail to start, but log it
        if let Err(e) = process::start_suspended(launcher_path.clone()) {
            println!("Warning: Failed to start suspended launcher: {}", e);
        }
    }
    if eac_path.exists() {
        if let Err(e) = process::start_suspended(eac_path.clone()) {
             println!("Warning: Failed to start suspended EAC: {}", e);
        }
    }

    // 5. Authenticate and Get Exchange Code
    let exchange_code = if let Some(code) = manual_exchange_code.filter(|c| !c.trim().is_empty()) {
        let trimmed_code = code.trim().to_string();
        println!("Using manual exchange code: {}", trimmed_code);
        trimmed_code
    } else {
        println!("Authenticating...");
        match get_exchange_code(&email, &password, &backend_url).await {
            Ok(code) => {
                println!("Got exchange code: {}", code);
                code
            },
            Err(e) => return Err(format!("Authentication failed: {}", e)),
        }
    };

    // 6. Launch Game with Retrac Arguments
    let args = vec![
        "-epicapp=Fortnite".to_string(),
        "-epicenv=Prod".to_string(),
        "-epiclocale=en-us".to_string(),
        "-epicportal".to_string(),
        "-nobe".to_string(),
        "-fromfl=eac".to_string(),
        "-fltoken=hchc0906bb1bg83c3934fa31".to_string(),
        "-caldera=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50X2lkIjoiYmU5ZGE1YzJmYmVhNDQwN2IyZjQwZWJhYWQ4NTlhZDQiLCJnZW5lcmF0ZWQiOjE2Mzg3MTcyNzgsImNhbGRlcmFHdWlkIjoiMzgxMGI4NjMtMmE2NS00NDU3LTliNTgtNGRhYjNiNDgyYTg2IiwiYWNQcm92aWRlciI6IkVhc3lBbnRpQ2hlYXQiLCJub3RlcyI6IiIsImZhbGxiYWNrIjpmYWxzZX0.VAWQB67RTxhiWOxx7DBjnzDnXyyEnX7OljJm-j2d88G_WgwQ9wrE6lwMEHZHjBd1ISJdUO1UVUqkfLdU5nofBQ".to_string(),
        "-skippatchcheck".to_string(),
        "-noeac".to_string(),
        "-AUTH_LOGIN=unused".to_string(),
        format!("-AUTH_PASSWORD={}", exchange_code),
        "-AUTH_TYPE=exchangecode".to_string(),
        format!("-backend={}", backend_url),
        format!("-host={}", host_url),
    ];

    println!("Launching with args: {:?}", args);
    let args_str = args.join(" ");
    println!("Full Command Line (Copy/Paste to test): \"{}\" {}", exe_path.display(), args_str);

    match process::start_with_args(exe_path, args) {
        Ok(pid) => {
            println!("Game launched successfully! PID: {}", pid);

            // Minimize the launcher window
            let _ = window.minimize();

            // 7. Inject DLLs
            // Wait for process to be stable
            println!("Waiting for process to initialize (15s)...");
            // Use tokio::time::sleep to avoid blocking the runtime thread
            // Increased to 15s to match v1.0.2 stability
            tokio::time::sleep(Duration::from_millis(15000)).await;

            let injector = DllInjector::new();
            let binaries_path = path.join("FortniteGame\\Binaries\\Win64");
            
            // Define DLLs to inject in order
            // Map generic names to likely existing files if specific names are not found
            // ORDER MATTERS: Tellurium (Auth/Core) -> Client
            let dll_candidates = [
                ("Leilos_Tellurium.dll", "Leilos_Tellurium.dll"),
                ("Leilos_Client.dll", "Leilos_Client.dll"),
            ];

            // Check for Server Mode keys (Ctrl + Shift + Alt) - Logic kept but currently unused for injection list
            let server_mode = unsafe {
                let ctrl = GetAsyncKeyState(VK_CONTROL) as u16;
                let shift = GetAsyncKeyState(VK_SHIFT) as u16;
                let alt = GetAsyncKeyState(VK_MENU) as u16;
                (ctrl & 0x8000) != 0 && (shift & 0x8000) != 0 && (alt & 0x8000) != 0
            };

            if server_mode {
                println!("Server Mode Detected (Ctrl+Shift+Alt): Server features enabled.");
            }

            for (target_name, fallback_name) in dll_candidates.iter() {

                let mut dll_path = binaries_path.join(target_name);
                if !dll_path.exists() {
                    dll_path = binaries_path.join(fallback_name);
                }

                if dll_path.exists() {
                     let abs_path = fs::canonicalize(&dll_path).unwrap_or(dll_path.clone());
                     let abs_path_str = match abs_path.to_str() {
                         Some(s) => s,
                         None => {
                             println!("Warning: Invalid path string for {:?}", abs_path);
                             continue;
                         }
                     };
                     
                     println!("Injecting DLL: {:?}", abs_path_str);
                     match injector.inject(pid, abs_path_str) {
                         Ok(_) => println!("Successfully injected {}", abs_path_str),
                         Err(e) => println!("Failed to inject {}: {}", abs_path_str, e),
                     }
                } else {
                    println!("Warning: DLL not found: {} (or {})", target_name, fallback_name);
                }
                
                // Increased delay between injections to prevent race conditions
                tokio::time::sleep(Duration::from_millis(500)).await;
            }

            Ok(true)// Monitor Process REMOVED as per user request
            // The process monitoring thread was causing issues (CMD window flickering/crash)
            // and has been disabled. The launcher will not wait for the game to exit.
            /*
            let window_clone = window.clone();
            thread::spawn(move || {
                unsafe {
                    use winapi::um::processthreadsapi::OpenProcess;
                    use winapi::um::synchapi::WaitForSingleObject;
                    use winapi::um::winnt::SYNCHRONIZE;
                    use winapi::um::winbase::INFINITE;
                    use winapi::um::handleapi::CloseHandle;

                    let handle = OpenProcess(SYNCHRONIZE, 0, pid);
                    if !handle.is_null() {
                        println!("Monitoring process {}...", pid);
                        WaitForSingleObject(handle, INFINITE);
                        CloseHandle(handle);
                        println!("Process {} exited.", pid);

                        // Force cleanup of any remaining processes
                        let processes_to_kill = [
                            "FortniteClient-Win64-Shipping_BE.exe",
                            "FortniteClient-Win64-Shipping_EAC.exe",
                            "FortniteClient-Win64-Shipping.exe",
                            "EpicGamesLauncher.exe",
                            "FortniteLauncher.exe",
                            "FortniteCrashHandler.exe",
                            "UnrealCEFSubProcess.exe",
                            "CrashReportClient.exe",
                        ];
                        let _ = crate::process::kill_all(&processes_to_kill);

                        let _ = window_clone.emit("game-exited", ());
                    } else {
                        println!("Failed to open process handle for monitoring.");
                         let _ = window_clone.emit("game-exited", ());
                    }
                }
            });
            */
        }
        Err(e) => Err(format!("Failed to launch game: {}", e)),
    }
}

#[tauri::command]
pub async fn kill_fortnite_processes() -> Result<bool, String> {
    let processes_to_kill = [
        "FortniteClient-Win64-Shipping_BE.exe",
        "FortniteClient-Win64-Shipping_EAC.exe",
        "FortniteClient-Win64-Shipping.exe",
        "EpicGamesLauncher.exe",
        "FortniteLauncher.exe",
        "FortniteCrashHandler.exe",
        "UnrealCEFSubProcess.exe",
        "CrashReportClient.exe",
    ];
    process::kill_all(&processes_to_kill).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn check_is_game_running() -> Result<bool, String> {
    // Check if the main game process is running using sysinfo to avoid CMD window flashing
    use sysinfo::{System, SystemExt, ProcessExt};
    
    let mut system = System::new();
    system.refresh_processes();
    
    for process in system.processes().values() {
        if process.name().eq_ignore_ascii_case("FortniteClient-Win64-Shipping.exe") {
            return Ok(true);
        }
    }
    
    Ok(false)
}
