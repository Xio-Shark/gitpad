# GitPad MVP

## Goal

构建 GitPad：轻量本地优先的编辑器 + Git 客户端（macOS），面向个人开发者自用，开箱即用、启动快、不重。对标 Sublime Text 的轻量 + Fork 的 Git 体验，不做成 VS Code 量级。

## Requirements

### 产品决策（grill 会话已确认，见 CONTEXT.md 与 docs/adr/0001-git2-libgit2.md）

- 用户画像：个人开发者自用
- 平台：macOS 独占，代码保持跨平台无污染（不用 Swift/AppKit 原生 UI）
- 技术栈：Tauri 2 + Svelte 5 + CodeMirror 6；Git 后端 git2 (libgit2)
- 窗口模型：多窗口，每窗口一个 Workspace（拖入文件夹即开窗口）
- 文件树：默认隐藏 .git 与 .gitignore 命中项，node_modules 独立开关；过滤在 Rust 侧
- Markdown：并排实时预览（markdown-it + KaTeX + mermaid + 代码高亮），MVP 不做滚动同步
- PDF：pdf.js 在编辑器标签页内渲染
- Git 面板：提交历史 + gitgraph 分支可视化图 + 工作区 diff + hunk 级 stage/unstage + commit + push/pull；不做 rebase/merge 冲突界面/stash/cherry-pick/submodule/blame
- 插件：命令式轻插件（JS，quickjs 嵌入，~/.tauri-git/plugins/*.js），MVP 之后做；M1-M5 期间预留命令注册表 + 事件总线接缝
- 发布：GitHub Releases 手动上传 dmg，不做 CI 打包

### 功能需求

1. 拖入整个文件夹 → 打开新窗口，显示文件树
2. 文件树可打开任意文件到编辑器标签页（文本编辑 + 保存）
3. Markdown 并排实时预览
4. PDF 在标签页内渲染（搜索/缩放工具栏按钮）
5. Git 面板：历史 + 分支图 + 工作区 diff + hunk stage + commit + push/pull

### 文件格式支持（grill 会话 2026-08-07 确认）

**分层**：
- 文本类（代码/md/csv/json/log/yaml…）→ 文本渲染器（CM6 编辑 + 保存），语言高亮按扩展名映射懒加载，未映射走纯文本
- 图片类 → 标签页 `<img>` 渲染（只读）：png/jpg/jpeg/gif/svg/webp/ico/bmp/avif；svg 一律用 `<img>` 加载（不执行脚本）
- PDF → pdf.js 标签页渲染
- CSV → 双模式：文本编辑 + 一键切换只读表格视图（解析器处理引号内逗号/转义，表格虚拟滚动）
- 其他二进制 → 拒绝打开并提示"不支持"

**大文件阈值**（Rust 侧常量，集中配置）：
- 文本/代码 > 10MB → 拒绝打开，提示用外部工具
- CSV 表格视图 > 20MB → 降级为纯文本只读

## Task Map

- M1 (m1-skeleton)：Tauri 骨架 + 拖入文件夹 → 文件树（虚拟化 + 忽略规则）
- M2 (m2-editor)：文件打开域——文本编辑（CM6 + 语言映射）+ 多标签页 + 图片渲染 + CSV 双模式 + 二进制拒绝 + 大文件阈值
- M3 (m3-markdown)：Markdown 并排预览
- M4 (m4-pdf)：PDF 标签页预览
- M5 (m5-git)：Git 面板（gitgraph + history + diff + hunk stage + commit + push/pull）
- M6 (m6-plugins)：插件系统（quickjs 嵌入 + 命令注册表 + 事件总线）

依赖顺序：M1 → M2 → M3 → M4 → M5 → M6（顺序执行，前序为后续提供基础；M5 依赖 M1/M2 的布局与编辑能力）

## Acceptance Criteria

- [ ] 拖入文件夹能打开文件树，过滤规则生效（.git/.gitignore 隐藏、node_modules 开关）
- [ ] 文本文件可编辑保存，多标签页切换；常见代码格式有语法高亮（js/ts/json/rs/py 等）
- [ ] 图片（png/jpg/gif/svg 等）标签页内渲染；二进制文件拒绝打开并提示
- [ ] CSV 可在表格视图与文本编辑间切换
- [ ] 超过阈值的大文件被拒绝/降级，不卡死
- [ ] md 文件并排实时预览渲染正确（KaTeX/mermaid/代码高亮）
- [ ] PDF 标签页内渲染、缩放、搜索
- [ ] Git 面板可用：历史、分支图、diff、hunk stage、commit、push/pull
- [ ] 应用启动快、内存占用低（自测主观达标）
- [ ] 架构上预留插件接缝（命令注册表 + 事件总线）

## Notes

- 每个子任务独立 prd，验收在子任务层面细化
- M5 gitgraph 是最大风险项，设计阶段单独研究布局算法
- 代码跨平台无污染：路径处理、文件系统调用保持跨平台写法
