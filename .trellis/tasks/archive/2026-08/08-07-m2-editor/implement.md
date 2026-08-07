# M2 实施计划: 文件打开域

## 前置

- [x] M1 完成（文件树 + 布局骨架 + EditorPane 占位）
- [x] 父任务 prd 已更新（文件格式支持需求）
- [ ] 本任务 review 通过后 `task.py start`

## 实施清单（顺序执行）

### 1. Rust 命令层扩展

- [ ] `AppError::FileTooLarge { limit }` 变体（error.rs）
- [ ] `fs_read_file`：大小预检（10MB）+ UTF-8 校验（R4 编码提示）+ BOM 剥离
- [ ] `fs_write_file`：原子写（tmp + rename），失败清理
- [ ] 单测：大小预检、BOM、原子写（成功与失败路径）
- [ ] `cargo fmt/clippy/test` 通过

### 2. 前端基础设施

- [ ] `utils/filetype.ts`：classify(path) + 扩展名表
- [ ] `utils/windowing.ts`：从 M1 文件树抽出的虚拟滚动工具（M2 表格复用）
- [ ] `state.svelte.ts` 扩展：tabs、activeTabId、dirty 逻辑
- [ ] `api.ts`：fsReadFile / fsWriteFile 封装 + FileTooLarge 错误分支

### 3. 标签页管理

- [ ] TabBar 组件（M1 布局的编辑区顶部）：打开/切换/关闭/同 path 去重
- [ ] dirty 标记 + 关闭确认
- [ ] 快捷键：Cmd+W 关闭、Cmd+数字 切换

### 4. 文本渲染器

- [ ] TextRenderer.svelte + cm6.ts：CM6 实例管理（$effect + cleanup）
- [ ] 语言映射表（~15 包）+ 动态 import + Compartment reconfig
- [ ] Cmd+S 保存 + 失败 toast
- [ ] 多标签切换时 CM6 正确挂载/卸载（R1：先保 view 内存版）

### 5. 图片渲染器

- [ ] ImageRenderer.svelte：convertFileSrc + asset scope 配置（R2）
- [ ] 自适应缩放 + 1:1 切换；加载失败占位
- [ ] 验证 gif 动图 / svg / 损坏图片

### 6. CSV 渲染器

- [ ] CsvRenderer.svelte：papaparse 解析（header 判定、delimiter auto）
- [ ] 表格视图（虚拟滚动 + 表头）
- [ ] 双模式切换（复用 TextRenderer 作文本模式）
- [ ] >20MB 降级 + 解析失败提示
- [ ] 自测 5 万行 CSV（含引号内逗号/换行）

### 7. 分发接入

- [ ] EditorPane 从 M1 占位改为 dispatch 组件（text/image/csv/pdf 占位/unknown toast）
- [ ] pdf 占位面板（提示 M4 实现）
- [ ] 端到端冒烟：树点击 → 各类型文件 → 正确渲染

### 8. 验证与收尾

- [ ] `npm run check && npm run lint`
- [ ] 手动冒烟清单：文本编辑保存 / 高亮 / 图片 / CSV 双模式 / 大文件 / 二进制
- [ ] review gate + `task.py finish`

## 验证命令

```bash
npm run tauri dev
cargo test && cargo fmt --check && cargo clippy -- -D warnings
npm run check && npm run lint
```

## 回滚点

- 每步完成后提交；分发接入（第 7 步）前各渲染器独立可用
- R2 asset protocol 失败 → 图片渲染器退回 base64 方案（不阻塞其他步骤）

## 交付物

- 完整文件打开域：多标签页 + 文本/图片/CSV 渲染器 + 分发 + 阈值保险丝
- filetype.ts 分发表（M6 插件扩展点）
