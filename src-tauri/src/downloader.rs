use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use tauri::Window;
use futures_util::StreamExt;

#[derive(Clone, serde::Serialize)]
struct DownloadProgress {
    state: String, // "downloading" | "extracting" | "completed" | "error"
    percent: u64,
    downloaded: u64,
    total: u64,
}

pub async fn download_and_install(
    window: Window,
    url: String,
    install_path: String,
) -> Result<(), String> {
    let path = Path::new(&install_path);
    if !path.exists() {
        fs::create_dir_all(path).map_err(|e| e.to_string())?;
    }

    // 1. Download
    let client = reqwest::Client::new();
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let total_size = res.content_length().unwrap_or(0);
    let mut stream = res.bytes_stream();
    
    let file_name = url.split('/').last().unwrap_or("game.7z");
    let temp_path = path.join(file_name);
    let mut file = File::create(&temp_path).map_err(|e| e.to_string())?;

    let mut downloaded: u64 = 0;

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        
        downloaded += chunk.len() as u64;
        
        if total_size > 0 {
            let percent = (downloaded * 100) / total_size;
            window.emit("download-progress", DownloadProgress {
                state: "downloading".into(),
                percent,
                downloaded,
                total: total_size,
            }).unwrap_or(());
        }
    }

    // 2. Extract
    window.emit("download-progress", DownloadProgress {
        state: "extracting".into(),
        percent: 0,
        downloaded: total_size,
        total: total_size,
    }).unwrap_or(());

    sevenz_rust::decompress_file(&temp_path, path).map_err(|e| format!("Extraction failed: {}", e))?;

    // 3. Cleanup
    fs::remove_file(&temp_path).map_err(|e| e.to_string())?;

    window.emit("download-progress", DownloadProgress {
        state: "completed".into(),
        percent: 100,
        downloaded: total_size,
        total: total_size,
    }).unwrap_or(());

    Ok(())
}

pub async fn download_file(
    url: &str,
    dest_path: &Path,
) -> Result<(), String> {
    if let Some(parent) = dest_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let client = reqwest::Client::new();
    let res = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to {}: {}", url, e))?;

    if !res.status().is_success() {
        return Err(format!("Failed to download {}: Status {}", url, res.status()));
    }

    let content = res.bytes().await.map_err(|e| format!("Failed to read bytes: {}", e))?;
    let mut file = File::create(dest_path).map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(&content).map_err(|e| format!("Failed to write to file: {}", e))?;

    Ok(())
}
