# Journal - xioshark (Part 1)

> AI development session journal
> Started: 2026-08-07

---

## 2026-08-07 M1 会话记录

- 环境：rustc 1.97.1（本次新装 rustup）、node 24、npm 11（allow-scripts 需批准 esbuild/fsevents）
- M1 完成：脚手架 + Rust 过滤层 + 前端文件树 + 窗口模型
- 关键实现经验：
  - ignore crate `require_git(false)` 才在非 git 目录加载 .gitignore
  - hidden 过滤改手动（保证 .gitignore 可见、node_modules 特例）
  - tauri-plugin-log v2.9: Target::new(TargetKind::Stdout/Webview)（不是常量）
  - blocking_pick_folder 返回 FilePath 需 into_path()
  - capability windows 需匹配 "workspace-*"
  - SvelteKit 多窗口用 URL query 传 path
- 待用户 GUI 冒烟：拖放/选文件夹/树交互/开关
