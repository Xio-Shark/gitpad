use crate::error::AppError;

#[tauri::command]
pub fn clipboard_copy(text: String) -> Result<(), AppError> {
    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| AppError::Io(std::io::Error::other(format!("clipboard: {e}"))))?;
    clipboard
        .set_text(text)
        .map_err(|e| AppError::Io(std::io::Error::other(format!("clipboard: {e}"))))?;
    Ok(())
}
