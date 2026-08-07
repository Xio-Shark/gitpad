//! hunk 级 stage / unstage（index 操作）

use git2::{Repository, Status, StatusOptions};

use crate::error::AppError;

use super::apply::{apply_hunks, HunkSpec};
use super::diff::file_diff;

fn read_workdir(repo: &Repository, rel_path: &str) -> Result<Option<String>, AppError> {
    let abs = repo
        .workdir()
        .ok_or_else(|| AppError::Git("仓库无工作目录".into()))?
        .join(rel_path);
    match std::fs::read_to_string(&abs) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(AppError::Io(e)),
    }
}

/// 将选中 hunks 从工作区应用到 index：
/// - 文件在 index 中：base = index blob，应用选中 hunk（未选中保持 index 版本）
/// - 未跟踪文件：base = 空
/// - 工作区文件已删除：从 index 移除（hunks 无意义）
pub fn stage(repo: &Repository, rel_path: &str, selected: &[bool]) -> Result<(), AppError> {
    // 删除的文件：直接从 index 移除
    let workdir_content = read_workdir(repo, rel_path)?;
    let mut index = repo.index()?;
    let Some(_workdir_text) = workdir_content else {
        index.remove_path(std::path::Path::new(rel_path))?;
        index.write()?;
        return Ok(());
    };

    // 未跟踪文件：base 为空
    let base = match index.get_path(std::path::Path::new(rel_path), 0) {
        Some(_) => {
            let blob = repo.find_blob(
                index
                    .get_path(std::path::Path::new(rel_path), 0)
                    .unwrap()
                    .id,
            )?;
            String::from_utf8_lossy(blob.content()).into_owned()
        }
        None => String::new(),
    };

    let diff = file_diff(repo, rel_path, false)?
        .ok_or_else(|| AppError::Git(format!("无法生成 {rel_path} 的 diff（文件可能未变更）")))?;

    // base 可能已含部分 staged 变更：diff 是 workdir vs index，index 内容即 base
    let specs: Vec<HunkSpec> = diff
        .hunks
        .iter()
        .map(|h| {
            let (old_start, _) = super::apply::parse_header(&h.header).unwrap_or((1, 0));
            HunkSpec {
                old_start,
                lines: &h.lines,
            }
        })
        .collect();

    if specs.len() != selected.len() {
        return Err(AppError::Git(
            "hunk 选择与 diff 不匹配，请刷新后重试".into(),
        ));
    }

    let merged = apply_hunks(&base, &specs, selected)
        .map_err(|e| AppError::Git(format!("{rel_path}: {e}")))?;

    write_index_blob(repo, &mut index, rel_path, &merged)?;
    index.write()?;
    Ok(())
}

/// 将内容写入 odb 并更新 index 条目
fn write_index_blob(
    repo: &Repository,
    index: &mut git2::Index,
    rel_path: &str,
    content: &str,
) -> Result<(), AppError> {
    let oid = repo.blob(content.as_bytes())?;
    let entry = git2::IndexEntry {
        ctime: git2::IndexTime::new(0, 0),
        mtime: git2::IndexTime::new(0, 0),
        dev: 0,
        ino: 0,
        mode: git2::FileMode::Blob.into(),
        uid: 0,
        gid: 0,
        file_size: content.len() as u32,
        id: oid,
        flags: 0,
        flags_extended: 0,
        path: rel_path.as_bytes().to_vec(),
    };
    index.add(&entry)?;
    Ok(())
}

/// 将选中 hunks 从 index 移回工作区（反向应用）：
/// - 有 HEAD：base = HEAD blob，反向应用（+/- 互换）到 index
/// - unborn HEAD（初始提交前）：index 中文件直接移除
pub fn unstage(repo: &Repository, rel_path: &str, selected: &[bool]) -> Result<(), AppError> {
    let mut index = repo.index()?;
    let head = repo.head().ok();
    let Some(head) = head else {
        // 初始提交前：unstage = 从 index 移除
        index.remove_path(std::path::Path::new(rel_path))?;
        index.write()?;
        return Ok(());
    };

    let head_tree = head.peel_to_tree()?;
    let base = match head_tree.get_path(std::path::Path::new(rel_path)) {
        Ok(entry) => {
            let blob = repo.find_blob(entry.id())?;
            String::from_utf8_lossy(blob.content()).into_owned()
        }
        Err(_) => String::new(), // HEAD 中不存在 → base 空
    };

    // staged diff（index vs HEAD）
    let diff = file_diff(repo, rel_path, true)?
        .ok_or_else(|| AppError::Git(format!("无法生成 {rel_path} 的暂存 diff")))?;

    let specs: Vec<HunkSpec> = diff
        .hunks
        .iter()
        .map(|h| {
            let (old_start, _) = super::apply::parse_header(&h.header).unwrap_or((1, 0));
            HunkSpec {
                old_start,
                lines: &h.lines,
            }
        })
        .collect();
    if specs.len() != selected.len() {
        return Err(AppError::Git(
            "hunk 选择与暂存 diff 不匹配，请刷新后重试".into(),
        ));
    }

    // 反向应用：index 中的内容 = base + 选中变更；unstage = base + 未选中变更
    // 等价于：对 base 应用「未选中」hunks（反向 diff 的选中集 = 未选中）
    let mut unselected = selected.to_vec();
    for s in unselected.iter_mut() {
        *s = !*s;
    }
    // 注意：staged diff 的 hunk 方向是 index vs HEAD（+ 表示 index 新增），
    // 反向应用时 '+/-' 语义需要互换：对 base 应用「选中 hunk 的反向」
    let merged = apply_hunks_reversed(&base, &specs, &unselected)
        .map_err(|e| AppError::Git(format!("{rel_path}: {e}")))?;

    write_index_blob(repo, &mut index, rel_path, &merged)?;
    index.write()?;
    Ok(())
}

