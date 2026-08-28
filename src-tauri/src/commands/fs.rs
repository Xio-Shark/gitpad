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
    /// 覆盖默认大小上限（CSV 等格式需要更大上限）
    #[serde(default)]
    pub max_size: Option<u64>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ReadFileResult {
    pub content: String,
    /// 检测到的编码："utf-8" / "gbk"
    pub encoding: String,
}

#[tauri::command]
pub fn fs_read_file(params: ReadFileParams) -> Result<ReadFileResult, AppError> {
    let (content, encoding) = text::read_text_with_limit(&params.path, params.max_size)?;
    Ok(ReadFileResult {
        content,
        encoding: encoding.to_string(),
    })
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct WriteFileParams {
    pub path: PathBuf,
    pub content: String,
    /// 写回编码（"gbk" 保持原编码写回，默认 UTF-8）
    #[serde(default = "default_utf8")]
    pub encoding: String,
}

fn default_utf8() -> String {
    "utf-8".to_string()
}

#[tauri::command]
pub fn fs_write_file(params: WriteFileParams) -> Result<(), AppError> {
    text::write_text(&params.path, &params.content, &params.encoding)
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct WalkParams {
    pub root: PathBuf,
    #[serde(default = "default_walk_limit")]
    pub limit: usize,
    #[serde(default)]
    pub show_hidden: bool,
    #[serde(default)]
    pub show_node_modules: bool,
}

fn default_walk_limit() -> usize {
    20000
}

#[tauri::command]
pub fn fs_walk(params: WalkParams) -> Result<tree::WalkResult, AppError> {
    let options = tree::ListOptions {
        show_hidden: params.show_hidden,
        show_node_modules: params.show_node_modules,
    };
    tree::walk(&params.root, &options, params.limit)
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct MutateParams {
    pub path: PathBuf,
    #[serde(default)]
    pub recursive: bool,
}

#[tauri::command]
pub fn fs_create_file(params: MutateParams) -> Result<(), AppError> {
    text::write_text(&params.path, "", "utf-8")
}

#[tauri::command]
pub fn fs_create_dir(params: MutateParams) -> Result<(), AppError> {
    std::fs::create_dir(&params.path)?;
    Ok(())
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct RenameParams {
    pub old_path: PathBuf,
    pub new_path: PathBuf,
}

#[tauri::command]
pub fn fs_rename(params: RenameParams) -> Result<(), AppError> {
    // 防止把目录移动到自身内部
    if params.new_path.starts_with(&params.old_path) {
        return Err(AppError::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "不能移动到自身内部",
        )));
    }
    std::fs::rename(&params.old_path, &params.new_path)?;
    Ok(())
}

#[tauri::command]
pub fn fs_delete(params: MutateParams) -> Result<(), AppError> {
    let meta = std::fs::metadata(&params.path)?;
    if meta.is_dir() {
        if !params.recursive {
            std::fs::remove_dir(&params.path)?;
        } else {
            std::fs::remove_dir_all(&params.path)?;
        }
    } else {
        std::fs::remove_file(&params.path)?;
    }
    Ok(())
}
