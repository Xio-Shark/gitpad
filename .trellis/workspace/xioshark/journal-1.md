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

## 2026-08-07 M2 会话记录

- M2 完成：标签页 + 文本/图片/CSV 渲染器 + 分发
- 关键实现经验：
  - Tauri 2 asset protocol：tauri.conf.json 的 app.security.assetProtocol（非 capability）+ tauri crate 需 protocol-asset feature
  - CSV 20MB > 文本 10MB 限制矛盾 → fs_read_file 加 max_size 参数（实现偏差已记录 prd）
  - eslint svelte/require-each-key：虚拟滚动行用 (range.start+i) 作 key
  - svelte-check 对 .svelte.ts 的 $state 编译宏：eslint 需单独 parser 配置
- 待用户 GUI 冒烟：文本编辑保存/高亮、图片、CSV 双模式、大文件、二进制