/// 反向应用（unstage）：diff 是 base(HEAD)→index。
/// 选中 hunk = 恢复为 HEAD（- 恢复原行、+ 不插入）；未选中 = 保持 index（- 不输出、+ 插入）。
/// 行消耗规则：' ' 与 '-' 消耗 base 行；'+' 不消耗。
fn apply_hunks_reversed(
    base: &str,
    specs: &[HunkSpec],
    selected: &[bool],
) -> Result<String, String> {
    let base_lines: Vec<&str> = base.split_inclusive('\n').collect();
    let mut out: Vec<&str> = Vec::with_capacity(base_lines.len() + 16);
    let mut cursor = 0usize;
    for (i, spec) in specs.iter().enumerate() {
        let start0 = (spec.old_start as usize).saturating_sub(1);
        if start0 > base_lines.len() {
            return Err(format!("hunk {} 超出文件行数", i + 1));
        }
        for &l in &base_lines[cursor..start0] {
            out.push(l);
        }
        let mut pos = start0;
        for line in spec.lines {
            match line.kind {
                ' ' => {
                    let src = base_lines
                        .get(pos)
                        .ok_or_else(|| "上下文超出文件".to_string())?;
                    out.push(src);
                    pos += 1;
                }
                '-' => {
                    let src = base_lines
                        .get(pos)
                        .ok_or_else(|| "上下文超出文件".to_string())?;
                    if selected[i] {
                        out.push(src);
                    }
                    pos += 1;
                }
                '+' if !selected[i] => {
                    out.push(&line.text);
                }
                _ => {}
            }
        }
        cursor = pos;
    }
    for &l in &base_lines[cursor..] {
        out.push(l);
    }
    Ok(out.concat())
}

/// 文件是否处于"部分暂存"（staged + unstaged 同时存在）——前端 UI 需要
pub fn has_partial_state(repo: &Repository, rel_path: &str) -> Result<bool, AppError> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).include_ignored(false);
    let statuses = repo.statuses(Some(&mut opts))?;
    for entry in statuses.iter() {
        let p = entry.path().unwrap_or_default();
        if p == rel_path {
            let f = entry.status();
            let staged = f.intersects(Status::INDEX_NEW)
                || f.intersects(Status::INDEX_MODIFIED)
                || f.intersects(Status::INDEX_DELETED)
                || f.intersects(Status::INDEX_RENAMED);
            let unstaged = f.intersects(Status::WT_MODIFIED) || f.intersects(Status::WT_DELETED);
            return Ok(staged && unstaged);
        }
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::types::DiffLine;

    fn dl(text: &str, kind: char) -> DiffLine {
        DiffLine {
            kind,
            text: text.to_string(),
            old_no: None,
            new_no: None,
        }
    }

    fn spec(start: u32, lines: Vec<DiffLine>) -> HunkSpec<'static> {
        HunkSpec {
            old_start: start,
            lines: Box::leak(lines.into_boxed_slice()),
        }
    }

    #[test]
    fn reversed_restores_selected_and_keeps_unselected() {
        // HEAD: "a\nb\nc\n"，index 变更：b→bb（替换行），并新增 d
        // staged diff（index vs HEAD）：
        //   -b -> 删除（HEAD 有 index 无）
        //   +bb -> 新增（index 有 HEAD 无）
        //   +d -> 新增
        let base = "a\nb\nc\n";
        let h = spec(2, vec![dl("-b\n", '-'), dl("+bb\n", '+'), dl("+d\n", '+')]);
        // 选中 hunk unstage → 全部恢复 HEAD
        let out = apply_hunks_reversed(base, &[h], &[true]).unwrap();
        assert_eq!(out, "a\nb\nc\n");
    }

    #[test]
    fn reversed_partial() {
        // 两个 hunk：选中第一个 unstage，第二个保持 index
        let base = "a\nb\nc\nd\n";
        let h1 = spec(2, vec![dl("b\n", '-'), dl("bb\n", '+')]);
        let h2 = spec(4, vec![dl("d\n", '-'), dl("dd\n", '+')]);
        let out = apply_hunks_reversed(base, &[h1, h2], &[true, false]).unwrap();
        // h1 恢复为 "b"，h2 保持 "dd"
        assert_eq!(out, "a\nb\nc\ndd\n");
    }

    #[test]
    fn reversed_new_file_removal() {
        // HEAD 无此文件（base 空），index 全新增 → unstage = 全部移除
        let base = "";
        let h = spec(1, vec![dl("x\n", '+'), dl("y\n", '+')]);
        let out = apply_hunks_reversed(base, &[h], &[true]).unwrap();
        assert_eq!(out, "");
    }
}
