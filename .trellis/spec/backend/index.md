# Backend 开发指南（Rust, src-tauri/）

> GitPad 后端 = Tauri 2 的命令层 + 文件系统/Git 访问层，全 Rust。

---

## Overview

后端是 Tauri 命令层：前端（Svelte）通过 `invoke()` 调 Rust 命令完成所有文件系统与 Git 操作。核心原则：

- **所有文件系统/Git 访问都在 Rust 侧**，前端只拿数据，不做路径拼接
- **命令是薄层**：命令函数只做参数校验 + 调用领域函数，业务逻辑在 `src/` 下的领域模块
- 路径、忽略规则、git 操作等平台差异都收敛在 Rust 侧，保持跨平台无污染

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | 模块组织与文件布局 | 生效 |
| [Error Handling](./error-handling.md) | 错误类型与向前端传播 | 生效 |
| [Quality Guidelines](./quality-guidelines.md) | 代码标准与禁止模式 | 生效 |
| [Logging Guidelines](./logging-guidelines.md) | 日志约定 | 生效 |

（无数据库：GitPad 不引入 DB，本地状态只落文件与 git 本身）

---

## 验证命令

```bash
cargo fmt --check        # 格式化
cargo clippy -- -D warnings   # lint（-D warnings 强制）
cargo test               # 单元测试（Rust 侧核心逻辑）
cargo build              # 编译验证
```
