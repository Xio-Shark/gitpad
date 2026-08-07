<script lang="ts">
  import { bumpGitTick, gitEvents, type Tab } from '$lib/state.svelte';
  import type { DiffFile } from '$lib/git';
  import { gitCommitDiff, gitDiff, gitStage, gitStatus, gitUnstage } from '$lib/git';
  import { isAppError } from '$lib/api';
  import DiffView from '../git/DiffView.svelte';

  let props = $props<{ tab: Tab }>();

  let error = $state<string | null>(null);
  let busy = $state(false);
  let stagedDiff = $state<DiffFile[]>([]);
  let unstagedDiff = $state<DiffFile[]>([]);
  let selStaged = $state<boolean[]>([]);
  let selUnstaged = $state<boolean[]>([]);
  let untracked = $state(false);
  let commitDiff = $state<DiffFile[]>([]);

  const ws = $derived(props.tab.workspace ?? '');
  const path = $derived(props.tab.path);
  const isCommit = $derived(!!props.tab.commitOid);

  // 首次挂载与面板里的暂存/提交操作（tick 变化）后自动刷新
  $effect(() => {
    void gitEvents.tick;
    void load();
  });

  async function load() {
    error = null;
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
      error = isAppError(e) ? e.message : String(e);
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
    error = null;
    try {
      await gitStage(ws, path, selectedHunkIndices(selUnstaged));
      bumpGitTick();
      await load();
    } catch (e) {
      error = isAppError(e) ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function doUnstage() {
    busy = true;
    error = null;
    try {
      await gitUnstage(ws, path, selectedHunkIndices(selStaged));
      bumpGitTick();
      await load();
    } catch (e) {
      error = isAppError(e) ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<div class="git-diff-renderer">
  {#if isCommit}
    <div class="label">提交 {props.tab.commitOid?.slice(0, 8)}</div>
    <DiffView files={commitDiff} readonly />
  {:else}
    <div class="toolbar">
      <span class="path" title={path}>{path}</span>
      {#if untracked}
        <span class="tag">未跟踪</span>
      {/if}
      <div class="actions">
        <button disabled={busy || countHunks(stagedDiff) === 0} onclick={() => void doUnstage()}>撤销暂存</button>
        <button disabled={busy || countHunks(unstagedDiff) === 0} onclick={() => void doStage()}>暂存</button>
      </div>
    </div>
    {#if error}
      <div class="error">{error}</div>
    {/if}
    {#if untracked && countHunks(stagedDiff) === 0 && countHunks(unstagedDiff) === 0}
      <div class="empty-note">未跟踪文件，勾选后在 Git 面板提交，或先暂存查看差异</div>
    {:else if countHunks(stagedDiff) === 0 && countHunks(unstagedDiff) === 0}
      <div class="empty-note">该文件当前没有变更</div>
    {:else}
      {#if countHunks(stagedDiff) > 0}
        <div class="label">已暂存变更</div>
        <DiffView
          files={stagedDiff}
          selection={{
            selected: selStaged,
            onToggle: (i) => (selStaged[i] = !selStaged[i]),
          }}
        />
      {/if}
      {#if countHunks(unstagedDiff) > 0}
        <div class="label">未暂存变更</div>
        <DiffView
          files={unstagedDiff}
          selection={{
            selected: selUnstaged,
            onToggle: (i) => (selUnstaged[i] = !selUnstaged[i]),
          }}
        />
      {/if}
    {/if}
  {/if}
</div>

<style>
  .git-diff-renderer {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--bg-secondary);
  }
  .path {
    font-size: 12px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tag {
    font-size: 10px;
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0 5px;
    flex-shrink: 0;
  }
  .actions {
    margin-left: auto;
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
  .actions button {
    font-size: 11px;
    padding: 2px 10px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
  }
  .actions button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .error {
    padding: 6px 10px;
    font-size: 11px;
    color: var(--danger);
    border-bottom: 1px solid var(--border);
  }
  .label {
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    background: rgba(110, 118, 129, 0.1);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .empty-note {
    padding: 16px 10px;
    font-size: 12px;
    color: var(--text-secondary);
  }
</style>
