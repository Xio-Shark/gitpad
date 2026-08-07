# M2 设计: 格式分发与渲染器

## 架构概览

```
文件树点击
   │
   ▼
dispatch.ts: 扩展名 → 渲染器类型  (utils/filetype.ts 查表)
   │
   ├─ text   → TextRenderer (CM6 + 语言懒加载)
   ├─ image  → ImageRenderer (<img> 缩放)
   ├─ csv    → CsvRenderer (表格⇄文本双模式)
   ├─ pdf    → PdfRenderer 占位 (M4 实现)
   └─ other  → toast 拒绝

标签页管理 (TabsStore)：path → Tab{ type, state, dirty }
```

## 关键设计决策

### 1. 标签页状态（state.svelte.ts）

```ts
interface Tab {
  id: string            // path 哈希
  path: string
  kind: 'text' | 'image' | 'csv' | 'pdf' | 'unknown'
  dirty: boolean
  savedContent?: string  // text/csv 文本模式的内容（dirty 对照）
}
```
- `tabs: Tab[]` + `activeTabId` 为窗口级 `$state`
- 同 path 打开 → 聚焦已有 tab（不重复）
- 关闭 dirty tab → confirm 对话框

### 2. 文本渲染器（TextRenderer.svelte + cm6.ts）

- CM6 实例管理：每 tab 一个 EditorView；`$effect` 里按 activeTab 挂载/卸载（runes-guidelines：cleanup 必须 destroy view）
- 语言懒加载：

```ts
const LANG_MAP: Record<string, () => Promise<LanguageSupport>> = {
  rs: () => import('@codemirror/lang-rust').then(m => m.rust()),
  py: () => import('@codemirror/lang-python').then(m => m.python()),
  ...
}
// 加载后 editor.dispatch({ effects: Compartment.reconfigure })
```
- compartment 技术：语言包装进独立 Compartment，加载完成后再 reconfig，不重建 view
- 保存流程：Cmd+S → `api.fsWriteFile(path, doc.toString())` → dirty=false；失败 toast 保留 dirty

### 3. CSV 渲染器（CsvRenderer.svelte）

- 解析：papaparse（`delimiter: auto`，header 判定取首行；引号转义由 papaparse 处理）
- 表格：`<table>` + 虚拟滚动（固定行高 28px，windowing 与 M1 文件树同款工具函数复用——抽到 `utils/windowing.ts`）
- 模式切换：tab 内 toolbar；切换不丢已解析数据（缓存）
- 降级：>20MB → 表格模式按钮禁用 + 提示；解析失败 → 提示后停留在文本模式
- 文本模式 = 复用 TextRenderer（同一 tab 内切换渲染器组件，CM6 实例按需创建）

### 4. 图片渲染器（ImageRenderer.svelte）

- `<img src=asset>`：Tauri 下用 `convertFileSrc(path)`（asset protocol，需 capabilities 允许 asset scope）或 Rust 命令返回 base64（>5MB 图片 base64 慢）→ **用 convertFileSrc + asset protocol**
- 缩放：`object-fit: contain` 容器内自适应；双击/按钮切换 1:1 与适应
- svg：同样走 convertFileSrc，`<img>` 加载不执行脚本

### 5. Rust 命令（commands/fs.rs 扩展）

```rust
const MAX_TEXT_SIZE: u64 = 10 * 1024 * 1024;   // 文本/代码
const MAX_CSV_TABLE_SIZE: u64 = 20 * 1024 * 1024;

#[tauri::command]
fn fs_read_file(path: PathBuf) -> Result<String, AppError>
// 错误码：FileTooLarge { limit }、NotFound、Io

#[tauri::command]
fn fs_write_file(path: PathBuf, content: String) -> Result<(), AppError>
// 原子写：同目录 .tmp-{rand} → rename；失败清理临时文件
```
- 大小预检：`fs::metadata().len()` 在读取前；超限直接返回 FileTooLarge
- 错误结构扩展：`AppError::FileTooLarge { limit: u64 }` → 前端 code 分支显示"文件 {size} 超过限制 {limit}"

### 6. 分发表（utils/filetype.ts）

```ts
const IMAGE_EXTS = new Set(['png','jpg','jpeg','gif','svg','webp','ico','bmp','avif'])
const TEXT_MAP: Record<string, LangKey>  // ~30 扩展名 → 语言
// classify(path): 'text' | 'image' | 'csv' | 'pdf' | 'unknown'
```
- 单文件、纯函数、无依赖 → M6 插件系统扩展点（注册新扩展名）

## 数据流示例

```
点击 notes/数据.csv (3MB)
→ dispatch → csv → CsvRenderer
→ api.fsReadFile → 字符串 (Rust 侧 3MB < 20MB OK)
→ papaparse 解析 → { header, rows }
→ 表格渲染（虚拟滚动）
→ 用户切文本模式 → CM6 实例创建 → 编辑 → Cmd+S → fsWriteFile
```

```
点击 big.bin (100MB)
→ dispatch → unknown → toast "不支持的格式 big.bin"
```

```
点击 huge.log (50MB)
→ fsReadFile → AppError::FileTooLarge → toast "文件过大(50MB > 10MB)，建议外部工具"
```

## 风险与对策

- **R1 CM6 多标签实例内存**：每 tab 一个 view 持有 doc。对策：非激活 tab 的 view 可销毁重载（只保留 content 字符串）；先实现简单版（保留 view），内存告警再优化
- **R2 asset protocol 权限**：convertFileSrc 需要 capabilities 配置 asset scope；M2 实现时验证，失败则退回 base64（>5MB 图片有性能问题，届时限制图片大小）
- **R3 papaparse 大文件**：5 万行解析 ~百 ms 级，可接受；行数超阈值（20MB 对应行数不定）用字节大小判断降级
- **R4 编码**：非 UTF-8 文本（GBK）读入乱码 → M2 仅 UTF-8，检测到非法 UTF-8 提示"编码不支持"；UTF-8 BOM 自动剥离

## 验收映射

- 5 万行 CSV 滚动流畅：自测生成 5 万行 CSV（含引号内逗号）
- 高亮验证：rs/py/json 各一文件打开检查高亮生效
- 图片：png/gif 动图/svg 各一验证；损坏 png 显示占位
