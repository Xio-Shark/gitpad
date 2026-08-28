<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { toast } from 'svelte-sonner';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import FilePlus from 'lucide-svelte/icons/file-plus';
  import FolderPlus from 'lucide-svelte/icons/folder-plus';
  import MoreHorizontal from 'lucide-svelte/icons/more-horizontal';
  import type { TreeNode } from '$lib/state.svelte';
  import {
    toggleNode,
    refreshNode,
    invalidateQuickOpen,
    openFile,
    workspace,
    ui,
    expandNode,
    findNode,
    revealPathInTree,
  } from '$lib/state.svelte';
  import { settings } from '$lib/settings.svelte';
  import { reloadRoot } from '$lib/state.svelte';
  import { fsCreateFile, fsCreateDir, fsRename, fsDelete, clipboardCopy, isAppError } from '$lib/api';
  import { visibleRange } from '$lib/utils/windowing';
  import { flattenVisibleTree, handleTreeKey } from '$lib/utils/tree-keyboard';
  import { getFileIcon } from '$lib/utils/file-icons';
  import InputDialog from './InputDialog.svelte';

  let props = $props<{
    root: TreeNode | null;
    onFileClick: (path: string) => void;
  }>();

  let scrollEl = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let viewportHeight = $state(600);
  let focusedPath = $state<string | null>(null);
  let menuFocusIdx = $state(0);
  let moreMenuOpen = $state(false);

  const ROW_HEIGHT = 26;

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.altKey && (e.code === 'KeyC' || e.key.toLowerCase() === 'c')) {
        const target = workspace.selectedPath ?? props.root?.path;
        if (!target) return;
        e.preventDefault();
        void copyToClipboard(target);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function copyToClipboard(path: string) {
    try {
      await clipboardCopy(path);
      toast.success('已复制绝对路径到剪贴板');
    } catch (e) {
      toast.error(isAppError(e) ? `复制失败：${e.message}` : `复制失败：${String(e)}`);
    }
  }

  function selectAndOpen(node: TreeNode) {
    workspace.selectedPath = node.path;
    focusedPath = node.path;
    if (node.isDir) {
      toggleNode(node);
      return;
    }
    props.onFileClick(node.path);
  }

  function copyPath(node: TreeNode) {
    hideMenu();
    void copyToClipboard(node.path);
  }

  interface FlatRow {
    node: TreeNode;
    depth: number;
  }

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

  let keyboardRows = $derived(flattenVisibleTree(props.root));
  let range = $derived(visibleRange(scrollTop, viewportHeight, rows.length, ROW_HEIGHT));
  let visible = $derived(rows.slice(range.start, range.end));

  $effect(() => {
    if (!focusedPath && props.root) focusedPath = props.root.path;
  });

  // 外部改变选中路径（如 TabBar 切换、QuickOpen 等）时，自动定位并展开祖先目录
  $effect(() => {
    const path = workspace.selectedPath;
    if (!path || !props.root) return;
    if (focusedPath !== path) focusedPath = path;
    const inRows = rows.some((r) => r.node.path === path);
    if (!inRows) {
      void revealPathInTree(props.root, path).then(() => {
        void tick().then(() => scrollFocusedIntoView());
      });
    } else {
      void tick().then(() => scrollFocusedIntoView());
    }
  });

  async function toggleSettings(key: 'showHidden' | 'showNodeModules') {
    settings[key] = !settings[key];
    invalidateQuickOpen();
    await reloadRoot();
  }

  async function refresh() {
    try {
      await reloadRoot();
      toast.success('文件树已刷新');
    } catch (e) {
      toast.error(typeof e === 'string' ? e : String(e));
    }
  }

  type MenuState = { x: number; y: number; node: TreeNode; items: { id: string; label: string; shortcut?: string; danger?: boolean }[] } | null;
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

  function menuItemsFor(node: TreeNode) {
    const items = [
      { id: 'newFile', label: '新建文件' },
      ...(node.isDir ? [{ id: 'newDir', label: '新建文件夹' }] : []),
      { id: 'rename', label: '重命名', shortcut: 'Enter' },
      { id: 'copy', label: '复制绝对路径', shortcut: '⌥⌘C' },
      { id: 'delete', label: '删除', danger: true },
    ];
    return items;
  }

  function showMenu(e: MouseEvent, node: TreeNode) {
    e.preventDefault();
    menu = { x: Math.min(e.clientX, window.innerWidth - 180), y: Math.min(e.clientY, window.innerHeight - 200), node, items: menuItemsFor(node) };
    menuFocusIdx = 0;
  }

  function hideMenu() {
    menu = null;
  }

  function runMenuAction(id: string, node: TreeNode) {
    switch (id) {
      case 'newFile':
        openDialog('newFile', node);
        break;
      case 'newDir':
        openDialog('newDir', node);
        break;
      case 'rename':
        openDialog('rename', node);
        break;
      case 'copy':
        copyPath(node);
        break;
      case 'delete':
        void removeNode(node);
        break;
    }
  }

  function onMenuKeydown(e: KeyboardEvent) {
    if (!menu) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      hideMenu();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      menuFocusIdx = Math.min(menu.items.length - 1, menuFocusIdx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      menuFocusIdx = Math.max(0, menuFocusIdx - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      menuFocusIdx = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      menuFocusIdx = menu.items.length - 1;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const item = menu.items[menuFocusIdx];
      if (item) runMenuAction(item.id, menu.node);
      return;
    } else {
      return;
    }
    const menuEl = e.currentTarget as HTMLElement;
    queueMicrotask(() => {
      const items = menuEl.querySelectorAll<HTMLElement>('[role="menuitem"]');
      items[menuFocusIdx]?.focus();
    });
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

  function quickCreate(mode: 'newFile' | 'newDir') {
    const target = props.root ? (workspace.selectedPath ? findNode(props.root, workspace.selectedPath) ?? props.root : props.root) : null;
    if (target) {
      openDialog(mode, target);
    }
  }

  async function runDialog(value: string) {
    if (!dialog) return;
    const d = dialog;
    dialog = null;
    try {
      if (d.mode === 'rename' && d.node) {
        const dir = parentDir(d.node.path);
        await fsRename(d.node.path, `${dir}/${value}`);
        await refreshNode(dir);
        toast.success(`已重命名为 ${value}`);
      } else if (d.mode === 'newDir' && d.node) {
        const dir = targetDir(d.node);
        await fsCreateDir(`${dir}/${value}`);
        await refreshNode(dir);
        if (d.node.isDir) d.node.expanded = true;
        toast.success(`已创建文件夹 ${value}`);
      } else if (d.node) {
        const dir = targetDir(d.node);
        const target = `${dir}/${value}`;
        await fsCreateFile(target);
        openFile(target);
        await refreshNode(dir);
        toast.success(`已创建文件 ${value}`);
      }
      invalidateQuickOpen();
    } catch (e) {
      toast.error(isAppError(e) ? e.message : String(e));
    }
  }

  async function removeNode(node: TreeNode) {
    hideMenu();
    const msg = node.isDir ? `确定删除 ${node.name} 及其全部内容？` : `确定删除 ${node.name}？`;
    if (!confirm(msg)) return;
    try {
      await fsDelete(node.path, node.isDir);
      invalidateQuickOpen();
      await refreshNode(parentDir(node.path));
      toast.success(`已删除 ${node.name}`);
    } catch (e) {
      toast.error(isAppError(e) ? e.message : String(e));
    }
  }

  async function onTreeKeydown(e: KeyboardEvent) {
    if (menu) return;
    const action = handleTreeKey(e.key, focusedPath, keyboardRows);
    if (action.type === 'none') return;
    e.preventDefault();

    if (action.type === 'focus') {
      focusedPath = action.path;
      workspace.selectedPath = action.path;
      await tick();
      scrollFocusedIntoView();
      return;
    }

    const node = props.root ? findNode(props.root, action.path) : null;
    if (!node) return;
    focusedPath = action.path;
    workspace.selectedPath = action.path;

    if (action.type === 'expand') {
      node.expanded = true;
      if (!node.loaded) await expandNode(node);
    } else if (action.type === 'collapse') {
      node.expanded = false;
    } else if (action.type === 'toggle') {
      toggleNode(node);
    } else if (action.type === 'activate') {
      selectAndOpen(node);
    }
  }

  function scrollFocusedIntoView() {
    if (!scrollEl || !focusedPath) return;
    const idx = rows.findIndex((r) => r.node.path === focusedPath);
    if (idx < 0) return;
    const top = idx * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < scrollEl.scrollTop) scrollEl.scrollTop = top;
    else if (bottom > scrollEl.scrollTop + scrollEl.clientHeight) {
      scrollEl.scrollTop = bottom - scrollEl.clientHeight;
    }
  }

  function focusMenu(node: HTMLElement) {
    queueMicrotask(() => {
      const item = node.querySelector<HTMLElement>('[role="menuitem"][tabindex="0"]');
      (item ?? node).focus();
    });
  }
</script>

<div class="filetree nav-surface">
  <div class="toolbar">
    <span class="root-name" title={props.root?.path}>{props.root?.name ?? '未打开'}</span>
    <span class="toolbar-right">
      <button
        class="icon-btn"
        aria-label="新建文件"
        title="新建文件"
        onclick={() => quickCreate('newFile')}
      >
        <FilePlus size={13} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <button
        class="icon-btn"
        aria-label="新建文件夹"
        title="新建文件夹"
        onclick={() => quickCreate('newDir')}
      >
        <FolderPlus size={13} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <button class="icon-btn" aria-label="刷新文件树" title="刷新文件树" onclick={() => void refresh()}>
        <RefreshCw size={13} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <button
        class="icon-btn"
        class:active={moreMenuOpen}
        aria-label="更多选项"
        title="更多选项"
        onclick={() => (moreMenuOpen = !moreMenuOpen)}
      >
        <MoreHorizontal size={13} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </span>
  </div>

  {#if moreMenuOpen}
    <div class="ctx-mask" role="presentation" onclick={() => (moreMenuOpen = false)}></div>
    <div class="more-menu menu-content" role="menu">
      <button
        class="menu-item"
        role="menuitem"
        onclick={() => {
          toggleSettings('showHidden');
          moreMenuOpen = false;
        }}
      >
        <span>{settings.showHidden ? '隐藏点开头的文件' : '显示隐藏文件'}</span>
        <span class="menu-shortcut">{settings.showHidden ? '已开启' : '已关闭'}</span>
      </button>
      <button
        class="menu-item"
        role="menuitem"
        onclick={() => {
          toggleSettings('showNodeModules');
          moreMenuOpen = false;
        }}
      >
        <span>{settings.showNodeModules ? '隐藏 node_modules' : '显示 node_modules'}</span>
        <span class="menu-shortcut">{settings.showNodeModules ? '已开启' : '已关闭'}</span>
      </button>
      <div class="menu-separator" role="separator"></div>
      <button
        class="menu-item"
        role="menuitem"
        onclick={() => {
          ui.settingsOpen = true;
          moreMenuOpen = false;
        }}
      >
        <span>外观与排版设置…</span>
        <span class="menu-shortcut">⌘,</span>
      </button>
    </div>
  {/if}

  <div
    class="tree-scroll"
    role="tree"
    tabindex="-1"
    aria-label="文件树"
    bind:this={scrollEl}
    onscroll={(e) => {
      scrollTop = (e.currentTarget as HTMLDivElement).scrollTop;
    }}
    oncontextmenu={(e) => e.preventDefault()}
    onkeydown={onTreeKeydown}
    bind:clientHeight={viewportHeight}
  >
    <div style="height: {range.totalHeight}px; position: relative;">
      {#each visible as row, i (row.node.path)}
        {@const Icon = getFileIcon(row.node.name, row.node.isDir, row.node.expanded)}
        <div
          class="tree-row"
          style="top: {(range.start + i) * ROW_HEIGHT}px; padding-left: {row.depth * 14 + 6}px;"
          class:dir={row.node.isDir}
          class:selected={row.node.path === workspace.selectedPath}
          class:focused={row.node.path === focusedPath}
          role="treeitem"
          aria-label={row.node.name}
          aria-level={row.depth + 1}
          aria-selected={row.node.path === workspace.selectedPath}
          aria-expanded={row.node.isDir ? row.node.expanded : undefined}
          tabindex={row.node.path === focusedPath ? 0 : -1}
          oncontextmenu={(e) => {
            showMenu(e, row.node);
            workspace.selectedPath = row.node.path;
            focusedPath = row.node.path;
          }}
          onkeydown={(e) => {
            if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
              e.preventDefault();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              showMenu(
                new MouseEvent('contextmenu', { clientX: rect.left + 8, clientY: rect.bottom }),
                row.node
              );
              return;
            }
            void onTreeKeydown(e);
          }}
          onclick={() => selectAndOpen(row.node)}
          onfocus={() => {
            focusedPath = row.node.path;
          }}
          title={row.node.path}
        >
          <span class="chevron" class:open={row.node.expanded}>
            {#if row.node.isDir}
              {#if row.node.expanded}
                <ChevronDown size={11} strokeWidth={1.5} aria-hidden="true" />
              {:else}
                <ChevronRight size={11} strokeWidth={1.5} aria-hidden="true" />
              {/if}
            {/if}
          </span>
          <span class="node-icon" class:dir-icon={row.node.isDir}>
            <Icon size={14} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span class="name" class:symlink={row.node.isSymlink}>{row.node.name}</span>
        </div>
      {/each}
    </div>
  </div>

  {#if menu}
    <div
      class="ctx-mask"
      role="presentation"
      onclick={() => hideMenu()}
      oncontextmenu={(e) => {
        e.preventDefault();
        hideMenu();
      }}
    ></div>
    <div
      class="ctx-menu menu-content"
      style="left: {menu.x}px; top: {menu.y}px;"
      role="menu"
      tabindex="-1"
      aria-label="文件操作"
      onkeydown={onMenuKeydown}
      use:focusMenu
    >
      {#each menu.items as item, idx (item.id)}
        {#if item.id === 'delete'}
          <div class="menu-separator" role="separator"></div>
        {/if}
        <button
          role="menuitem"
          class="menu-item"
          class:danger={item.danger}
          class:focused={idx === menuFocusIdx}
          tabindex={idx === menuFocusIdx ? 0 : -1}
          onclick={() => runMenuAction(item.id, menu!.node)}
        >
          <span>{item.label}</span>
          {#if item.shortcut}
            <span class="menu-shortcut">{item.shortcut}</span>
          {/if}
        </button>
      {/each}
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
    padding: 0 8px;
    height: 38px;
    box-sizing: border-box;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-panel);
    flex-shrink: 0;
    gap: 6px;
    position: relative;
  }
  .more-menu {
    position: absolute;
    top: 36px;
    right: 8px;
    z-index: 92;
  }
  .root-name {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .toolbar-right {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }
  .tree-scroll {
    flex: 1;
    overflow-y: auto;
    position: relative;
  }
  .tree-row {
    position: absolute;
    left: 0;
    right: 0;
    height: var(--row-height);
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition: background var(--transition-fast);
    border-radius: 4px;
    margin: 0 4px;
  }
  .tree-row:hover {
    background: var(--surface-hover);
  }
  .tree-row.selected {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--text-primary);
  }
  .tree-scroll:not(:focus-within) .tree-row.selected {
    background: color-mix(in srgb, var(--accent) 7%, transparent);
  }
  .tree-row.focused:focus-visible {
    outline: 1.5px solid var(--focus-ring);
    outline-offset: -1px;
  }
  .chevron {
    width: 14px;
    height: 14px;
    color: var(--text-secondary);
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .chevron.open {
    color: var(--text-primary);
  }
  .node-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    flex-shrink: 0;
  }
  .node-icon.dir-icon {
    color: var(--text-secondary);
  }
  .name {
    font-size: var(--font-size-ui);
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-primary);
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
  }
</style>
