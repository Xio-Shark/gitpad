<script lang="ts">
  import { toast } from 'svelte-sonner';
  import Columns from 'lucide-svelte/icons/columns';
  import AlignJustify from 'lucide-svelte/icons/align-justify';
  import Check from 'lucide-svelte/icons/check';
  import Undo2 from 'lucide-svelte/icons/undo-2';
  import { bumpGitTick, gitEvents, type Tab } from '$lib/state.svelte';
  import type { DiffFile } from '$lib/git';
  import { gitCommitDiff, gitDiff, gitStage, gitStatus, gitUnstage } from '$lib/git';
  import { isAppError } from '$lib/api';
  import DiffView from '../git/DiffView.svelte';

  let props = $props<{ tab: Tab }>();

  let busy = $state(false);
  let stagedDiff = $state<DiffFile[]>([]);
  let unstagedDiff = $state<DiffFile[]>([]);
  let selStaged = $state<boolean[]>([]);
  let selUnstaged = $state<boolean[]>([]);
  let untracked = $state(false);
  let commitDiff = $state<DiffFile[]>([]);
  let viewMode = $state<'unified' | 'split'>('unified');

  const ws = $derived(props.tab.workspace ?? '');
  const path = $derived(props.tab.path);
  const isCommit = $derived(!!props.tab.commitOid);

  // 首次挂载与面板里的暂存/提交操作（tick 变化）后自动刷新
  $effect(() => {
    void gitEvents.tick;
    void load();
  });

  async function load() {
    try {
      if (isCommit) {
        commitDiff = await gitCommitDiff(ws, props.tab.commitOid!);
        return;
      }
      const [sd, ud, st] = await Promise.all([
        gitDiff(ws, path, true),
        gitDiff(ws, path, false),
        gitStatus(ws),
      ]);
      untracked = st.changes.some((c) => c.path === path && c.untracked);
      stagedDiff = sd;
      unstagedDiff = ud;
      selStaged = sd.flatMap((f) => f.hunks.map(() => true));
      selUnstaged = ud.flatMap((f) => f.hunks.map(() => true));
    } catch (e) {
      toast.error(isAppError(e) ? e.message : String(e));
    }
  }

  function selectedHunkIndices(mask: boolean[]): number[] {
    return mask.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  }

  function countHunks(files: DiffFile[]): number {
    return files.reduce((acc, f) => acc + f.hunks.length, 0);
  }

  async function doStage() {
    busy = true;
    try {
      await gitStage(ws, path, selectedHunkIndices(selUnstaged));
      bumpGitTick();
      await load();
      toast.success('已暂存选中区块');
    } catch (e) {
      const msg = isAppError(e) ? e.message : String(e);
      toast.error(`暂存失败: ${msg}`);
    } finally {
      busy = false;
    }
  }

  async function doUnstage() {
    busy = true;
    try {
      await gitUnstage(ws, path, selectedHunkIndices(selStaged));
      bumpGitTick();
      await load();
      toast.success('已撤销暂存区块');
    } catch (e) {
      const msg = isAppError(e) ? e.message : String(e);
      toast.error(`撤销暂存失败: ${msg}`);
    } finally {
      busy = false;
    }
  }
</script>

