import { s as ssr_context, a as attr, e as escape_html, b as attr_class, c as attr_style, d as stringify, f as ensure_array_like, g as derived } from "../../chunks/root.js";
import { p as page } from "../../chunks/index.js";
import { convertFileSrc } from "@tauri-apps/api/core";
import "clsx";
import { Compartment } from "@codemirror/state";
import "papaparse";
import "@tauri-apps/api/window";
function onDestroy(fn) {
  /** @type {SSRContext} */
  ssr_context.r.on_destroy(fn);
}
const settings = { showHidden: false, showNodeModules: false };
const IMAGE_EXTS = /* @__PURE__ */ new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "avif"]);
const TEXT_EXTS = /* @__PURE__ */ new Set([
  "txt",
  "log",
  "md",
  "markdown",
  "json",
  "jsonc",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "conf",
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "mts",
  "cts",
  "tsx",
  "css",
  "scss",
  "less",
  "html",
  "htm",
  "xml",
  "svg",
  "rs",
  "py",
  "java",
  "go",
  "c",
  "h",
  "cpp",
  "cc",
  "hpp",
  "cs",
  "php",
  "rb",
  "sh",
  "bash",
  "sql",
  "swift",
  "kt",
  "kts",
  "dart",
  "vue",
  "svelte",
  "lua",
  "pl",
  "r",
  "scala",
  "clj"
]);
function classify(path) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "") return "text";
  if (ext === "pdf") return "pdf";
  if (ext === "csv") return "csv";
  if (IMAGE_EXTS.has(ext)) return "image";
  if (TEXT_EXTS.has(ext)) return "text";
  return "unknown";
}
const workspace = { root: null };
const tabs = { list: [], activeId: null };
function activeTab() {
  return tabs.list.find((t) => t.id === tabs.activeId) ?? null;
}
function openFile(path) {
  const existing = tabs.list.find((t) => t.path === path);
  if (existing) {
    tabs.activeId = existing.id;
    return existing;
  }
  const name = path.split("/").pop() ?? path;
  const tab = {
    id: path,
    path,
    name,
    kind: classify(path),
    dirty: false,
    content: null
  };
  tabs.list.push(tab);
  tabs.activeId = tab.id;
  return tab;
}
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
      $$renderer2.push(`<div${attr_class("tree-row svelte-124nk1e", void 0, { "dir": row.node.isDir })}${attr_style(`top: ${stringify((range().start + i) * ROW_HEIGHT)}px; padding-left: ${stringify(row.depth * 14 + 6)}px;`)} role="treeitem"${attr("aria-label", row.node.name)} aria-selected="false" tabindex="-1"${attr("title", row.node.path)}><span${attr_class("chevron svelte-124nk1e", void 0, { "open": row.node.expanded })}>${escape_html(row.node.isDir ? row.node.expanded ? "▾" : "▸" : "")}</span> <span${attr_class("name svelte-124nk1e", void 0, { "symlink": row.node.isSymlink })}>${escape_html(row.node.name)}</span></div>`);
    }
    $$renderer2.push(`<!--]--></div></div></div>`);
  });
}
function TextRenderer($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...props } = $$props;
    new Compartment();
    $$renderer2.push(`<div class="text-renderer svelte-m4e5xq">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="msg svelte-m4e5xq">加载中…</div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function ImageRenderer($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...props } = $$props;
    let fit = true;
    const src = convertFileSrc(props.tab.path);
    $$renderer2.push(`<div class="image-renderer svelte-1yxzpog"><div class="toolbar svelte-1yxzpog"><button${attr_class("svelte-1yxzpog", void 0, { "active": fit })}>适应窗口</button> <button${attr_class("svelte-1yxzpog", void 0, { "active": !fit })}>原始尺寸</button></div> <div${attr_class("canvas svelte-1yxzpog", void 0, { "fit": fit })}>`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<img${attr("src", src)}${attr("alt", props.tab.name)}${attr_class("svelte-1yxzpog", void 0, { "fit-img": fit })} onerror="this.__e=event" onload="this.__e=event"/>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
function CsvRenderer($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...props } = $$props;
    let mode = "table";
    let rows = [];
    let header = [];
    let error = null;
    $$renderer2.push(`<div class="csv-renderer svelte-1vk20af"><div class="toolbar svelte-1vk20af"><button${attr("disabled", error !== null, true)}${attr_class("svelte-1vk20af", void 0, { "active": mode === "table" })}>表格</button> <button${attr("disabled", error !== null, true)}${attr_class("svelte-1vk20af", void 0, { "active": mode === "text" })}>文本</button> <span class="meta svelte-1vk20af">${escape_html(rows.length.toLocaleString())} 行 × ${escape_html(header.length)} 列</span></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="msg svelte-1vk20af">加载中…</div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function EditorPane($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let tab = derived(activeTab);
    $$renderer2.push(`<div class="editor-pane svelte-1k5e2g5">`);
    if (!tab()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="placeholder svelte-1k5e2g5"><div class="placeholder-title svelte-1k5e2g5">GitPad</div> <div class="placeholder-note svelte-1k5e2g5">从左侧文件树选择文件</div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!---->`);
      {
        if (tab().kind === "image") {
          $$renderer2.push("<!--[0-->");
          ImageRenderer($$renderer2, { tab: tab() });
        } else if (tab().kind === "csv") {
          $$renderer2.push("<!--[1-->");
          CsvRenderer($$renderer2, { tab: tab() });
        } else if (tab().kind === "text") {
          $$renderer2.push("<!--[2-->");
          TextRenderer($$renderer2, { tab: tab() });
        } else if (tab().kind === "pdf") {
          $$renderer2.push("<!--[3-->");
          $$renderer2.push(`<div class="placeholder svelte-1k5e2g5"><div class="placeholder-title svelte-1k5e2g5">PDF 预览</div> <div class="placeholder-note svelte-1k5e2g5">将在 M4 实现</div></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<div class="placeholder svelte-1k5e2g5"><div class="placeholder-title svelte-1k5e2g5">不支持的格式</div> <div class="placeholder-note svelte-1k5e2g5">${escape_html(tab().name)}</div></div>`);
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!---->`);
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
function TabBar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const KIND_ICON = { text: "📄", image: "🖼️", csv: "📊", pdf: "📕", unknown: "❔" };
    $$renderer2.push(`<div class="tabbar svelte-1wwzsr0" role="tablist"><!--[-->`);
    const each_array = ensure_array_like(tabs.list);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let tab = each_array[$$index];
      $$renderer2.push(`<div${attr_class("tab svelte-1wwzsr0", void 0, { "active": tab.id === tabs.activeId })} role="tab"${attr("aria-selected", tab.id === tabs.activeId)}${attr("title", tab.path)}><span class="tab-icon svelte-1wwzsr0">${escape_html(KIND_ICON[tab.kind])}</span> <span class="tab-name svelte-1wwzsr0">${escape_html(tab.name)}</span> `);
      if (tab.dirty) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="dirty-dot svelte-1wwzsr0" title="未保存"></span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <button class="tab-close svelte-1wwzsr0" title="关闭">×</button></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (tabs.list.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="tabbar-empty svelte-1wwzsr0">无打开的标签页</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let workspacePath = derived(() => page.url.searchParams.get("path"));
    if (workspacePath()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="app svelte-1uha8ag"><aside class="sidebar svelte-1uha8ag">`);
      {
        $$renderer2.push("<!--[-1-->");
        FileTree($$renderer2, { root: workspace.root, onFileClick: (p) => openFile(p) });
      }
      $$renderer2.push(`<!--]--></aside> <main class="editor svelte-1uha8ag">`);
      TabBar($$renderer2);
      $$renderer2.push(`<!----> <div class="editor-body svelte-1uha8ag">`);
      EditorPane($$renderer2);
      $$renderer2.push(`<!----></div></main> <aside class="git svelte-1uha8ag">`);
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
