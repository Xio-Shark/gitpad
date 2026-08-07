# Logging Guidelines

> 日志约定。

## 方案

- `log` crate + `tauri-plugin-log`：Rust 日志进 Tauri 的 webview console 与日志目录
- 个人工具，日志量从简：`debug` 足够覆盖日常，`error` 必须保留失败现场

## Level 用法

- `error!`：命令失败（含 AppError 上抛点）、git 操作失败
- `warn!`：可恢复异常（如单文件读取失败，界面继续）
- `debug!`：正常路径（树构建耗时、文件变更事件）
- 前端 `console.*` 与 Rust `debug!` 平级约定

## 禁止

- ❌ 打印密钥/凭据（git 凭证、token）
- ❌ 打印整个文件内容（只打路径 + 长度）
- ❌ 在错误路径上打 `println!`
