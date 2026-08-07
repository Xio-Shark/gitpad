# M2 文件打开域: 文本编辑 + 图片 + CSV + 格式分发

## Goal

"文件树点击 → 标签页展示"的完整机制：按文件类型分发到对应渲染器。文本类可编辑保存（CM6 + 语法高亮），图片类标签页渲染，CSV 支持表格视图，二进制拒绝，大文件有保险丝。

## Requirements

### 1. 标签页管理（M2 基础）

- 多标签页：打开文件 → 新标签页；同文件只开一个（聚焦已有）；可关闭、可切换（Cmd+1..9 / 鼠标）
- 标签页状态：未保存修改标记（圆点）、文件名 + 图标（按类型）

### 2. 格式分发（format dispatch）

- 点击文件（M1 的 EditorPane 占位）→ 按扩展名分发到渲染器
- 分发规则表（前端 utils/filetype.ts，与 Rust 侧无耦合）：
  - 文本类：按语言映射表 → 文本渲染器
  - 图片扩展名（png/jpg/jpeg/gif/svg/webp/ico/bmp/avif）→ 图片渲染器
  - pdf → PDF 渲染器（占位，M4 实现；M2 阶段点击提示"M4 待实现"或直接显示占位面板）
  - csv → CSV 渲染器
  - 其他 → 拒绝并 toast 提示"不支持的格式"

### 3. 文本渲染器（CM6）

- 打开：Rust `fs_read_file` 返回字符串；**拒绝前检查大小**（>10MB → 错误"文件过大，建议外部工具"）
- 语言高亮：扩展名→CM6 语言包映射表（~15 官方包：js/ts/jsx/tsx/json/css/html/markdown/python/java/rust/go/c/cpp/shell/sql/yaml/xml/php/ruby），动态 `import()` 懒加载；未映射 → 纯文本（无高亮，可编辑）
- 编辑 + 保存：Cmd+S 保存（`fs_write_file`）；未保存标记；关闭未保存标签 → 确认提示
- 自动探测：无扩展名/罕见扩展名 → 按内容嗅探（可选，M2 若简单则仅扩展名映射）

### 4. 图片渲染器

- `<img>` 加载（svg 也走 `<img>`，不执行脚本），居中 + 适应窗口缩放 + 点击切原始尺寸
- 加载失败（损坏文件）→ 显示错误占位
- 不提供编辑

### 5. CSV 渲染器（双模式）

- 模式切换：标签页工具栏"表格 / 文本"切换；默认表格
- 表格模式：解析（引号内逗号/转义，papaparse）→ 只读表格（首行表头加粗、列对齐、虚拟滚动，>1 万行不卡）
- 文本模式：复用文本渲染器（可编辑）
- 大文件：>20MB 时表格模式不可用（降级只读文本，提示原因）
- 解析失败（非严格 CSV）→ 提示"解析失败，已按文本打开"

### 6. Rust 命令

- `fs_read_file(path)` → `Result<String, AppError>`（含大小预检）
- `fs_write_file(path, content)` → 原子写（临时文件 + rename）
- 大小检查在 Rust 侧（元数据），命令返回错误码 `FileTooLarge { limit }`

## Acceptance Criteria

- [ ] 点击树中文本文件 → 新标签页打开可编辑；Cmd+S 保存；未保存标记与关闭确认生效
- [ ] js/ts/json/rs/py/go 等映射语言有高亮；未知扩展名纯文本可编辑
- [ ] 图片标签页渲染（含 gif 动图、svg）；损坏图片显示错误占位
- [ ] CSV 默认表格视图，可切文本；含引号内逗号/换行的 CSV 解析正确；5 万行表格滚动流畅
- [ ] >10MB 文本拒绝打开并提示；>20MB CSV 表格不可用降级文本
- [ ] zip/exe 等二进制拒绝并提示
- [ ] 后端 `cargo fmt/clippy/test` 通过；前端 `npm run check/lint` 通过

## Notes

- 依赖：`@codemirror/lang-*`（按需）、papaparse（CSV 解析）、CM6 已有
- pdf 在 M2 显示占位（分发规则留好接缝，M4 填实现）
- md 文件在 M2 走文本渲染器，M3 加预览
- 分发规则表集中在 `utils/filetype.ts` 单文件，插件系统（M6）未来在此扩展
