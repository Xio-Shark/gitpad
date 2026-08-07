# Runes Guidelines（替代 hooks）

> Svelte 5 响应式约定。本项目不用 React hooks，此文件规范 runes 的使用。

## 规则

- **状态声明**：`let x = $state(0)` / `let x = $state({})`；props 用 `let { a, b } = $props()`
- **派生**：能 `$derived` 就不用 `$effect` + 手动赋值；`$derived` 禁止有副作用
- **副作用**：`$effect` 只在需要同步外部系统时使用（DOM 操作、CM6 实例同步、invoke 结果订阅），每个 `$effect` 必须有明确生命周期（cleanup 里销毁监听/编辑器实例）
- **事件**：一律用 Svelte 事件（`onclick`）而非 DOM 监听；CM6 的 DOM 事件走其自身的插件机制，不手动 addEventListener 挂组件上

## 命名与结构

- 全局状态放 `state.svelte.ts`，导出单例（模块级 `$state`），组件内 `import { workspace } from '../lib/state.svelte.ts'`
- 跨组件共享逻辑优先状态单例，不层层 prop drilling

## 常见错误（禁止）

- ❌ 在 `$effect` 里改另一个 `$state`（导致连锁触发）——用 `$derived` 或显式两段式
- ❌ `$effect` 里 invoke() 无防抖/无取消（文件树展开、搜索等高频调用）
- ❌ 组件卸载后不清理 CM6 / pdf.js / 定时器实例
