# M1 骨架: Tauri + 文件树

## Goal

GitPad 的第一块地基：Tauri 2 + Svelte 5 应用跑起来，拖入文件夹打开新窗口，显示带忽略规则过滤的文件树。为 M2-M5 提供布局骨架与文件树基础。

## Requirements

1. 项目初始化：Tauri 2 + Svelte 5 + TypeScript（create-tauri-app 或等效脚手架）
2. 窗口模型：多窗口，每窗口一个 Workspace；应用启动显示欢迎窗（拖入文件夹 / 选择文件夹按钮）
3. 拖放：macOS 文件拖入窗口 → 打开新窗口（该 Workspace 的根路径）；单窗口拖动多个文件夹 → 多个窗口
4. 文件树（Rust 侧 `fs_list_dir` 命令）：
   - 惰性加载：展开目录时才拉取该目录的子条目
   - 过滤规则（Q6 决策）：默认隐藏 `.git` 与 `.gitignore` 命中的内容；`node_modules` 独立开关（默认隐藏，可开）
   - 过滤全部在 Rust 侧，前端零过滤
5. 前端 FileTree 组件：Svelte 5 runes + 虚拟滚动（万级文件目录不卡）
6. 三栏布局骨架：文件树 | 编辑区占位（M2 接入 CM6）| Git 面板占位（M5）
7. 架构接缝：`api.ts` 统一 invoke 封装、窗口级状态单例 `state.svelte.ts`、Rust 命令注册表（为插件系统预留）
8. 点击树中文件 → 编辑区显示文件路径占位（真实打开编辑是 M2）

## Acceptance Criteria

- [ ] `tauri dev` 启动出欢迎窗
- [ ] 拖入文件夹 → 新窗口显示文件树，窗口标题/状态栏显示根路径
- [ ] 树默认不显示 `.git` 目录与 .gitignore 命中的文件/目录
- [ ] 设置/菜单切换 node_modules 可见性即时生效（开关状态是窗口级）
- [ ] 展开含 1 万+ 条目的目录（如 node_modules 打开时）不卡顿（虚拟滚动生效）
- [ ] 点击文件 → 编辑区显示路径占位
- [ ] 后端：`cargo fmt --check`、`cargo clippy -- -D warnings`、`cargo test` 通过
- [ ] 前端：`npm run check`、`npm run lint` 通过

## Notes

- 依赖：Rust 侧 `ignore` crate（ripgrep walker，.gitignore 语义）、`tauri-plugin-dialog`（欢迎窗选文件夹按钮）
- 不引入拖拽库：Tauri 原生 onDragDropEvent
- 多窗口共享后端进程，但每窗口独立 Workspace 状态（不跨窗口同步）
- 虚拟滚动：优先自研轻量实现（树行高固定），不引重库；卡顿再评估 @tanstack/svelte-virtual
