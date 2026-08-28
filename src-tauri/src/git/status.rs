use git2::{Repository, Status, StatusOptions};

use crate::error::AppError;

use super::repo::current_branch;
use super::types::{Change, StatusData};

fn status_char(flags: git2::Status) -> &'static str {
    if flags.intersects(Status::INDEX_NEW) || flags.intersects(Status::WT_NEW) {
        "A"
    } else if flags.intersects(Status::INDEX_DELETED) || flags.intersects(Status::WT_DELETED) {
        "D"
    } else if flags.intersects(Status::INDEX_RENAMED) || flags.intersects(Status::WT_RENAMED) {
        "R"
    } else {
        "M"
    }
}

fn to_change(path: &str, flags: git2::Status) -> Change {
    let untracked = flags.contains(Status::WT_NEW) || flags.contains(Status::IGNORED);
    let staged = flags.intersects(Status::INDEX_NEW)
        || flags.intersects(Status::INDEX_MODIFIED)
        || flags.intersects(Status::INDEX_DELETED)
        || flags.intersects(Status::INDEX_RENAMED)
        || flags.intersects(Status::INDEX_TYPECHANGE);
    Change {
        path: path.to_string(),
        status: status_char(flags).to_string(),
        staged,
        untracked,
    }
}

/// 工作区状态：分支 + 变更列表（staged/unstaged/untracked）
pub fn status(workspace_path: &str) -> Result<StatusData, AppError> {
    let repo = super::repo::open_repo(workspace_path)?;

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = repo.statuses(Some(&mut opts))?;
    let mut changes: Vec<Change> = Vec::new();
    for entry in statuses.iter() {
        let path = entry.path().map(|p| p.to_string()).unwrap_or_default();
        if path.is_empty() {
            continue;
        }
        changes.push(to_change(&path, entry.status()));
    }
    changes.sort_by(|a, b| a.path.cmp(&b.path));

    let branch = current_branch(&repo);
    let (ahead, behind) = ahead_behind(&repo)?;

    Ok(StatusData {
        is_git: true,
        branch,
        ahead,
        behind,
        changes,
    })
}

fn ahead_behind(repo: &Repository) -> Result<(usize, usize), AppError> {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return Ok((0, 0)),
    };
    let head_oid = head.target();
    let Some(head_oid) = head_oid else {
        return Ok((0, 0));
    };
    let Some(branch_name) = head.shorthand() else {
        return Ok((0, 0));
    };
    let upstream_name = match repo.branch_upstream_name(branch_name) {
        Ok(n) => n,
        Err(_) => return Ok((0, 0)),
    };
    let upstream = match repo.find_reference(upstream_name.as_str().unwrap_or_default()) {
        Ok(r) => r,
        Err(_) => return Ok((0, 0)),
    };
    let Some(up_oid) = upstream.target() else {
        return Ok((0, 0));
    };
    let (ahead, behind) = repo.graph_ahead_behind(head_oid, up_oid)?;
    Ok((ahead, behind))
}
