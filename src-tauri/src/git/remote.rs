use git2::{
    AutotagOption, Cred, CredentialType, FetchOptions, PushOptions, RemoteCallbacks, Repository,
    Signature,
};

use crate::error::AppError;

fn signature(repo: &Repository) -> Result<Signature<'static>, AppError> {
    if let Ok(sig) = repo.signature() {
        return Ok(sig);
    }
    let cfg = repo
        .config()
        .map_err(|e| AppError::Git(e.message().to_string()))?;
    let name = cfg.get_string("user.name").ok();
    let email = cfg.get_string("user.email").ok();
    match (name, email) {
        (Some(n), Some(e)) => {
            Signature::now(&n, &e).map_err(|err| AppError::Git(err.message().to_string()))
        }
        _ => Err(AppError::Git(
            "缺少提交者信息：请配置 git config user.name / user.email".into(),
        )),
    }
}

pub fn commit(repo: &Repository, message: &str) -> Result<String, AppError> {
    let message = message.trim();
    if message.is_empty() {
        return Err(AppError::Git("提交信息不能为空".into()));
    }
    let sig = signature(repo)?;
    let mut index = repo.index()?;
    let tree = index.write_tree()?;
    let tree_obj = repo.find_tree(tree)?;

    let parent = match repo.head() {
        Ok(head) => {
            let parent_commit = head.peel_to_commit()?;
            Some(parent_commit)
        }
        Err(_) => None,
    };

    let oid = match parent {
        Some(parent_commit) => repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            message,
            &tree_obj,
            &[&parent_commit],
        )?,
        None => repo.commit(Some("HEAD"), &sig, &sig, message, &tree_obj, &[])?,
    };
    Ok(oid.to_string())
}

fn credentials_cb(
    url: &str,
    username: Option<&str>,
    allowed: CredentialType,
) -> Result<Cred, git2::Error> {
    let username = username.unwrap_or("git");
    if allowed.contains(CredentialType::SSH_KEY) {
        if let Ok(cred) = Cred::ssh_key_from_agent(username) {
            return Ok(cred);
        }
    }
    if allowed.contains(CredentialType::USER_PASS_PLAINTEXT) {
        // 走系统凭据 helper（macOS keychain / git credential-store 等）
        if let Ok(cfg) = git2::Config::open_default() {
            if let Ok(cred) = Cred::credential_helper(&cfg, url, Some(username)) {
                return Ok(cred);
            }
        }
    }
    if allowed.contains(CredentialType::DEFAULT) {
        return Cred::default();
    }
    Err(git2::Error::from_str(
        "无法获取凭据：请配置 SSH agent 或系统凭据",
    ))
}

fn remote_with_callbacks<'a>(
    repo: &'a Repository,
    name: &str,
) -> Result<(git2::Remote<'a>, RemoteCallbacks<'a>), AppError> {
    let remote = repo.find_remote(name)?;
    let mut cb = RemoteCallbacks::new();
    cb.credentials(credentials_cb);
    Ok((remote, cb))
}

pub fn push(repo: &Repository, remote_name: &str) -> Result<String, AppError> {
    let head = repo.head()?;
    let branch = head
        .shorthand()
        .ok_or_else(|| AppError::Git("当前不在分支上，无法推送".into()))?
        .to_string();
    if branch.is_empty() || branch.starts_with("HEAD") {
        return Err(AppError::Git("当前不在分支上，无法推送".into()));
    }
    let (mut remote, cb) = remote_with_callbacks(repo, remote_name)?;
    let refspec = format!("refs/heads/{branch}:refs/heads/{branch}");
    let mut opts = PushOptions::new();
    opts.remote_callbacks(cb);
    remote.push(&[&refspec], Some(&mut opts))?;
    Ok(branch)
}

pub fn pull(repo: &Repository, remote_name: &str) -> Result<String, AppError> {
    let head = repo.head()?;
    let branch_name = head
        .shorthand()
        .ok_or_else(|| AppError::Git("当前不在分支上，无法拉取".into()))?
        .to_string();

    let (mut remote, cb) = remote_with_callbacks(repo, remote_name)?;
    let fetch_refspec =
        format!("refs/heads/{branch_name}:refs/remotes/{remote_name}/{branch_name}");
    let mut fopts = FetchOptions::new();
    fopts.remote_callbacks(cb);
    fopts.download_tags(AutotagOption::All);
    remote.fetch(&[&fetch_refspec], Some(&mut fopts), None)?;

    let remote_ref = repo.find_reference(&format!("refs/remotes/{remote_name}/{branch_name}"))?;
    let remote_oid = remote_ref
        .target()
        .ok_or_else(|| AppError::Git("远端引用异常".into()))?;

    let head_oid = head.target();
    if head_oid == Some(remote_oid) {
        return Ok("已是最新".into());
    }

    let analysis = repo.merge_analysis(&[&repo.find_annotated_commit(remote_oid)?])?;
    if analysis.0.is_fast_forward() {
        let mut head_ref = repo.find_reference("HEAD")?;
        head_ref.set_target(
            remote_oid,
            &format!("pull {remote_name} {branch_name}: fast-forward"),
        )?;
        let mut index = repo.index()?;
        let obj = repo.find_object(remote_ref.peel_to_tree()?.id(), None)?;
        repo.checkout_tree(&obj, None)?;
        index.write()?;
        return Ok("已更新（fast-forward）".into());
    }

    Err(AppError::Git(
        "本地与远端已分叉，自动合并不在本版本支持范围：请在终端手动 git merge / rebase 后重试"
            .into(),
    ))
}
