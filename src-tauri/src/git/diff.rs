use git2::{DiffFlags, DiffOptions, Repository};

use crate::error::AppError;

use super::types::{DiffFile, DiffLine, Hunk};

/// 生成工作区 diff（staged=false: workdir vs index，含未跟踪；staged=true: index vs HEAD）
pub fn file_diffs(
    repo: &Repository,
    staged: bool,
    only_path: Option<&str>,
) -> Result<Vec<DiffFile>, AppError> {
    let diff = if staged {
        let head = match repo.head() {
            Ok(h) => Some(
                h.peel_to_tree()
                    .map_err(|e| AppError::Git(e.message().to_string()))?,
            ),
            Err(_) => return Ok(Vec::new()), // unborn：无 HEAD，暂存 diff 为空
        };
        let idx = repo.index()?;
        let mut opts = DiffOptions::new();
        opts.context_lines(3);
        if let Some(p) = only_path {
            opts.pathspec(p);
        }
        let idx_ref = idx;
        repo.diff_tree_to_index(Some(&head.unwrap()), Some(&idx_ref), Some(&mut opts))?
    } else {
        let mut opts = DiffOptions::new();
        opts.context_lines(3)
            .include_untracked(true)
            .recurse_untracked_dirs(true)
            .show_untracked_content(false);
        if let Some(p) = only_path {
            opts.pathspec(p);
        }
        let idx = repo.index()?;
        repo.diff_index_to_workdir(Some(&idx), Some(&mut opts))?
    };

    let mut out = Vec::new();
    for (i, delta) in diff.deltas().enumerate() {
        let path = delta
            .new_file()
            .path()
            .map(|p| p.display().to_string())
            .unwrap_or_default();
        if path.is_empty() {
            continue;
        }
        let is_new = delta.new_file().id().is_zero();
        let is_deleted = delta.status() == git2::Delta::Deleted;
        let is_binary = delta.flags().contains(DiffFlags::BINARY);
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
                    '\\' => continue, // "\ No newline" 标记不传前端
                    _ => ' ',
                };
                lines.push(DiffLine {
                    kind: kind_char,
                    text: String::from_utf8_lossy(line.content()).into_owned(),
                    old_no: line.old_lineno(),
                    new_no: line.new_lineno(),
                });
            }
            hunks.push(Hunk {
                header: String::from_utf8_lossy(hunk.header()).into_owned(),
                lines,
            });
        }
        out.push(DiffFile {
            path,
            hunks,
            is_new,
            is_deleted,
            is_binary,
        });
    }
    Ok(out)
}

/// 单一文件的 diff（ChangesView 点开文件时用）
pub fn file_diff(
    repo: &Repository,
    path: &str,
    staged: bool,
) -> Result<Option<DiffFile>, AppError> {
    let mut files = file_diffs(repo, staged, Some(path))?;
    Ok(files.pop())
}
