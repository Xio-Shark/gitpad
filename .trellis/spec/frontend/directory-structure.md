# Directory Structure

> src/ 的组织方式。

## Directory Layout

```
src/
├── main.ts              # 入口
├── App.svelte           # 根组件：三栏布局（文件树 | 标签页编辑器 | Git 面板）
├── lib/
│   ├── api.ts           # invoke() 封装：命令名 + TS 类型 + 错误转换（唯一 API 出口）
│   ├── state.svelte.ts  # 全局状态单例（窗口级）
│   ├── components/
│   │   ├── FileTree/    # 文件树（虚拟滚动 + 忽略规则展示）
│   │   ├── Editor/      # CodeMirror 6 封装 + 标签页条
│   │   ├── MarkdownPreview/  # 并排预览
│   │   ├── PdfViewer/   # pdf.js 标签页渲染
│   │   ├── GitPanel/    # 历史/diff/stage（M5）
│   │   └── common/      # 通用小组件（按钮、输入框、toast）
│   └── utils/           # 纯函数工具（无组件）
```

## Module Organization

- 一个功能域一个目录（FileTree/Editor/…），组件 + 该域专属逻辑放一起
- 跨域共享的状态与类型进 `lib/`（state.svelte.ts、api.ts）
- 组件目录内允许 `.ts` 辅助文件（树节点计算等）

## Naming Conventions

- 组件文件：PascalCase（`FileTree.svelte`）
- 工具/逻辑文件：camelCase
- 事件命名：`on{Action}`；与后端命令同名封装（`fsListDir()`）