<div class="git-diff-renderer">
  <div class="diff-header">
    <div class="header-left">
      <span class="file-path" title={path}>
        {isCommit ? `提交 ${props.tab.commitOid?.slice(0, 8)}：${props.tab.name}` : path}
      </span>
      {#if untracked}
        <span class="tag-badge untracked">未跟踪</span>
      {/if}
    </div>

    <div class="header-actions">
      <!-- Split / Unified Toggle -->
      <div class="view-toggle-group">
        <button
          class="toggle-btn"
          class:active={viewMode === 'unified'}
          title="单栏视图 (Unified)"
          aria-label="单栏视图"
          onclick={() => (viewMode = 'unified')}
        >
          <AlignJustify size={13} strokeWidth={1.75} aria-hidden="true" />
          <span>单栏</span>
        </button>
        <button
          class="toggle-btn"
          class:active={viewMode === 'split'}
          title="双栏对比视图 (Split)"
          aria-label="双栏视图"
          onclick={() => (viewMode = 'split')}
        >
          <Columns size={13} strokeWidth={1.75} aria-hidden="true" />
          <span>双栏</span>
        </button>
      </div>

      {#if !isCommit}
        <div class="stage-actions">
          <button
            class="action-btn"
            disabled={busy || countHunks(stagedDiff) === 0}
            onclick={() => void doUnstage()}
            title="撤销暂存勾选的区块"
          >
            <Undo2 size={13} strokeWidth={1.75} aria-hidden="true" />
            <span>撤销暂存</span>
          </button>
          <button
            class="action-btn primary"
            disabled={busy || countHunks(unstagedDiff) === 0}
            onclick={() => void doStage()}
            title="暂存勾选的区块"
          >
            <Check size={13} strokeWidth={2} aria-hidden="true" />
            <span>暂存区块</span>
          </button>
        </div>
      {/if}
    </div>
  </div>

  <div class="diff-content-scroll">
    {#if isCommit}
      <DiffView files={commitDiff} readonly {viewMode} />
    {:else}
      {#if untracked && countHunks(stagedDiff) === 0 && countHunks(unstagedDiff) === 0}
        <div class="empty-placeholder">新文件尚未加入版本控制，在右侧 Git 面板可暂存或提交</div>
      {:else if countHunks(stagedDiff) === 0 && countHunks(unstagedDiff) === 0}
        <div class="empty-placeholder">当前文件没有差异</div>
      {:else}
        {#if countHunks(stagedDiff) > 0}
          <div class="section-label staged">
            <span>已暂存变更 ({countHunks(stagedDiff)} 个区块)</span>
          </div>
          <DiffView
            files={stagedDiff}
            {viewMode}
            selection={{
              selected: selStaged,
              onToggle: (i) => (selStaged[i] = !selStaged[i]),
            }}
          />
        {/if}
        {#if countHunks(unstagedDiff) > 0}
          <div class="section-label unstaged">
            <span>未暂存变更 ({countHunks(unstagedDiff)} 个区块)</span>
          </div>
          <DiffView
            files={unstagedDiff}
            {viewMode}
            selection={{
              selected: selUnstaged,
              onToggle: (i) => (selUnstaged[i] = !selUnstaged[i]),
            }}
          />
        {/if}
      {/if}
    {/if}
  </div>
</div>

<style>
  .git-diff-renderer {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--surface-app);
  }
  .diff-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-panel);
    flex-shrink: 0;
    gap: 10px;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .file-path {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tag-badge {
    font-size: 10.5px;
    padding: 1px 6px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--warning) 15%, transparent);
    color: var(--warning);
    border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent);
    flex-shrink: 0;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .view-toggle-group {
    display: flex;
    background: var(--surface-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-control);
    padding: 2px;
    gap: 2px;
  }
  .toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    font-size: 11px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    border-radius: 3px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .toggle-btn:hover {
    color: var(--text-primary);
  }
  .toggle-btn.active {
    background: var(--surface-panel);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }
  .stage-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    padding: 3px 10px;
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: var(--surface-panel);
    color: var(--text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .action-btn:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--border-strong);
  }
  .action-btn.primary {
    background: var(--accent);
    color: var(--text-on-accent);
    border-color: var(--accent);
  }
  .action-btn.primary:hover:not(:disabled) {
    opacity: 0.9;
  }
  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .diff-content-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .section-label {
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.3px;
    background: var(--surface-panel);
    border-bottom: 1px solid var(--border-subtle);
    border-top: 1px solid var(--border-subtle);
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .section-label.staged {
    color: var(--success);
  }
  .section-label.unstaged {
    color: var(--text-secondary);
  }
  .empty-placeholder {
    padding: 32px 16px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 12.5px;
  }
</style>
