<script lang="ts">
  import type { TreeNode } from '$lib/state.svelte';
  import { toggleNode } from '$lib/state.svelte';
  import { settings } from '$lib/settings.svelte';
  import { reloadRoot } from '$lib/state.svelte';
  import { visibleRange } from '$lib/utils/windowing';

  let props = $props<{
    root: TreeNode | null;
    onFileClick: (path: string) => void;
  }>();

  let scrollEl = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let viewportHeight = $state(600);

  const ROW_HEIGHT = 24;

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
    await reloadRoot();
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
    </span>
  </div>
  <div
    class="tree-scroll"
    bind:this={scrollEl}
    onscroll={(e) => {
      scrollTop = (e.currentTarget as HTMLDivElement).scrollTop;
    }}
    bind:clientHeight={viewportHeight}
  >
    <div style="height: {range.totalHeight}px; position: relative;">
      {#each visible as row, i (row.node.path)}
        <div
          class="tree-row"
          style="top: {(range.start + i) * ROW_HEIGHT}px; padding-left: {row.depth * 14 + 6}px;"
          class:dir={row.node.isDir}
          role="treeitem"
          aria-label={row.node.name}
          aria-selected="false"
          tabindex="-1"
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (row.node.isDir) toggleNode(row.node);
              else props.onFileClick(row.node.path);
            }
          }}
          onclick={() => {
            if (row.node.isDir) toggleNode(row.node);
            else props.onFileClick(row.node.path);
          }}
          title={row.node.path}
        >
          <span class="chevron" class:open={row.node.expanded}>{row.node.isDir ? (row.node.expanded ? '▾' : '▸') : ''}</span>
          <span class="name" class:symlink={row.node.isSymlink}>{row.node.name}</span>
        </div>
      {/each}
    </div>
  </div>
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
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name.symlink {
    font-style: italic;
    color: var(--text-secondary);
  }
</style>
