use tauri::{Window, Manager};
use std::path::PathBuf;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::time::Duration;
use crate::process;
use crate::injector::DllInjector;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::Value;
use winapi::um::winuser::{GetAsyncKeyState, VK_CONTROL, VK_SHIFT, VK_MENU};
use winapi::um::processthreadsapi::OpenProcess;
use winapi::um::synchapi::WaitForSingleObject;
use winapi::um::handleapi::CloseHandle;
use winapi::um::winbase::INFINITE;
use winapi::um::winnt::SYNCHRONIZE;
use std::os::windows::process::CommandExt;

fn log_to_file(message: &str) {
    println!("{}", message);
    let mut log_path = std::env::temp_dir();
    log_path.push("leilos_launcher_debug.log");
    
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(file, "{}", message);
    }
}

async fn get_exchange_code(email: &str, password: &str, backend_url: &str) -> Result<String, String> {
    let base_url = backend_url.trim_end_matches('/');
    let client = reqwest::Client::new();

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

    let exchange_url = format!("{}/account/api/oauth/exchange", base_url);
    let mut exchange_headers = HeaderMap::new();
    
    let auth_val = HeaderValue::from_str(&format!("bearer {}", access_token))
        .map_err(|e| format!("Invalid access token format: {}", e))?;
    exchange_headers.insert(AUTHORIZATION, auth_val);

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
    redirect_dll: String,
    console_dll: String,
    game_server_dll: String,
) -> Result<bool, String> {
    log_to_file("Launching Fortnite...");
    log_to_file(&format!("Path: {}", fortnite_path));
    log_to_file(&format!("Backend: {}", backend_url));
    
    // 1. Verify Path
    let path = PathBuf::from(&fortnite_path);
    let exe_path = path.join("FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe");
    
    if !exe_path.exists() {
        return Err(format!("Fortnite executable not found at {:?}", exe_path));
    }

    // 2. Kill Existing Processes
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

    // 3. Prepare Bundled DLLs
    // The DLLs should be located in the launcher executable directory or a 'dlls' subfolder
    let binaries_path = path.join("FortniteGame\\Binaries\\Win64");
    
    // Get the directory where the launcher executable is running
    let current_exe = std::env::current_exe().map_err(|e| format!("Failed to get current exe path: {}", e))?;
    let exe_dir = current_exe.parent().ok_or("Failed to get exe directory")?;
    
    // Priority 1: Check root folder (where .exe is)
    // Priority 2: Check 'dlls' subfolder
    let mut dll_source_path = None;
    
    let root_dll = exe_dir.join("leilos.dll");
    let subfolder_dll = exe_dir.join("dlls").join("leilos.dll");
    
    if root_dll.exists() {
        log_to_file(&format!("Found DLLs in root: {:?}", exe_dir));
        dll_source_path = Some(exe_dir.to_path_buf());
    } else if subfolder_dll.exists() {
        log_to_file(&format!("Found DLLs in 'dlls' subfolder: {:?}", exe_dir.join("dlls")));
        dll_source_path = Some(exe_dir.join("dlls"));
    } else {
        log_to_file("Warning: DLLs not found in root or 'dlls' subfolder. Checking fallback...");
        // Fallback: Check CWD 'dlls'
        let cwd_dlls = std::env::current_dir().unwrap_or_default().join("dlls");
        if cwd_dlls.exists() {
             dll_source_path = Some(cwd_dlls);
        }
    }

    if let Some(source) = dll_source_path {
        // List of specific DLLs we care about
        let required_dlls = ["leilos.dll", "Leilos_Client.dll", "Leilos_GS.dll"];
        
        for file_name in required_dlls.iter() {
            let source_file = source.join(file_name);
            if source_file.exists() {
                let dest = binaries_path.join(file_name);
                if let Err(e) = fs::copy(&source_file, &dest) {
                    log_to_file(&format!("Failed to copy DLL {:?}: {}", file_name, e));
                } else {
                    log_to_file(&format!("Copied DLL: {:?}", file_name));
                }
            } else {
                 log_to_file(&format!("Warning: DLL {:?} not found in source {:?}", file_name, source));
            }
        }
    } else {
         log_to_file("Error: Could not locate DLL source directory.");
    }

    // 4. Authenticate
    let exchange_code = if let Some(code) = manual_exchange_code.filter(|c| !c.trim().is_empty()) {
        let trimmed_code = code.trim().to_string();
        log_to_file(&format!("Using manual exchange code: {}", trimmed_code));
        trimmed_code
    } else {
        log_to_file("Authenticating...");
        match get_exchange_code(&email, &password, &backend_url).await {
            Ok(code) => {
                log_to_file("Got exchange code");
                code
            },
            Err(e) => return Err(format!("Authentication failed: {}", e)),
        }
    };

    // 5. Pre-Launch Cleanup & Fake Processes
    // Delete GFSDK_Aftermath_Lib.x64.dll (Anti-Cheat / Crash Fix - used by Reboot/Erbium)
    let binaries_path_launch = path.join("FortniteGame\\Binaries\\Win64");
    let aftermath_dll = binaries_path_launch.join("GFSDK_Aftermath_Lib.x64.dll");
    if aftermath_dll.exists() {
        log_to_file(&format!("Deleting potential conflict DLL: {:?}", aftermath_dll));
        let _ = fs::remove_file(&aftermath_dll);
    }

    // Spawn Fake Processes (Suspended + No Window) to satisfy Anti-Cheat checks
    // This mimics Reboot Launcher and Erbium behavior to prevent "peta" (crashes)
    let fn_launcher_path = binaries_path_launch.join("FortniteLauncher.exe");
    let fn_eac_path = binaries_path_launch.join("FortniteClient-Win64-Shipping_EAC.exe");
    let fn_be_path = binaries_path_launch.join("FortniteClient-Win64-Shipping_BE.exe");

    log_to_file("Spawning fake background processes...");
    if fn_launcher_path.exists() {
        let _ = process::start_suspended(fn_launcher_path);
    }
    if fn_eac_path.exists() {
        let _ = process::start_suspended(fn_eac_path);
    }
    if fn_be_path.exists() {
         let _ = process::start_suspended(fn_be_path);
    }

    // 6. Launch Game
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

    log_to_file("Starting game process...");
    
    // Revert to start_with_args (Normal Launch)
    // Suspended launch causes immediate crash with these specific DLLs/Game version.
    // We use Normal Launch with a minimal delay to satisfy "al instante" request while maintaining stability.
    match process::start_with_args(exe_path, args) {
        Ok(pid) => {
            log_to_file(&format!("Game launched! PID: {}", pid));
            let _ = window.minimize();
            
            // Notificar al usuario que el juego se está iniciando (Solicitado por el usuario)
             let _ = window.emit("game-launching", "gameLaunching");

            // 7. Inject DLLs
            let injector = DllInjector::new();
            let binaries_path = path.join("FortniteGame\\Binaries\\Win64");

            // Check for Server Mode keys (Ctrl + Shift + Alt)
            let server_mode = unsafe {
                let ctrl = GetAsyncKeyState(VK_CONTROL) as u16;
                let shift = GetAsyncKeyState(VK_SHIFT) as u16;
                let alt = GetAsyncKeyState(VK_MENU) as u16;
                (ctrl & 0x8000) != 0 && (shift & 0x8000) != 0 && (alt & 0x8000) != 0
            };

            if server_mode {
                log_to_file("Server Mode Detected (Ctrl+Shift+Alt): Server features enabled.");
            } else {
                log_to_file("Client Mode: Skipping Leilos_GS.dll (Hold Ctrl+Shift+Alt to enable).");
            }

            // PHASE 1: IMMEDIATE INJECTION (Auth)
            // Reboot Launcher strategy: Inject Auth/Core DLL immediately after process start.
            let auth_dll_name = "leilos.dll";
            let mut auth_dll_path = if !redirect_dll.is_empty() {
                PathBuf::from(redirect_dll.clone())
            } else {
                binaries_path.join(auth_dll_name)
            };

            if !auth_dll_path.exists() {
                 // Try fallback/alternative name just in case
                 auth_dll_path = binaries_path.join("Tellurium.dll");
            }

            if auth_dll_path.exists() {
                 log_to_file(&format!("Injecting Auth DLL (Immediate): {:?}", auth_dll_path));
                 if let Some(p) = auth_dll_path.to_str() {
                     let _ = injector.inject(pid, p);
                 }
            } else {
                 log_to_file("Warning: Auth DLL not found for immediate injection!");
            }

            // PHASE 2: DELAYED INJECTION (Client / Server)
            // Wait for game to initialize before injecting Client/Console/Server DLLs.
            // Reduced to 4 seconds (from 15s) to fix "Abre pasa 2 Segundos" crash/timeout issues.
            // This aligns better with the "Hybrid" strategy (Immediate Auth -> Short Delay -> Client).
            log_to_file("Waiting for process to initialize (4s)...");
            tokio::time::sleep(Duration::from_millis(4000)).await;
            
            // Define remaining DLLs to inject
            let dll_candidates = [
                ("Leilos_GS.dll", "Leilos_GS.dll"),
                ("Leilos_Client.dll", "Leilos_Client.dll"),
            ];

            for (target_name, fallback_name) in dll_candidates.iter() {
                // Conditional Injection for Leilos_GS.dll (Game Server)
                if target_name == &"Leilos_GS.dll" && !server_mode {
                    continue;
                }

                // Check for custom DLLs first if provided
                let mut dll_path = if target_name == &"Leilos_Client.dll" && !console_dll.is_empty() {
                    PathBuf::from(console_dll.clone())
                } else if target_name == &"Leilos_GS.dll" && !game_server_dll.is_empty() {
                    PathBuf::from(game_server_dll.clone())
                } else {
                    binaries_path.join(target_name)
                };

                // Fallback to default names if not found
                if !dll_path.exists() {
                    dll_path = binaries_path.join(fallback_name);
                }

                if dll_path.exists() {
                     log_to_file(&format!("Injecting DLL: {:?}", dll_path));
                     if let Some(p) = dll_path.to_str() {
                         let _ = injector.inject(pid, p);
                     }
                     // Small delay between injections just to be safe
                     tokio::time::sleep(Duration::from_millis(500)).await;
                } else {
                     log_to_file(&format!("Warning: DLL not found: {:?}", target_name));
                }
            }

            // Start Process Monitor for Cleanup
            let cleanup_path = binaries_path.clone();
            let pid_clone = pid;
            
            tokio::spawn(async move {
                log_to_file(&format!("Starting monitor for PID: {}", pid_clone));
                unsafe {
                    let h_process = OpenProcess(SYNCHRONIZE, 0, pid_clone);
                    if !h_process.is_null() {
                        WaitForSingleObject(h_process, INFINITE);
                        CloseHandle(h_process);
                        
                        // Process has exited, perform cleanup
                        log_to_file("Game process exited. Cleaning up leilos.dll...");
                        let auth_dll = cleanup_path.join("leilos.dll");
                        if auth_dll.exists() {
                            // Retry loop in case file is still locked briefly
                            for _ in 0..5 {
                                if fs::remove_file(&auth_dll).is_ok() {
                                    log_to_file("Successfully deleted leilos.dll");
                                    break;
                                }
                                tokio::time::sleep(Duration::from_millis(500)).await;
                            }
                        }
                    } else {
                        log_to_file("Failed to open process handle for monitoring.");
                    }
                }
            });

            Ok(true)
        }
        Err(e) => Err(format!("Failed to launch game: {}", e)),
    }
}

#[tauri::command]
pub async fn kill_fortnite_processes(window: Window) -> Result<bool, String> {
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

    Ok(true)
}

#[tauri::command]
pub async fn check_is_game_running() -> Result<bool, String> {
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