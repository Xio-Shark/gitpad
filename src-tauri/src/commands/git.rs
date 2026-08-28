use crate::error::AppError;
use crate::git::types::{DiffFile, HistoryData, StatusData};

pub struct GitState;

#[tauri::command]
pub fn git_status(workspace: String) -> Result<StatusData, AppError> {
    crate::git::status::status(&workspace)
}

#[tauri::command]
pub fn git_diff(
    workspace: String,
    file: Option<String>,
    staged: bool,
) -> Result<Vec<DiffFile>, AppError> {
    let repo = crate::git::repo::open_repo(&workspace)?;
    match file {
        Some(f) => Ok(crate::git::diff::file_diff(&repo, &f, staged)?
            .into_iter()
            .collect()),
        None => crate::git::diff::file_diffs(&repo, staged, None),
    }
}

/// hunks: 选中 hunk 索引列表（缺省 = 全部选中）
#[tauri::command]
pub fn git_stage(
    workspace: String,
    file: String,
    hunks: Option<Vec<usize>>,
) -> Result<(), AppError> {
    let repo = crate::git::repo::open_repo(&workspace)?;
    let diff = crate::git::diff::file_diff(&repo, &file, false)?
        .ok_or_else(|| AppError::Git(format!("{file}: 无未暂存变更")))?;
    let selected = select_mask(diff.hunks.len(), hunks);
    crate::git::stage::stage(&repo, &file, &selected)
}

#[tauri::command]
pub fn git_unstage(
    workspace: String,
    file: String,
    hunks: Option<Vec<usize>>,
) -> Result<(), AppError> {
    let repo = crate::git::repo::open_repo(&workspace)?;
    let diff = crate::git::diff::file_diff(&repo, &file, true)?
        .ok_or_else(|| AppError::Git(format!("{file}: 无已暂存变更")))?;
    let selected = select_mask(diff.hunks.len(), hunks);
    crate::git::stage::unstage(&repo, &file, &selected)
}

fn select_mask(total: usize, hunks: Option<Vec<usize>>) -> Vec<bool> {
    match hunks {
        Some(idxs) => {
            let mut mask = vec![false; total];
            for i in idxs {
                if i < total {
                    mask[i] = true;
                }
            }
            mask
        }
        None => vec![true; total],
    }
}

#[tauri::command]
pub fn git_commit(workspace: String, message: String) -> Result<String, AppError> {
    let repo = crate::git::repo::open_repo(&workspace)?;
    crate::git::remote::commit(&repo, &message)
}

#[tauri::command]
pub fn git_push(workspace: String, remote: Option<String>) -> Result<String, AppError> {
    let repo = crate::git::repo::open_repo(&workspace)?;
    crate::git::remote::push(&repo, &remote.unwrap_or_else(|| "origin".into()))
}

#[tauri::command]
pub fn git_pull(workspace: String, remote: Option<String>) -> Result<String, AppError> {
    let repo = crate::git::repo::open_repo(&workspace)?;
    crate::git::remote::pull(&repo, &remote.unwrap_or_else(|| "origin".into()))
}

#[tauri::command]
pub fn git_history(workspace: String, limit: Option<usize>) -> Result<HistoryData, AppError> {
    let repo = crate::git::repo::open_repo(&workspace)?;
    crate::git::history::history(&repo, limit.unwrap_or(100))
}

#[tauri::command]
pub fn git_commit_diff(workspace: String, oid: String) -> Result<Vec<DiffFile>, AppError> {
    let repo = crate::git::repo::open_repo(&workspace)?;
    let commit = repo.find_commit(git2::Oid::from_str(&oid)?)?;
    let tree = commit.tree()?;
    let parent_tree = match commit.parent_count() {
        0 => None,
        _ => Some(commit.parent(0)?.tree()?),
    };
    let mut opts = git2::DiffOptions::new();
    opts.context_lines(3);
    let diff = match parent_tree {
        Some(pt) => repo.diff_tree_to_tree(Some(&pt), Some(&tree), Some(&mut opts))?,
        None => repo.diff_tree_to_tree(None, Some(&tree), Some(&mut opts))?,
    };
    let mut files = Vec::new();
    for (i, delta) in diff.deltas().enumerate() {
        let path = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_default();
        if path.is_empty() {
            continue;
        }
        let is_new = delta.new_file().id().is_zero();
        let is_deleted = delta.status() == git2::Delta::Deleted;
        let is_binary = delta.flags().contains(git2::DiffFlags::BINARY);
        let patch = match git2::Patch::from_diff(&diff, i) {
            Ok(Some(p)) => p,
            _ => continue,
        };
        let mut hunks = Vec::new();
        for hi in 0..patch.num_hunks() {
            let (hunk, line_count) = patch.hunk(hi)?;
            let mut lines = Vec::new();
            for li in 0..line_count {
                let line = patch.line_in_hunk(hi, li)?;
                let kind = line.origin();
                let kind_char = match kind {
                    '+' => '+',
                    '-' => '-',
                    '\\' => continue,
                    _ => ' ',
                };
                lines.push(crate::git::types::DiffLine {
                    kind: kind_char,
                    text: String::from_utf8_lossy(line.content()).into_owned(),
                    old_no: line.old_lineno(),
                    new_no: line.new_lineno(),
                });
            }
            hunks.push(crate::git::types::Hunk {
                header: String::from_utf8_lossy(hunk.header()).into_owned(),
                lines,
            });
        }
        files.push(DiffFile {
            path,
            hunks,
            is_new,
            is_deleted,
            is_binary,
        });
    }
    Ok(files)
}
