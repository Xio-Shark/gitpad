use git2::Repository;

use crate::error::AppError;

/// 从工作区路径发现 Git 仓库（向上查找 .git），非仓库返回错误
pub fn open_repo(workspace_path: &str) -> Result<Repository, AppError> {
    Repository::discover(workspace_path)
        .map_err(|_| AppError::NotGitRepository(workspace_path.to_string()))
}

/// 打开仓库并返回（不校验是否 git 目录，供 git_status 的 is_git 判断）
pub fn try_open_repo(workspace_path: &str) -> Option<Repository> {
    Repository::discover(workspace_path).ok()
}

/// 当前分支名（detached/unborn 时返回空）
pub fn current_branch(repo: &Repository) -> String {
    repo.head()
        .ok()
        .and_then(|head| head.shorthand().map(|s| s.to_string()))
        .unwrap_or_default()
}
