# Type Safety

> 类型约定。

## 规则

- TypeScript `strict: true`（含 `noUncheckedIndexedAccess`）
- 与 Rust 后端的所有数据交换类型集中在 `src/lib/api.ts`：`invoke` 返回类型、参数类型与 Rust 结构一一对应，**禁止在组件里写裸 `as` 断言**
- 错误类型：`AppError { code: string; message: string }`，组件 catch 后按 code 分支
- 数据到达前端先过最小校验（结构存在性），不做重量级 schema 库（不引 zod）
- CM6 封装导出强类型接口（`EditorHandle`），不暴露内部 CM API

## 禁止

- ❌ `any`（CM6 内部类型用 `import type` 透传即可）
- ❌ 前后端类型双写漂移：Rust 结构改动 → 同步改 api.ts（M1 起保持）
