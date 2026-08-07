# M1 设计: Tauri 骨架 + 文件树

## 架构概览

```
┌─────────────────────── Tauri 2 WebView (Svelte 5) ───────────────────────┐
│ App.svelte 三栏布局                                                        │
│ ┌──────────────┬───────────────────────┬──────────────┐                    │
│ │ FileTree      │ EditorPane (占位)     │ GitPanel 占位 │                    │
│ │ (虚拟滚动+惰性) │                       │              │                    │
│ └──────────────┴───────────────────────┴──────────────┘                    │
│      │ invoke('fs_list_dir', {path, showHidden})          │                 │
└──────┼───────────────────────────────────────────────────┼─────────────────┘
       ▼                                                   ▼
┌────────────────── Rust 命令层 (commands/fs.rs) ───────────────────────────┐
│ fs_list_dir(dir, show_hidden) -> Vec<DirEntry>            │                 │
└─────────────────── 领域层 (fs/tree.rs) ────────────────────┘                │
│ 单层列举 + Gitignore 过滤（ignore crate）                                  │
└────────────────────────────────────────────────────────────────────────────┘
```

## 关键设计决策

### 1. 文件树惰性加载与过滤（fs/tree.rs）

**语义**：`fs_list_dir(dir)` 返回该目录下**过滤后的直接子条目**。展开时按需调用，不递归。

**过滤实现**：用 `ignore` crate 分两层：
- 用 `ignore::WalkBuilder::new(dir).max_depth(Some(1))` 跑一遍，自带 `.gitignore`（standard_filters 语义：gitignore + hidden + parents）——负责"该目录下哪些条目可见"
- `.git` 目录：WalkBuilder 的 hidden 过滤已覆盖（`.git` 是 hidden 目录，gitignore 语义也会忽略自身内部）；若 hidden 开关未来要放开，单独在 `tree.rs` 显式排除 `.git`（防御性写死：`.git` 永远不显示，除非未来有"显示所有"设置）

**node_modules 开关**：不修改 WalkBuilder 配置（避免每次开关重建），而是开关=附加过滤器 `overrides`：开关开 → 放行名为 node_modules 的目录（自身可见、可展开）；开关关 → 走默认 gitignore 行为。实现时验证 `max_depth(1)` + overrides 组合的行为（尤其：被忽略的目录在 max_depth 下是否仍能列出其子项——不能则改用手工列目录 + 逐项 Gitignore::matched 判断，保证"用户展开被忽略目录"的边界可预期）。

**边界行为**（实现必须保持）：
- 用户展开任意可见目录 → 返回过滤后子条目
- `.git` 内部永远不进树
- 忽略的目录节点仍显示但标记为忽略（灰显 + 说明），允许手动展开查看（Sublime 行为）——**待确认**：MVP 直接隐藏还是灰显？见风险 R2

### 2. 命令层（commands/fs.rs）

```rust
#[tauri::command]
fn fs_list_dir(dir: PathBuf, show_hidden: bool) -> Result<Vec<DirEntry>, AppError>
// DirEntry { name: String, path: String, is_dir: bool, is_symlink: bool }
```
- 领域函数 `tree::list(dir, show_hidden)` 不依赖 tauri，纯 Rust 可单测
- 路径参数化：前端永远传绝对路径，Rust 侧不解析相对路径

### 3. 窗口模型

- 欢迎窗（WelcomeWindow）：`onDragDropEvent` 收到文件夹 → `WebviewWindowBuilder::new` 创建 Workspace 窗口，把根路径经 `window.__TAURI_INTERNALS__` 或 URL query 传给新窗口；再让欢迎窗后台保持（Cmd+W 可关）
- Workspace 窗口：收到根路径 → 初始化窗口级状态单例（state.svelte.ts）→ FileTree 渲染根
- 每窗口独立 state 单例：Svelte 模块级 `$state` 天然按 webview 实例隔离，无需额外处理

### 4. 前端 FileTree（Svelte 5）

- 树数据模型：`TreeNode { name, path, isDir, children?: TreeNode[], loaded: boolean, ignored: boolean }`，children 惰性填充
- 虚拟滚动：固定行高（24px）+ 自研 windowing（visibleRange 计算），内容区用 padding 占位。不引库
- 展开目录：`onclick` → 若未 loaded → `api.fsListDir(path)` → 填充 children（$state 更新）
- 开关 node_modules：窗口级设置单例 `settings.svelte.ts` → `$derived` 触发 FileTree 重载根（invoke 带 show_hidden 参数）——实现上重拉当前展开路径的子树（或简单方案：重载根，展开状态保留在 TreeNode 里）
- 展开状态保留：TreeNode 存于状态单例，重载时按 path 合并（保留已展开子树的 children 缓存）

### 5. 布局与组件划分

- `App.svelte`：三栏 CSS grid（树 240px | 编辑区 1fr | Git 占位 280px 可折叠）
- `FileTree.svelte`：容器组件（持有树状态）
- `FileTreeItem.svelte`：单行展示组件
- `EditorPane.svelte`：M1 显示"点击文件路径"占位
- `api.ts`：`fsListDir(path, showHidden)` 封装
- `state.svelte.ts`：`workspace { rootPath, rootNode }` 单例
- `settings.svelte.ts`：`showHidden` 开关单例（窗口级）

### 6. 配置与脚手架

- create-tauri-app：`npm create tauri-app@latest` → svelte-ts 模板 → 迁移 Svelte 5 runes 模式
- 依赖：`ignore`（Rust）、`tauri-plugin-dialog`（欢迎窗"选择文件夹"按钮）、`tauri-plugin-log`（Rust 日志进 webview console）
- macOS entitlements：无特殊需求；拖放需要 `tauri.conf.json` 无额外配置（onDragDropEvent 默认可用）

## 数据流示例

```
用户拖入 ~/notes
→ WelcomeWindow.onDragDropEvent → 新窗口(WorkspaceWindow, root=~/notes)
→ state.workspace.rootPath = ~/notes
→ FileTree 挂载 → api.fsListDir('~/notes', false)
→ [notes 过滤后子条目] → TreeNode 填充
→ 用户点击 node_modules（开关关时灰显/隐藏）
→ 开关开 → settings.showHidden=true → 根重载 → node_modules 可见
```

## 风险与对策

- **R1 ignore crate 单层语义**：max_depth(1) 对忽略目录内条目的行为不明确 → 实现第一步先写验证测试（临时目录造 .gitignore 场景），确定后固定实现。失败则回退手工 Gitignore::matched 逐项过滤
- **R2 忽略项的呈现**（隐藏 vs 灰显可展开）：MVP 采用**默认隐藏 + 树根提示行"已按 .gitignore 隐藏 N 项"**，不做灰显（灰显需要额外状态路径）。node_modules 例外：默认隐藏。若用户后续要求，M1 后小版本加灰显
- **R3 拖放大目录**：拖入 50 万文件目录 → 根加载卡？根层只列第一层，惰性保证安全；但欢迎窗拖入时快速列出根层即可
- **R4 多窗口 + 状态**：每窗口独立 module 实例，无共享问题；确认 Tauri 多窗口事件（open 新窗）不阻塞

## 验收映射

- 万级目录不卡：自测脚本生成 20k 文件测试目录验证展开/滚动
- 过滤正确：测试目录含 .gitignore（排除 *.log、secret/）+ node_modules → 验证树中不可见
