//! 提交历史 + 分支/标签引用

use git2::{BranchType, Repository, Sort};

use crate::error::AppError;

use super::types::{CommitInfo, HistoryData, RefInfo};

pub fn history(repo: &Repository, limit: usize) -> Result<HistoryData, AppError> {
    let mut refs: Vec<RefInfo> = Vec::new();
    let mut commit_refs: Vec<(String, String)> = Vec::new(); // (oid, name)

    for branch in repo.branches(Some(BranchType::Local))? {
        let (b, _) = branch?;
        if let (Some(name), Some(oid)) = (b.name()?, b.get().target()) {
            refs.push(RefInfo {
                name: name.to_string(),
                oid: oid.to_string(),
            });
            commit_refs.push((oid.to_string(), name.to_string()));
        }
    }
    for tag_name in repo.tag_names(None)?.iter() {
        let Some(tag_name) = tag_name else { continue };
        if let Ok(obj) = repo.revparse_single(&format!("refs/tags/{tag_name}")) {
            let oid = obj.id().to_string();
            refs.push(RefInfo {
                name: format!("tag/{tag_name}"),
                oid: oid.clone(),
            });
            commit_refs.push((oid, format!("tag/{tag_name}")));
        }
    }

    let head = match repo.head() {
        Ok(h) => Some(h.target().map(|o| o.to_string())),
        Err(_) => None,
    };

    let mut walk = repo.revwalk()?;
    walk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)?;
    for r in &refs {
        if let Ok(oid) = git2::Oid::from_str(&r.oid) {
            let _ = walk.push(oid);
        }
    }
    // 确保 HEAD 可达（detached 等场景）
    if let Some(Some(oid)) = &head {
        if let Ok(oid) = git2::Oid::from_str(oid) {
            let _ = walk.push(oid);
        }
    }

    let mut commits = Vec::new();
    for oid in walk.take(limit) {
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        let parents: Vec<String> = commit.parent_ids().map(|p| p.to_string()).collect();
        let mut ref_names: Vec<String> = Vec::new();
        for (ref_oid, name) in &commit_refs {
            if ref_oid == &oid.to_string() {
                ref_names.push(name.clone());
            }
        }
        let is_head = head.as_ref().and_then(|h| h.as_ref()) == Some(&oid.to_string());
        if is_head {
            ref_names.push("HEAD".into());
        }
        commits.push(CommitInfo {
            oid: oid.to_string(),
            short: oid.to_string()[..8.min(oid.to_string().len())].to_string(),
            message: commit.summary().unwrap_or("").to_string(),
            author: commit
                .author()
                .name()
                .map(|s| s.to_string())
                .unwrap_or_default(),
            time: commit.time().seconds(),
            parents,
            refs: ref_names,
        });
    }

    Ok(HistoryData { refs, commits })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn history_on_test_workspace() {
        let repo = Repository::open("/Users/tengyanxi/gitpad-test-workspace").unwrap();
        let h = history(&repo, 100).unwrap();
        assert!(!h.commits.is_empty());
        eprintln!("commits={} refs={:?}", h.commits.len(), h.refs);
        for c in &h.commits {
            eprintln!("{} {} parents={:?}", c.short, c.message, c.parents);
        }
    }
}
