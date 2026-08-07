<script lang="ts">
  import { onMount } from 'svelte';
  import type { TreeNode } from '$lib/state.svelte';
  import { toggleNode, refreshNode, invalidateQuickOpen, openFile } from '$lib/state.svelte';
  import { settings } from '$lib/settings.svelte';
  import { reloadRoot } from '$lib/state.svelte';
  import { fsCreateFile, fsCreateDir, fsRename, fsDelete, clipboardCopy, isAppError } from '$lib/api';
  import { visibleRange } from '$lib/utils/windowing';
  import InputDialog from './InputDialog.svelte';

  let props = $props<{
    root: TreeNode | null;
    onFileClick: (path: string) => void;
  }>();

  let scrollEl = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let viewportHeight = $state(600);
  let refreshError = $state<string | null>(null);
  let selectedPath = $state<string | null>(null);
  let copiedTip = $state<string | null>(null);

  const ROW_HEIGHT = 24;

  // Option+Cmd+C 复制选中节点绝对路径（无选中时复制工作区根路径）
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.altKey && e.key.toLowerCase() === 'c') {
        const target = selectedPath ?? props.root?.path;
        if (!target) return;
        e.preventDefault();
        void clipboardCopy(target).then(() => {
          copiedTip = `已复制路径：${target}`;
          setTimeout(() => (copiedTip = null), 2500);
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function selectAndOpen(node: TreeNode) {
    selectedPath = node.path;
    if (node.isDir) toggleNode(node);
    else props.onFileClick(node.path);
  }

  interface FlatRow {
    node: TreeNode;
    depth: number;
  }

  /** 展开状态扁平化（DFS），只包含可见行 */
  function flatten(node: TreeNode, depth: number, rows: FlatRow[]): void {
    rows.push({ node, depth });
    if (node.isDir && node.expanded) {
      for (const child of node.children) flatten(child, depth + 1, rows);
    }
  }

  let rows = $derived.by(() => {
    const list: FlatRow[] = [];
    if (props.root) flatten(props.root, 0, list);
    return list;
  });

  let range = $derived(visibleRange(scrollTop, viewportHeight, rows.length, ROW_HEIGHT));
  let visible = $derived(rows.slice(range.start, range.end));

  async function toggleSettings(key: 'showHidden' | 'showNodeModules') {
    settings[key] = !settings[key];
    invalidateQuickOpen();
    await reloadRoot();
  }

  async function refresh() {
    refreshError = null;
    try {
      await reloadRoot();
    } catch (e) {
      refreshError = typeof e === 'string' ? e : String(e);
    }
  }

  // ---- 右键菜单 ----
  type MenuState = { x: number; y: number; node: TreeNode } | null;
  let menu = $state<MenuState>(null);
  let dialog = $state<{
    title: string;
    initial: string;
    mode: 'newFile' | 'newDir' | 'rename';
    node: TreeNode | null;
  } | null>(null);

  function parentDir(path: string): string {
    const i = path.lastIndexOf('/');
    return i <= 0 ? path : path.slice(0, i);
  }

  function showMenu(e: MouseEvent, node: TreeNode) {
    e.preventDefault();
    menu = { x: e.clientX, y: e.clientY, node };
  }

  function hideMenu() {
    menu = null;
  }

  function targetDir(node: TreeNode): string {
    return node.isDir ? node.path : parentDir(node.path);
  }

  function openDialog(mode: 'newFile' | 'newDir' | 'rename', node: TreeNode) {
    dialog = {
      mode,
      title: mode === 'newFile' ? '新建文件' : mode === 'newDir' ? '新建文件夹' : '重命名',
      initial: mode === 'rename' ? node.name : '',
      node,
    };
    hideMenu();
  }

  async function runDialog(value: string) {
    if (!dialog) return;
    const d = dialog;
    dialog = null;
    refreshError = null;
    try {
      if (d.mode === 'rename' && d.node) {
        const dir = parentDir(d.node.path);
        await fsRename(d.node.path, `${dir}/${value}`);
        await refreshNode(dir);
      } else if (d.mode === 'newDir' && d.node) {
        const dir = targetDir(d.node);
        await fsCreateDir(`${dir}/${value}`);
        await refreshNode(dir);
        if (d.node.isDir) d.node.expanded = true;
      } else if (d.node) {
        const dir = targetDir(d.node);
        const target = `${dir}/${value}`;
        await fsCreateFile(target);
        openFile(target);
        await refreshNode(dir);
      }
      invalidateQuickOpen();
    } catch (e) {
      refreshError = isAppError(e) ? e.message : String(e);
    }
  }

  async function removeNode(node: TreeNode) {
    hideMenu();
    const msg = node.isDir ? `确定删除 ${node.name} 及其全部内容？` : `确定删除 ${node.name}？`;
    if (!confirm(msg)) return;
    refreshError = null;
    try {
      await fsDelete(node.path, node.isDir);
      invalidateQuickOpen();
      await refreshNode(parentDir(node.path));
    } catch (e) {
      refreshError = isAppError(e) ? e.message : String(e);
    }
  }
</script>

<div class="filetree">
  <div class="toolbar">
    <span class="root-name" title={props.root?.path}>{props.root?.name ?? '未打开'}</span>
    <span class="toolbar-right">
      <button
        class:active={settings.showHidden}
        title="显示隐藏文件（.gitignore 规则除外）"
        onclick={() => toggleSettings('showHidden')}
      >.</button>
      <button
        class:active={settings.showNodeModules}
        title="显示 node_modules"
        onclick={() => toggleSettings('showNodeModules')}
      >nm</button>
      <button title="刷新文件树" onclick={() => void refresh()}>↻</button>
    </span>
  </div>
  {#if refreshError}
    <div class="refresh-error">{refreshError}</div>
  {/if}
  {#if copiedTip}
    <div class="copy-tip">{copiedTip}</div>
  {/if}
  <div
    class="tree-scroll"
    role="tree"
    tabindex="0"
    bind:this={scrollEl}
    onscroll={(e) => {
      scrollTop = (e.currentTarget as HTMLDivElement).scrollTop;
    }}
    oncontextmenu={(e) => e.preventDefault()}
    bind:clientHeight={viewportHeight}
  >
    <div style="height: {range.totalHeight}px; position: relative;">
      {#each visible as row, i (row.node.path)}
        <div
          class="tree-row"
          style="top: {(range.start + i) * ROW_HEIGHT}px; padding-left: {row.depth * 14 + 6}px;"
          class:dir={row.node.isDir}
          class:selected={row.node.path === selectedPath}
          role="treeitem"
          aria-label={row.node.name}
          aria-selected={row.node.path === selectedPath}
          tabindex="-1"
          oncontextmenu={(e) => {
            showMenu(e, row.node);
            selectedPath = row.node.path;
          }}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              selectAndOpen(row.node);
            }
          }}
          onclick={() => selectAndOpen(row.node)}
          title={row.node.path}
        >
          <span class="chevron" class:open={row.node.expanded}>{row.node.isDir ? (row.node.expanded ? '▾' : '▸') : ''}</span>
          <span class="name" class:symlink={row.node.isSymlink}>{row.node.name}</span>
        </div>
      {/each}
    </div>
  </div>
  {#if menu}
    <div class="ctx-mask" role="presentation" onclick={() => hideMenu()} oncontextmenu={(e) => { e.preventDefault(); hideMenu(); }}></div>
    <div class="ctx-menu" style="left: {menu.x}px; top: {menu.y}px;">
      <button onclick={() => openDialog('newFile', menu!.node)}>新建文件</button>
      {#if menu!.node.isDir}
        <button onclick={() => openDialog('newDir', menu!.node)}>新建文件夹</button>
      {/if}
      <button onclick={() => openDialog('rename', menu!.node)}>重命名</button>
      <div class="ctx-sep"></div>
      <button class="danger" onclick={() => removeNode(menu!.node)}>删除</button>
    </div>
  {/if}
  {#if dialog}
    <InputDialog
      title={dialog.title}
      initial={dialog.initial}
      placeholder={dialog.mode === 'newDir' ? '文件夹名' : '文件名'}
      onOk={(v) => void runDialog(v)}
      onCancel={() => (dialog = null)}
    />
  {/if}
</div>

<style>
  .filetree {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    gap: 8px;
  }
  .root-name {
    font-size: 12px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .toolbar-right {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  .toolbar button {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
  }
  .toolbar button.active {
    background: var(--accent);
    color: var(--text-on-accent);
  }
  .tree-scroll {
    flex: 1;
    overflow-y: auto;
    position: relative;
  }
  .refresh-error {
    padding: 4px 8px;
    font-size: 11px;
    color: var(--danger);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .copy-tip {
    padding: 4px 8px;
    font-size: 11px;
    color: #4aae6b;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tree-row.selected {
    background: rgba(77, 170, 252, 0.18);
  }
  .tree-row {
    position: absolute;
    left: 0;
    right: 0;
    height: 24px;
    display: flex;
    align-items: center;
    gap: 2px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }
  .tree-row:hover {
    background: var(--hover);
  }
  .chevron {
    width: 14px;
    font-size: 10px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }
  .chevron.open {
    color: var(--text);
  }
  .name {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name.symlink {
    font-style: italic;
    color: var(--text-secondary);
  }
  .ctx-mask {
    position: fixed;
    inset: 0;
    z-index: 90;
  }
  .ctx-menu {
    position: fixed;
    z-index: 91;
    min-width: 130px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
  }
  .ctx-menu button {
    text-align: left;
    font-size: 12px;
    padding: 5px 10px;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--text);
    cursor: pointer;
  }
  .ctx-menu button:hover {
    background: var(--hover);
  }
  .ctx-menu button.danger {
    color: var(--danger);
  }
  .ctx-sep {
    height: 1px;
    background: var(--border);
    margin: 3px 4px;
  }
</style>
