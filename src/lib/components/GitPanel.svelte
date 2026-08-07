<script lang="ts">
  import { workspace } from '$lib/state.svelte';
  import type { StatusData } from '$lib/git';
  import { gitPull, gitPush, gitStatus } from '$lib/git';
  import { isAppError } from '$lib/api';
  import ChangesView from './git/ChangesView.svelte';
  import HistoryView from './git/HistoryView.svelte';

  let tab = $state<'changes' | 'history'>('changes');
  let status = $state<StatusData | null>(null);
  let busy = $state(false);
  let opError = $state<string | null>(null);
  let opInfo = $state<string | null>(null);

  const rootPath = $derived(workspace.rootPath);

  async function doPush() {
    if (!rootPath || busy) return;
    busy = true;
    opError = null;
    opInfo = null;
    try {
      const branch = await gitPush(rootPath);
      opInfo = `已推送 ${branch}`;
      refreshStatus();
    } catch (e) {
      opError = isAppError(e) ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function doPull() {
    if (!rootPath || busy) return;
    busy = true;
    opError = null;
    opInfo = null;
    try {
      const msg = await gitPull(rootPath);
      opInfo = msg;
      refreshStatus();
    } catch (e) {
      opError = isAppError(e) ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  function refreshStatus() {
    if (!rootPath) return;
    void gitStatus(rootPath).then((s) => (status = s));
  }
</script>

<div class="git-panel">
  <div class="toolbar">
    <span class="branch" title={status?.branch}>{status?.branch ?? 'Git'}</span>
    <span class="ahead-behind">
      {#if status && (status.ahead > 0 || status.behind > 0)}
        ↑{status.ahead} ↓{status.behind}
      {/if}
    </span>
    <div class="toolbar-actions">
      <button title="拉取" onclick={() => void doPull()} disabled={busy || !rootPath}>⇣</button>
      <button title="推送" onclick={() => void doPush()} disabled={busy || !rootPath}>⇡</button>
    </div>
  </div>
  <div class="tabs">
    <button class:active={tab === 'changes'} onclick={() => (tab = 'changes')}>变更</button>
    <button class:active={tab === 'history'} onclick={() => (tab = 'history')}>历史</button>
  </div>
  {#if opError}
    <div class="op-error">{opError}</div>
  {/if}
  {#if opInfo}
    <div class="op-info">{opInfo}</div>
  {/if}
  {#if !rootPath}
    <div class="empty-note">未打开工作区</div>
  {:else if tab === 'changes'}
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
    border-left: 1px solid var(--border);
    min-width: 0;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .branch {
    font-size: 12px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 1;
  }
  .ahead-behind {
    font-size: 10px;
    color: var(--text-secondary);
    font-family: var(--font-mono);
    flex-shrink: 0;
  }
  .toolbar-actions {
    margin-left: auto;
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  .toolbar button {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text);
    cursor: pointer;
  }
  .toolbar button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .tabs button {
    flex: 1;
    font-size: 11px;
    padding: 5px 0;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-secondary);
    cursor: pointer;
  }
  .tabs button.active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }
  .panel-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .op-error {
    padding: 4px 10px;
    font-size: 11px;
    color: var(--danger);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .op-info {
    padding: 4px 10px;
    font-size: 11px;
    color: #4aae6b;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .empty-note {
    padding: 10px;
    font-size: 12px;
    color: var(--text-secondary);
  }
</style>
