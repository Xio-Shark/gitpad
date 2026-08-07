# M1 实施计划: Tauri 骨架 + 文件树

## 前置

- [x] Trellis 初始化、任务树（父任务 mvp 已规划）
- [ ] 本任务 review 通过后 `task.py start`

## 实施清单（顺序执行）

### 1. 脚手架与项目结构

- [ ] `npm create tauri-app@latest` 在当前目录初始化：name=gitpad、svelte-ts 模板、Tauri 2
- [ ] 迁移为 Svelte 5 runes 模式（模板若为 Svelte 4 legacy 语法）
- [ ] 安装依赖：`npm i @tauri-apps/api @tauri-apps/plugin-dialog`；Rust 侧 `cargo add ignore tauri-plugin-dialog tauri-plugin-log log`
- [ ] `tauri.conf.json`：窗口标题 GitPad、min size 800x500；注册插件（dialog、log）
- [ ] 三栏布局 App.svelte 骨架 + CSS 变量基础（深/浅色预留）

### 2. Rust 领域层 fs/tree.rs

- [ ] `AppError`（error.rs）：thiserror + Serialize `{code, message}`
- [ ] `tree::list(dir, show_hidden) -> Vec<DirEntry>`：WalkBuilder max_depth(1) 过滤（gitignore+hidden），`.git` 防御排除，node_modules overrides
- [ ] R1 验证测试：`tests/` 造临时目录（.gitignore 排除 *.log、secret/、node_modules）验证过滤语义；含 max_depth 边界用例
- [ ] `cargo test` 通过

### 3. Rust 命令层 commands/fs.rs

- [ ] `fs_list_dir` 命令 + 注册（lib.rs invoke_handler）
- [ ] `cargo fmt --check` + `cargo clippy -- -D warnings` 通过

### 4. 前端 api 与状态

- [ ] `src/lib/api.ts`：`fsListDir(path, showHidden)` + AppError 类型
- [ ] `src/lib/state.svelte.ts`：workspace 单例（rootPath、rootNode、展开缓存）
- [ ] `src/lib/settings.svelte.ts`：showHidden 开关单例

### 5. 文件树组件

- [ ] `FileTree.svelte` + `FileTreeItem.svelte`：惰性展开、展开状态缓存、忽略提示行（R2：根层"已隐藏 N 项"）
- [ ] 虚拟滚动：固定行高 24px + windowing 自研实现
- [ ] node_modules 开关 UI（状态栏/设置入口）→ settings.showHidden → 树重载（保留展开状态）
- [ ] 点击文件 → EditorPane 显示路径占位

### 6. 窗口模型与拖放

- [ ] WelcomeWindow：欢迎文案 + "选择文件夹"按钮（plugin-dialog）+ 拖放提示
- [ ] `onDragDropEvent`：文件夹拖入 → 打开 Workspace 新窗口（根路径传递）
- [ ] Workspace 窗口初始化状态 → 树渲染
- [ ] 多文件夹拖入 → 多窗口冒烟

### 7. 验证与收尾

- [ ] 生成 20k 文件测试目录，验证展开/滚动流畅
- [ ] 过滤验证：.gitignore 场景 + node_modules 开关切换
- [ ] `cargo fmt --check && cargo clippy -- -D warnings && cargo test`
- [ ] `npm run check && npm run lint && npm run build`
- [ ] 手动冒烟：启动 → 拖入 → 树 → 展开 → 点文件
- [ ] review gate：`task.py check` / 提交前 diff 自审
- [ ] `task.py finish`（触发 after_finish 钩子）

## 验证命令

```bash
npm run tauri dev          # 开发冒烟
cargo test                 # Rust 单测（过滤语义为核心）
cargo fmt --check && cargo clippy -- -D warnings
npm run check && npm run lint
```

## 回滚点

- 每步完成即提交（脚手架 → 领域层 → 命令层 → 前端树 → 窗口模型），单步失败可回退该步
- R1 过滤语义不确定时：先写测试探明行为再定实现，不猜测

## 交付物

- 可运行应用：欢迎窗 + 文件树（过滤、惰性、虚拟滚动、node_modules 开关）
- 后端过滤单测
- 布局骨架（三栏）+ 状态单例 + api.ts 接缝
