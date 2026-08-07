# Directory Structure

> src-tauri/ 的模块组织。

## Directory Layout

```
src-tauri/
├── src/
│   ├── main.rs          # 仅初始化
│   ├── lib.rs           # run() 入口，注册插件与命令
│   ├── commands/        # #[tauri::command] 薄命令层（一个文件一个领域）
│   │   ├── fs.rs        # 打开目录对话框、读文件、写文件
│   │   └── git.rs       # （M5 引入）git 面板命令
│   ├── fs/              # 文件系统领域逻辑（目录树、忽略规则、监视）
│   │   ├── tree.rs      # 目录树构建：ignore crate walker + 过滤
│   │   └── watch.rs     # 文件变更监听（后续）
│   ├── git/             # （M5 引入）git2 封装：trait Repository + 实现
│   └── error.rs         # 统一错误类型 → 前端可读的错误结构
├── capabilities/        # Tauri 权限声明
└── Cargo.toml
```

## Module Organization

- 领域逻辑（fs/、git/）**不依赖 tauri**，纯 Rust 可单测
- commands/ 依赖领域模块，做参数校验与错误转换
- 前端调用方约定：`invoke('fs_read_file', { path })`，命令名 `领域_动作`

## Naming Conventions

- 命令名：`{领域}_{动作}`，如 `fs_list_dir`、`fs_read_file`
- Rust 文件小写下划线；命令文件按领域分
- 前端 TS 类型与 Rust 返回结构一一对应，放 `src/lib/api.ts` 统一声明

## Examples

- M1 落地后补充首个树构建模块作为范例
