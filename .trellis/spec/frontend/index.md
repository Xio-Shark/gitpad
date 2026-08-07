# 前端开发指南（Svelte 5, src/）

> GitPad 前端 = Svelte 5（runes）+ TypeScript strict + CodeMirror 6，通过 `invoke()` 与 Rust 后端通信。

---

## Overview

- 框架：Svelte 5，使用 runes 模式（`$state`/`$derived`/`$effect`），不用 legacy `export let`/`onMount` 形式
- 编辑器：CodeMirror 6（按需加载扩展，不引 Monaco）
- 与后端通信：全部走 `invoke()`，命令名/参数/返回类型统一声明在 `src/lib/api.ts`
- UI 风格：轻量桌面工具——紧凑、键盘优先，不做重设计系统

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | 目录组织 | 生效 |
| [Component Guidelines](./component-guidelines.md) | 组件约定 | 生效 |
| [Runes Guidelines](./runes-guidelines.md) | runes 响应式约定（替代 hooks） | 生效 |
| [State Management](./state-management.md) | 状态分层 | 生效 |
| [Quality Guidelines](./quality-guidelines.md) | 代码标准 | 生效 |
| [Type Safety](./type-safety.md) | 类型约定 | 生效 |

---

## 验证命令

```bash
npm run check          # svelte-check + tsc
npm run lint           # eslint
npm run build          # 构建
npm run dev            # 开发（Tauri 下用 tauri dev）
```
