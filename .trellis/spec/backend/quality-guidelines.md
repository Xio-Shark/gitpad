# Quality Guidelines

> Rust 代码标准与验证门槛。

## 标准

- `cargo fmt`（rustfmt 默认配置）+ `cargo clippy -- -D warnings` 必须零告警
- 命令层与领域层函数保持小体积（<50 行），超出时拆 helper
- 领域函数写单元测试：文件树过滤规则（ignore 语义）、路径逻辑是重点测试对象
- 禁止 `unwrap()` / `panic!` 于命令与领域层；错误一律走 `AppError`
- 不引入未使用的依赖；每次加 crate 需有用途说明（Cargo.toml 注释）

## 禁止模式

- ❌ 在命令层重复领域逻辑（过滤、路径解析必须在领域模块）
- ❌ 前端能推断出的数据却由后端硬编码
- ❌ 直接调用 `git` CLI 进程（M5 起统一走 git2）

## 验证门槛

改 Rust 代码后至少：`cargo fmt --check` + `cargo clippy -- -D warnings` + 受影响模块 `cargo test`；Tauri 命令改动需 `cargo build` 通过并前端冒烟调用一次。
