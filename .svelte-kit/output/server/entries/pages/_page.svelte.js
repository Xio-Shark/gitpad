import { s as ssr_context, a as attr, e as escape_html, b as attr_class, c as attr_style, d as stringify, f as ensure_array_like, g as derived } from "../../chunks/root.js";
import { p as page } from "../../chunks/index.js";
import "@tauri-apps/api/core";
import "clsx";
import "@tauri-apps/api/window";
function onDestroy(fn) {
  /** @type {SSRContext} */
  ssr_context.r.on_destroy(fn);
}
const settings = { showHidden: false, showNodeModules: false };
const workspace = { root: null };
function visibleRange(scrollTop, viewportHeight, rowCount, rowHeight, overscan = 6) {
  const totalHeight = rowCount * rowHeight;
  if (rowCount === 0) return { start: 0, end: 0, totalHeight };
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return { start, end, totalHeight };
}
function FileTree($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...props } = $$props;
    let scrollTop = 0;
    let viewportHeight = 600;
    const ROW_HEIGHT = 24;
    function flatten(node, depth, rows2) {
      rows2.push({ node, depth });
      if (node.isDir && node.expanded) {
        for (const child of node.children) flatten(child, depth + 1, rows2);
      }
    }
    let rows = derived(() => {
      const list = [];
      if (props.root) flatten(props.root, 0, list);
      return list;
    });
    let range = derived(() => visibleRange(scrollTop, viewportHeight, rows().length, ROW_HEIGHT));
    let visible = derived(() => rows().slice(range().start, range().end));
    $$renderer2.push(`<div class="filetree svelte-124nk1e"><div class="toolbar svelte-124nk1e"><span class="root-name svelte-124nk1e"${attr("title", props.root?.path)}>${escape_html(props.root?.name ?? "未打开")}</span> <span class="toolbar-right svelte-124nk1e"><button title="显示隐藏文件（.gitignore 规则除外）"${attr_class("svelte-124nk1e", void 0, { "active": settings.showHidden })}>.</button> <button title="显示 node_modules"${attr_class("svelte-124nk1e", void 0, { "active": settings.showNodeModules })}>nm</button></span></div> <div class="tree-scroll svelte-124nk1e"><div${attr_style(`height: ${stringify(range().totalHeight)}px; position: relative;`)}><!--[-->`);
    const each_array = ensure_array_like(visible());
    for (let i = 0, $$length = each_array.length; i < $$length; i++) {
      let row = each_array[i];
      $$renderer2.push(`<div${attr_class("tree-row svelte-124nk1e", void 0, { "dir": row.node.isDir })}${attr_style(`top: ${stringify((range().start + i) * ROW_HEIGHT)}px; padding-left: ${stringify(row.depth * 14 + 6)}px;`)} role="treeitem"${attr("aria-label", row.node.name)} tabindex="-1"${attr("title", row.node.path)}><span${attr_class("chevron svelte-124nk1e", void 0, { "open": row.node.expanded })}>${escape_html(row.node.isDir ? row.node.expanded ? "▾" : "▸" : "")}</span> <span${attr_class("name svelte-124nk1e", void 0, { "symlink": row.node.isSymlink })}>${escape_html(row.node.name)}</span></div>`);
    }
    $$renderer2.push(`<!--]--></div></div></div>`);
  });
}
function EditorPane($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...props } = $$props;
    $$renderer2.push(`<div class="editor-pane svelte-1k5e2g5">`);
    if (props.filePath) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="placeholder svelte-1k5e2g5"><div class="placeholder-title svelte-1k5e2g5">文件已选中</div> <div class="placeholder-path svelte-1k5e2g5">${escape_html(props.filePath)}</div> <div class="placeholder-note svelte-1k5e2g5">编辑功能将在 M2 接入（CodeMirror）</div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="placeholder svelte-1k5e2g5"><div class="placeholder-title svelte-1k5e2g5">GitPad</div> <div class="placeholder-note svelte-1k5e2g5">从左侧文件树选择文件</div></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function GitPanel($$renderer) {
  $$renderer.push(`<div class="git-panel svelte-1hc2k1i"><div class="git-title svelte-1hc2k1i">Git</div> <div class="git-note svelte-1hc2k1i">Git 面板将在 M5 实现</div></div>`);
}
function WelcomeView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let dragging = false;
    onDestroy(() => {
    });
    $$renderer2.push(`<div${attr_class("welcome svelte-vlwjq1", void 0, { "dragging": dragging })}><div class="card svelte-vlwjq1"><h1 class="svelte-vlwjq1">GitPad</h1> <p class="sub svelte-vlwjq1">轻量编辑器 + Git 客户端</p> <div class="drop-zone svelte-vlwjq1"><div class="drop-icon svelte-vlwjq1">${escape_html("📁")}</div> <p class="drop-text svelte-vlwjq1">拖入文件夹打开 Workspace</p></div> <button class="pick-btn svelte-vlwjq1">选择文件夹…</button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let selectedFile = null;
    let workspacePath = derived(() => page.url.searchParams.get("path"));
    if (workspacePath()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="app svelte-1uha8ag"><aside class="sidebar svelte-1uha8ag">`);
      {
        $$renderer2.push("<!--[-1-->");
        FileTree($$renderer2, { root: workspace.root, onFileClick: (p) => selectedFile = p });
      }
      $$renderer2.push(`<!--]--></aside> <main class="editor svelte-1uha8ag">`);
      EditorPane($$renderer2, { filePath: selectedFile });
      $$renderer2.push(`<!----></main> <aside class="git svelte-1uha8ag">`);
      GitPanel($$renderer2);
      $$renderer2.push(`<!----></aside></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      WelcomeView($$renderer2);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
