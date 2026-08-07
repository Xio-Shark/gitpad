# ADR-0001: Git 后端用 git2 (libgit2)，不用 gix

选择 libgit2 的 Rust 绑定 `git2` 作为 Git 面板的后端：diff/stage/hunk 级暂存/提交历史/提交图数据全部从它取。

理由：Fork 本身以 libgit2 为内核，证明了它能支撑"历史 + diff + hunk stage"这一目标体验；写操作（stage/commit）稳定性优先于纯 Rust 洁癖。gix 虽为 Rust 原生且更快，但写入侧刚稳定、API 仍在演进，自用工具不值得跟着 API 变动跑。

约束：Rust 侧把 git 访问收敛在 trait 化的 repository 抽象后，未来 gix 成熟时可换而不重写 UI 层。hunk 级 stage 依赖 libgit2 的 diff patch 能力，属核心路径，先于其他 Git 功能实现。
