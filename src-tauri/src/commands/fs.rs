use std::path::PathBuf;

use crate::error::AppError;
use crate::fs::{text, tree};

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ListDirParams {
    pub path: PathBuf,
    #[serde(default)]
    pub show_hidden: bool,
    #[serde(default)]
    pub show_node_modules: bool,
}

#[tauri::command]
pub fn fs_list_dir(params: ListDirParams) -> Result<Vec<tree::DirEntry>, AppError> {
    let options = tree::ListOptions {
        show_hidden: params.show_hidden,
        show_node_modules: params.show_node_modules,
    };
    tree::list(&params.path, &options)
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ReadFileParams {
    pub path: PathBuf,
}

#[tauri::command]
pub fn fs_read_file(params: ReadFileParams) -> Result<String, AppError> {
    text::read_text(&params.path)
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct WriteFileParams {
    pub path: PathBuf,
    pub content: String,
}

#[tauri::command]
pub fn fs_write_file(params: WriteFileParams) -> Result<(), AppError> {
    text::write_text(&params.path, &params.content)
}
