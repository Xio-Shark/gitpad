# M3 Design — Markdown 并排预览

## 架构

新组件 `MarkdownRenderer.svelte`，在 `EditorPane.svelte` 中按 `tab.kind === 'text'` 且扩展名为 `md|markdown` 分发（`filetype.ts` 加 `isMarkdown(path)` 判定，不改 RendererKind 枚举——md 仍属 text 类）。

```
┌─────────────────────────┬──────────────────────────┐
│ CM6 编辑器（源码）        │ 预览 .preview-host        │
│ 复用 TextRenderer 组装    │ {#html} compile(src)     │
│ 50% 宽度，可拖拽分栏       │ markdown-body 样式        │
└─────────────────────────┴──────────────────────────┘
```

## 组件拆分

### 1. CM6 组装复用（`Editor/text-editor.ts`）

TextRenderer 里 `initEditor` 的 CM6 组装（keymap/save/theme/语言懒加载）约 60 行。M3 两份组件都要用，抽成纯函数 `createTextEditorView(container, doc, tabPath, { onDocChange, onSave })`：

- `onDocChange(docText)`：TextRenderer → `setTabContent(dirty=true)`；MarkdownRenderer → 同上（预览由 `tab.content` 驱动）
- `onSave()`：写入文件，两侧共用同一实现
- 返回 `{ view, destroy, save }`，调用方负责生命周期

TextRenderer 改为薄壳（加载/错误/加载中状态 + createTextEditorView 挂载），行为零变化。

### 2. 渲染管线（`Editor/markdown.ts`）

```ts
compileMarkdown(src): string   // 同步，返回 HTML 片段
```

- **markdown-it**（v14，同步 API）：`{ html: true, linkify: true, highlight: hljsHighlight }`
  - `hljsHighlight(code, lang)`：lang 已知 → `hljs.highlight(code, { language: lang }).value`，异常/未知 → 原样输出（`<pre><code>` 由 markdown-it 包裹）
  - hljs 全量注册（`highlight.js/lib/common`，~190 语言太肥 → 用 common 子集，覆盖主流；rust/go/ts/json 等都在 common 内）
- **KaTeX**：自写两条规则（不引入陈旧插件包）：
  - block rule `math_block`：`$$...$$`（含 `$$\n...\n$$`）→ `katex.renderToString(src, { displayMode: true, throwOnError: false })`
  - inline rule `math_inline`：`$...$`（首尾非空白/美元）→ `renderToString(src, { throwOnError: false })`
  - 渲染失败（throwOnError:false 时返回错误样式文本）不抛异常
  - katex CSS 在 `app.css` 一次性引入（`katex/dist/katex.min.css`）
- **mermaid**：不在 compile 内跑（需要 DOM + 异步）。流程：
  - compile 后检测 `pre code.language-mermaid` 存在 → 动态 `import('mermaid')` → `mermaid.initialize({ startOnLoad: false, theme: 'default' })` → 对每个 mermaid 块 `mermaid.render(uid, src)` 生成 SVG 替换
  - 用临时 uid（`m-${crypto.randomUUID()}`）避免重渲染冲突；防抖后整体 `innerHTML` 替换，旧节点自然丢弃
  - 文档无 mermaid 块 → 不 import mermaid（保持"按需加载"承诺，mermaid ~2MB）

### 3. MarkdownRenderer.svelte

- 源码侧：结构照抄 TextRenderer（loading/error 状态、`fsReadFile` 加载、大小/编码错误映射），CM6 用 `createTextEditorView` 挂左栏容器
- 预览侧：`$effect` 订阅 `props.tab.content`（跳过 null），`setTimeout` 防抖 250ms → `compileMarkdown` → 写 `previewHtml`；`{#html}` 输出
- 预览容器 `.preview-host`：独立滚动（`overflow: auto`），宽度 50%，中间加分隔条（CSS border，不做拖拽，MVP 固定分栏）
- 图片路径：markdown 里的相对路径 `./img.png` 需转 asset URL（`convertFileSrc` + path.dirname 拼接），在 compile 前做一次 src 预处理（正则替换 `](...)` 与 `src="..."`）；绝对路径与 asset:// 原样保留
- mermaid 渲染在 previewHtml 更新后的 `$effect` 里执行

## 样式

- `.markdown-body`（预览容器内联 scoped 样式，不依赖外部主题库）：基础排版（标题层级/段落/列表/表格边框/行内码背景/引用边线/图片 max-width:100%/blockquote），字号 13px，行高 1.6，色板走现有 CSS 变量（`--text`/`--border`/`--bg-secondary`）
- hljs 代码块配色：引入 `highlight.js/styles/github.css` 深色适配？——MVP 直接 `github-dark-dimmed.css`，用 var() 微调底色保持与主题一致（省事且观感统一）

## 验证

- 冒烟工作区 `~/gitpad-test-workspace` 里补一个 `demo.md`：GFM 表格 + 代码块（rust/js）+ `$x^2$` + `$$\sum$$` + mermaid 流程图 + 相对路径图片（复用 logo.png）
- 手动路径：打开 demo.md → 编辑触发预览更新 → 验证三类渲染 → Cmd+S → 重开文件内容已保存
- 自动：`npm run check`、`npm run lint`；新增纯函数 `compileMarkdown`/`isMarkdown` 若纯逻辑可测（项目无测试框架，不引入，靠 check/lint + 冒烟）

## 风险

- markdown-it v14 ESM-only：Vite 天然支持，无坑
- mermaid v11 动态 import 体积大：仅在检测到 mermaid 块时才 import；webview 首开速度不受影响
- KaTeX 自写规则与 markdown-it 默认 `$` 处理无冲突（markdown-it 不处理 `$`），但要防 `$5 and $10`（数字相邻）误判：inline 规则加守卫（`$` 后字符非数字/空白）
