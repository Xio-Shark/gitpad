<script lang="ts">
  import { toast } from 'svelte-sonner';
  import ArrowDownToLine from 'lucide-svelte/icons/arrow-down-to-line';
  import ArrowUpFromLine from 'lucide-svelte/icons/arrow-up-from-line';
  import RotateCw from 'lucide-svelte/icons/rotate-cw';
  import GitBranch from 'lucide-svelte/icons/git-branch';
  import { workspace, ui, bumpGitTick } from '$lib/state.svelte';
  import type { StatusData } from '$lib/git';
  import { gitPull, gitPush, gitStatus } from '$lib/git';
  import { isAppError } from '$lib/api';
  import ChangesView from './git/ChangesView.svelte';
  import HistoryView from './git/HistoryView.svelte';

  let status = $state<StatusData | null>(null);
  let busy = $state(false);

  const rootPath = $derived(workspace.rootPath);

  async function doPush() {
    if (!rootPath || busy) return;
    busy = true;
    try {
      const branch = await gitPush(rootPath);
      toast.success(`已推送到远端 (${branch})`);
      refreshStatus();
      bumpGitTick();
    } catch (e) {
      toast.error(isAppError(e) ? `推送失败：${e.message}` : `推送失败：${String(e)}`);
    } finally {
      busy = false;
    }
  }

  async function doPull() {
    if (!rootPath || busy) return;
    busy = true;
    try {
      const msg = await gitPull(rootPath);
      toast.success(msg || '已成功拉取远端更新');
      refreshStatus();
      bumpGitTick();
    } catch (e) {
      toast.error(isAppError(e) ? `拉取失败：${e.message}` : `拉取失败：${String(e)}`);
    } finally {
      busy = false;
    }
  }

  function refreshStatus() {
    if (!rootPath) return;
    void gitStatus(rootPath).then((s) => (status = s));
  }

  function onGitTabKeydown(e: KeyboardEvent, which: 'changes' | 'history') {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      ui.gitTab = which === 'changes' ? 'history' : 'changes';
      queueMicrotask(() => {
        document.getElementById(`git-tab-${ui.gitTab}`)?.focus();
      });
    } else if (e.key === 'Home') {
      e.preventDefault();
      ui.gitTab = 'changes';
      queueMicrotask(() => document.getElementById('git-tab-changes')?.focus());
    } else if (e.key === 'End') {
      e.preventDefault();
      ui.gitTab = 'history';
      queueMicrotask(() => document.getElementById('git-tab-history')?.focus());
    }
  }
</script>

<div class="git-panel">
  <!-- 顶栏：分支与同步操作 -->
  <div class="toolbar nav-surface">
    <div class="branch-wrap">
      <GitBranch size={13} strokeWidth={1.5} class="branch-icon" />
      <span class="branch-name" title={status?.branch}>{status?.branch ?? 'Git'}</span>
    </div>
    {#if status && (status.ahead > 0 || status.behind > 0)}
      <span class="ahead-behind" title={`领先 ${status.ahead}，落后 ${status.behind}`}>
        ↑{status.ahead} ↓{status.behind}
      </span>
    {/if}
    <div class="toolbar-actions">
      <button
        class="icon-action-btn"
        aria-label="刷新状态"
        title="刷新 Git 状态"
        onclick={refreshStatus}
        disabled={busy || !rootPath}
      >
        <RotateCw size={12} strokeWidth={1.5} />
      </button>
      <button
        class="icon-action-btn"
        aria-label="拉取"
        title="拉取远端更新"
        onclick={() => void doPull()}
        disabled={busy || !rootPath}
      >
        <ArrowDownToLine size={13} strokeWidth={1.5} />
      </button>
      <button
        class="icon-action-btn"
        aria-label="推送"
        title="推送到远端"
        onclick={() => void doPush()}
        disabled={busy || !rootPath}
      >
        <ArrowUpFromLine size={13} strokeWidth={1.5} />
      </button>
    </div>
  </div>

  <!-- 分段式标签栏 -->
  <div class="tabs-bar" role="tablist" aria-label="Git 视图">
    <div class="segmented-wrap">
      <button
        id="git-tab-changes"
        role="tab"
        aria-selected={ui.gitTab === 'changes'}
        tabindex={ui.gitTab === 'changes' ? 0 : -1}
        class="segment-item"
        class:active={ui.gitTab === 'changes'}
        onclick={() => (ui.gitTab = 'changes')}
        onkeydown={(e) => onGitTabKeydown(e, 'changes')}
      >
        <span>变更</span>
        {#if status && status.changes.length > 0}
          <span class="segment-badge">{status.changes.length}</span>
        {/if}
      </button>
      <button
        id="git-tab-history"
        role="tab"
        aria-selected={ui.gitTab === 'history'}
        tabindex={ui.gitTab === 'history' ? 0 : -1}
        class="segment-item"
        class:active={ui.gitTab === 'history'}
        onclick={() => (ui.gitTab = 'history')}
        onkeydown={(e) => onGitTabKeydown(e, 'history')}
      >
        <span>历史</span>
      </button>
    </div>
  </div>

  <!-- 主体视图 -->
  {#if !rootPath}
    <div class="empty-note">未打开工作区</div>
  {:else if ui.gitTab === 'changes'}
    <div class="panel-body">
      <ChangesView workspace={rootPath} onStatus={(s) => (status = s)} />
    </div>
  {:else}
    <div class="panel-body">
      <HistoryView workspace={rootPath} />
    </div>
  {/if}
</div>

<style>
  .git-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--border-subtle);
    min-width: 0;
    background: var(--surface-panel);
    user-select: none;
    overscroll-behavior: contain;
  }
  .toolbar {
    display: flex;
    align-items: center;
    padding: 0 8px;
    height: 38px;
    box-sizing: border-box;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-panel);
    flex-shrink: 0;
  }
  .branch-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex-shrink: 1;
  }
  :global(.branch-icon) {
    color: var(--accent);
    flex-shrink: 0;
  }
  .branch-name {
    font-size: 12px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-primary);
  }
  .ahead-behind {
    font-size: 10.5px;
    color: var(--text-secondary);
    font-family: var(--font-code);
    background: var(--surface-app);
    border: 1px solid var(--border-subtle);
    padding: 1px 5px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .toolbar-actions {
    margin-left: auto;
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }
  .icon-action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-control);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .icon-action-btn:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text-primary);
    border-color: var(--border-subtle);
  }
  .icon-action-btn:active:not(:disabled) {
    transform: scale(0.92);
  }
  .icon-action-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* 分段标签栏 */
  .tabs-bar {
    padding: 6px 10px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-panel);
    flex-shrink: 0;
  }
  .segmented-wrap {
    display: flex;
    background: var(--surface-app);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    padding: 2px;
    gap: 2px;
  }
  .segment-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 11.5px;
    padding: 4px 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .segment-item:hover {
    color: var(--text-primary);
  }
  .segment-item.active {
    background: var(--surface-panel);
    color: var(--text-primary);
    font-weight: 500;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
  .segment-badge {
    font-size: 9.5px;
    font-family: var(--font-code);
    padding: 0 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
    font-weight: 600;
  }

  .panel-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overscroll-behavior: contain;
  }
  .empty-note {
    padding: 32px 16px;
    font-size: 12px;
    color: var(--text-secondary);
    text-align: center;
  }
</style>
