# M3 Markdown 并排预览

## Goal

`.md`/`.markdown` 文件在标签页内以「左侧编辑 + 右侧实时预览」分栏打开，支持 KaTeX 公式、mermaid 图表、代码块高亮。MVP 不做滚动同步（父任务 prd 已定）。

## Requirements

- 打开 `.md` 文件即进入并排分栏：左侧为可编辑的 Markdown 源码（复用现有 CM6 文本编辑能力），右侧为渲染后的预览
- 预览随编辑实时更新（输入防抖 ≤300ms）
- 渲染能力：
  - 标准 GFM 语法：标题/列表/表格/引用/代码块/链接/图片/粗斜体/行内代码
  - 代码块语法高亮（highlight.js，自动识别语言，默认 fallback 纯文本）
  - KaTeX 公式：行内 `$...$` 与块级 `$$...$$`（渲染失败时显示原始文本，不报错）
  - mermaid 图表（```mermaid 代码块）：懒加载 mermaid 引擎，仅在文档包含 mermaid 代码块时引入
- 本地图片（相对路径）在预览中可显示（同 ImageRenderer 的 asset protocol 方案）
- 文件保存行为与 TextRenderer 一致（Cmd+S / 自动标 dirty），只改源码侧
- 预览不执行任意 JS（仅 KaTeX/mermaid 自有渲染），代码块中的 HTML 标签原样渲染（本地工具惯例，不 sanitize）
- 不做：滚动同步、导出 PDF、双栏宽度记忆

## Acceptance Criteria

- [ ] 打开 md 文件显示分栏，源码可编辑，编辑后预览 ≤300ms 内更新
- [ ] GFM 表格、代码块高亮、行内代码、引用、图片（相对路径 + asset URL）正确渲染
- [ ] `$x^2$` 与 `$$...$$` 渲染为 KaTeX；无效公式显示原始文本不崩溃
- [ ] ```mermaid 代码块渲染为图表；无 mermaid 的文档不加载 mermaid 引擎
- [ ] Cmd+S 保存生效、关闭未保存标签有 dirty 确认（既有逻辑不回退）
- [ ] 超大 md 文件（>10MB）走既有拒绝路径
- [ ] svelte-check 0 错误、eslint 0、cargo 不受影响

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
