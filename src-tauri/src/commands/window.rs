use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

use crate::error::AppError;

/// URL 查询参数编码（路径可能含空格/中文/#/?）
fn url_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{:02X}", byte)),
        }
    }
    out
}

/// 打开一个新的 Workspace 窗口（每窗口一个 Workspace）
#[tauri::command]
pub fn open_workspace(app: AppHandle, path: String) -> Result<(), AppError> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or_default();
    let label = format!("workspace-{}-{}", millis, std::process::id());
    let url = WebviewUrl::App(format!("/?path={}", url_encode(&path)).into());
    WebviewWindowBuilder::new(&app, label, url)
        .title("GitPad")
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 500.0)
        .build()
        .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;
    Ok(())
}

/// 弹文件夹选择框，选中后打开 Workspace 窗口
#[tauri::command]
pub async fn pick_folder(app: AppHandle) -> Result<(), AppError> {
    let picked = app.dialog().file().blocking_pick_folder();
    if let Some(path) = picked {
        let path = path
            .into_path()
            .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;
        open_workspace(app, path.to_string_lossy().into_owned())?;
    }
    Ok(())
}
