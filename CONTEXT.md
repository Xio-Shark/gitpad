# GitPad

**GitPad** 是一个轻量本地优先的编辑器 + Git 客户端工具，面向个人开发者自用：开箱即用、启动快、不重（对标 Sublime Text 的轻量 + Fork 的 Git 体验，不做成 VS Code 量级）。

## Language

**用户画像**:
个人开发者，自用场景优先（写笔记、管个人/公司仓库）。
_Avoid_: 团队、企业

**Workspace**:
用户拖入程序的一个文件夹，是文件树、编辑器、Git 面板共用的上下文边界。
_Avoid_: 项目、工程、目录（目录仅指文件系统概念）

**Git 面板**:
轻量 Git 界面，核心诉求：提交历史（git history）+ 分支可视化图（gitgraph）+ 文件 diff + hunk 级 stage/unstage + 简单提交。不追求 Fork 的全部能力（rebase/merge 冲突界面/stash/cherry-pick/submodule 不做）。
_Avoid_: Git 客户端、完整 Git GUI

**渲染器 (Renderer)**:
负责把某类文件类型在标签页内展示为内容的组件：文本渲染器（CM6）、图片渲染器（`<img>`）、PDF 渲染器（pdf.js）、CSV 表格渲染器。渲染器是只读投影，文本渲染器除外（可编辑，是文件真相的入口）。
_Avoid_: viewer、预览器

**格式分发 (Format Dispatch)**:
点击文件时按扩展名选择渲染器的机制。文本类→文本渲染器（含语言高亮映射）、图片类→图片渲染器、pdf→PDF 渲染器、csv→CSV 渲染器（表格视图可切回文本）、其他→拒绝并提示。
_Avoid_: 文件类型路由、打开逻辑

## Relationships

- 一个 **Workspace** 是文件浏览与 Git 操作的共同作用域
- 一个 **Workspace** 可能包含 0 个或多个 Git 仓库
- 一次 **格式分发** 选中一个 **渲染器** 来展示一个文件

## Example dialogue

> **Dev:** "这个 Workspace 里有两层嵌套的 repo，Git 面板显示哪个？"
> **Domain expert:** "按最近根仓库原则——每个文件归属其最近的 .git 祖先目录。"

## Flagged ambiguities

- 暂无
