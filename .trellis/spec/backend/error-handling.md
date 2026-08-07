# Error Handling

> Rust 侧错误如何定义、传播、呈现给前端。

## Overview

规则：**错误必须可观测，不静默降级**。命令层返回 `Result<T, AppError>`，`AppError` 序列化为前端可显示的结构。

## 错误类型

- `AppError`（src-tauri/src/error.rs）：`thiserror` 派生的统一错误枚举
  - `Io(#[from] std::io::Error)` — 文件系统错误
  - `Git(git2::Error)` — （M5 引入）
  - `NotDirectory`、`NotFound` 等语义化变体，方便前端分支处理
  - 实现 `Serialize`：`{ code, message }` 传给前端

## 传播规则

- 命令函数：`Result<T, AppError>`，**不捕获不包装**，让 `?` 自然上抛
- 领域模块：返回 `Result`，不在内部打印后吞掉
- 前端 `invoke()` 失败 → 显示 `message`（toast/状态栏），不允许静默忽略
- 允许 `expect` 的场合：仅在进程启动期、错误即不可恢复时

## 禁止模式

- ❌ `unwrap()` 处理用户输入相关路径/数据
- ❌ `catch` 后返回假默认值（如返回空树假装成功）
- ❌ 错误信息里拼用户路径直接进日志（路径一般安全，但保持简洁）
