pub mod commands;
pub mod error;
pub mod fs;
pub mod git;

use tauri_plugin_log::{Target, TargetKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::fs::fs_list_dir,
            commands::clipboard::clipboard_copy,
            commands::fs::fs_read_file,
            commands::fs::fs_write_file,
            commands::fs::fs_walk,
            commands::fs::fs_create_file,
            commands::fs::fs_create_dir,
            commands::fs::fs_rename,
            commands::fs::fs_delete,
            commands::window::open_workspace,
            commands::window::pick_folder,
            commands::git::git_status,
            commands::git::git_diff,
            commands::git::git_stage,
            commands::git::git_unstage,
            commands::git::git_commit,
            commands::git::git_push,
            commands::git::git_pull,
            commands::git::git_history,
            commands::git::git_commit_diff
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
