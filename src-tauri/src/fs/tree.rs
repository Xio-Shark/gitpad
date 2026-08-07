use std::path::Path;

use ignore::WalkBuilder;

use crate::error::AppError;

/// 单个目录条目（过滤后的可见子项）
#[derive(Debug, Clone, serde::Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
}

/// 目录树过滤配置
#[derive(Debug, Clone, Default)]
pub struct ListOptions {
    /// 是否显示隐藏文件/目录（.gitignore 语义之外的隐藏项，如 .DS_Store、.config）
    pub show_hidden: bool,
    /// 是否放行 node_modules 目录（默认隐藏）
    pub show_node_modules: bool,
}

/// 列出 `dir` 下过滤后的直接子条目。
///
/// 过滤规则（Q6 决策）：
/// - 默认隐藏 `.git` 与 `.gitignore` 命中的内容（ignore crate standard filters）
/// - `node_modules` 由 show_node_modules 独立控制
/// - 过滤全部在此处完成，前端不做过滤
pub fn list(dir: &Path, options: &ListOptions) -> Result<Vec<DirEntry>, AppError> {
    if !dir.exists() {
        return Err(AppError::NotFound(dir.display().to_string()));
    }
    if !dir.is_dir() {
        return Err(AppError::NotDirectory(dir.display().to_string()));
    }

    let mut builder = WalkBuilder::new(dir);
    builder
        .max_depth(Some(1))
        .follow_links(false)
        // 隐藏文件/node_modules 用手动过滤（见下方循环），保证特例可控
        .hidden(false)
        .parents(true)
        .ignore(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        // 非 git 仓库目录也加载 .gitignore（Sublime 行为，Q6 决策）
        .require_git(false);

    let mut entries = Vec::new();
    for result in builder.build() {
        let entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };
        // 根目录自身跳过（depth 0）
        if entry.depth() == 0 {
            continue;
        }
        let path = entry.path();
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        // 防御性排除：.git 永不显示
        if name == ".git" {
            continue;
        }
        // 隐藏文件：默认隐藏，但 .gitignore 永远可见（它是过滤规则的编辑入口）
        if !options.show_hidden && name.starts_with('.') && name != ".gitignore" {
            continue;
        }
        // node_modules：独立开关，默认隐藏（不依赖用户 .gitignore 是否写了它）
        if !options.show_node_modules && name == "node_modules" {
            continue;
        }
        entries.push(DirEntry {
            name,
            path: path.to_string_lossy().into_owned(),
            is_dir: entry.file_type().map(|t| t.is_dir()).unwrap_or(false),
            is_symlink: entry.file_type().map(|t| t.is_symlink()).unwrap_or(false),
        });
    }

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup(dir_name: &str) -> std::path::PathBuf {
        let root =
            std::env::temp_dir().join(format!("gitpad-test-{}-{}", dir_name, std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn lists_direct_children_with_dirs_first() {
        let root = setup("basic");
        fs::create_dir_all(root.join("sub")).unwrap();
        fs::write(root.join("a.txt"), "a").unwrap();
        fs::write(root.join("b.log"), "b").unwrap();

        let entries = list(&root, &ListOptions::default()).unwrap();
        let names: Vec<_> = entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["sub", "a.txt", "b.log"]);
        assert!(entries[0].is_dir);
    }

    #[test]
    fn hides_gitignore_matches() {
        let root = setup("gitignore");
        fs::create_dir_all(root.join("secret")).unwrap();
        fs::write(root.join("secret/keys.txt"), "k").unwrap();
        fs::write(root.join("x.log"), "x").unwrap();
        fs::write(root.join("keep.txt"), "k").unwrap();
        fs::write(root.join(".gitignore"), "*.log\nsecret/\n").unwrap();

        let entries = list(&root, &ListOptions::default()).unwrap();
        let names: Vec<_> = entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(
            names,
            vec![".gitignore", "keep.txt"],
            ".gitignore 自身永远可见"
        );
    }

    #[test]
    fn hides_git_directory_always() {
        let root = setup("dotgit");
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::write(root.join(".git/config"), "").unwrap();

        let entries = list(&root, &ListOptions::default()).unwrap();
        assert!(!entries.iter().any(|e| e.name == ".git"));

        let entries = list(
            &root,
            &ListOptions {
                show_hidden: true,
                ..Default::default()
            },
        )
        .unwrap();
        assert!(
            !entries.iter().any(|e| e.name == ".git"),
            ".git 即使在 show_hidden 下也不显示"
        );
    }

    #[test]
    fn node_modules_hidden_by_default_shown_when_enabled() {
        let root = setup("nm");
        fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        fs::write(root.join("node_modules/pkg/index.js"), "").unwrap();

        let entries = list(&root, &ListOptions::default()).unwrap();
        assert!(!entries.iter().any(|e| e.name == "node_modules"));

        let entries = list(
            &root,
            &ListOptions {
                show_node_modules: true,
                ..Default::default()
            },
        )
        .unwrap();
        assert!(entries.iter().any(|e| e.name == "node_modules"));
    }

    #[test]
    fn show_hidden_reveals_dotfiles() {
        let root = setup("hidden");
        fs::write(root.join(".env"), "").unwrap();
        fs::write(root.join("plain.txt"), "").unwrap();

        let entries = list(&root, &ListOptions::default()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "plain.txt");

        let entries = list(
            &root,
            &ListOptions {
                show_hidden: true,
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(entries.len(), 2);
    }

    #[test]
    fn listing_inside_ignored_dir_still_works() {
        // R1 探明：用户展开被 .gitignore 忽略的目录时，子项应正常列出
        let root = setup("ignored-inside");
        fs::create_dir_all(root.join("build/out")).unwrap();
        fs::write(root.join("build/out/file.txt"), "x").unwrap();
        fs::write(root.join(".gitignore"), "build/\n").unwrap();

        let entries = list(&root, &ListOptions::default()).unwrap();
        assert!(
            !entries.iter().any(|e| e.name == "build"),
            "build 默认被忽略"
        );

        // 直接列出被忽略目录本身
        let inside = list(&root.join("build"), &ListOptions::default()).unwrap();
        let names: Vec<_> = inside.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["out"], "被忽略目录内部仍可正常列出");
    }

    #[test]
    fn not_found_and_not_dir() {
        let root = setup("errors");
        assert!(matches!(
            list(&root.join("nope"), &ListOptions::default()),
            Err(AppError::NotFound(_))
        ));
        fs::write(root.join("f.txt"), "").unwrap();
        assert!(matches!(
            list(&root.join("f.txt"), &ListOptions::default()),
            Err(AppError::NotDirectory(_))
        ));
    }

    #[test]
    fn listing_500_entries_is_fast() {
        // 单层 500 项（树展开场景的上限量级）应在毫秒级完成
        let root = setup("perf");
        let sub = root.join("big");
        fs::create_dir_all(&sub).unwrap();
        for i in 0..500 {
            fs::write(sub.join(format!("f{i}.txt")), "x").unwrap();
        }
        let start = std::time::Instant::now();
        let entries = list(&sub, &ListOptions::default()).unwrap();
        let elapsed = start.elapsed();
        assert_eq!(entries.len(), 500);
        assert!(
            elapsed.as_millis() < 500,
            "500 项列出耗时 {elapsed:?}，超过 500ms"
        );
    }
}
