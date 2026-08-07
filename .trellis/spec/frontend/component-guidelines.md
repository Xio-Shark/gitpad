# Component Guidelines

> 组件约定。

## 模式

- 组件 = 表现层：props 进，事件出（`onclick` 等 Svelte 事件或回调 prop），不直接 invoke（invoke 封装在 `api.ts`，组件调用 `api` 函数）
- 组件分两类：**容器组件**（FileTree/Editor/GitPanel，持有状态）与**展示组件**（common/，纯 props）
- 每组件职责单一：文件树只管树展示与节点交互，不管 git 状态
- 键盘优先：常用操作有快捷键提示（tooltip/菜单标注）

## Props 与事件

- props 用 `$props()` runes 形式；可空字段显式声明
- 回调 prop 命名 `onXxx`（Svelte 5 中用回调 prop 而非 dispatchEvent，与原生事件一致）

## 可访问性

- 树节点/标签页可键盘导航（Tab 可达 + 方向键）
- 状态变化给视觉反馈（loading、error toast），不静默

## 禁止

- ❌ 组件内拼后端命令字符串 —— 一律 `api.ts` 函数
- ❌ 大组件 >300 行，超出拆子组件
- ❌ 内联样式堆砌 —— 用项目级 CSS 变量（深/浅色主题预留）
