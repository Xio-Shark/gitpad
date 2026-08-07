# Quality Guidelines

> 前端代码标准。

## 标准

- `npm run check`（svelte-check + tsc strict）零错误
- `npm run lint`（eslint + prettier）零告警
- 组件 <300 行，函数 <50 行
- CSS 用项目级变量，主题色集中管理（为插件系统的主题能力预留）

## 禁止模式

- ❌ 组件内直接 `invoke` 拼字符串命令（走 api.ts）
- ❌ `$effect` 无限循环 / 无 cleanup
- ❌ 静默吞错（invoke 失败必须 UI 可见）
- ❌ 大数组渲染不虚拟化（文件树用虚拟滚动）

## 验证门槛

改前端后至少 `npm run check`；涉及行为改动需 `npm run dev` 手动冒烟（拖文件夹→树→打开文件→编辑→保存）。
