<script lang="ts">
  import type { Change, StatusData } from '$lib/git';
  import { gitCommit, gitStatus } from '$lib/git';
  import { isAppError } from '$lib/api';
  import { bumpGitTick, gitEvents, openFile, openGitDiff } from '$lib/state.svelte';

  let props = $props<{
    workspace: string;
    onStatus: (s: StatusData) => void;
  }>();

  let status = $state<StatusData | null>(null);
  let error = $state<string | null>(null);
  let commitMsg = $state('');
  let busy = $state(false);

  // 首次挂载与编辑区暂存/撤销操作后自动刷新
  $effect(() => {
    void gitEvents.tick;
    void refresh();
  });

  async function refresh() {
    error = null;
    try {
      status = await gitStatus(props.workspace);
      props.onStatus(status);
    } catch (e) {
      error = isAppError(e) ? e.message : String(e);
    }
  }

  const staged = $derived(status?.changes.filter((c) => c.staged) ?? []);
  const unstaged = $derived(status?.changes.filter((c) => !c.staged && !c.untracked) ?? []);
  const untracked = $derived(status?.changes.filter((c) => c.untracked) ?? []);

  async function doCommit() {
    if (!commitMsg.trim() || busy) return;
    busy = true;
    error = null;
    try {
      await gitCommit(props.workspace, commitMsg);
      commitMsg = '';
      await refresh();
      bumpGitTick();
    } catch (e) {
      error = isAppError(e) ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  function statusBadge(c: Change): string {
    if (c.untracked) return '?';
    return c.status;
  }
</script>

<div class="changes-view">
  {#if error}
    <div class="panel-error">{error}</div>
  {/if}
  {#if !status}
    <div class="empty-note">加载中…</div>
  {:else}
    <div class="sections">
      <div class="section">
        <div class="section-title">已暂存</div>
        {#if staged.length === 0}
          <div class="empty-note">无</div>
        {:else}
          {#each staged as c (c.path)}
            <button class="file-row" onclick={() => openGitDiff(c.path, props.workspace)}>
              <span class="badge badge-staged">{statusBadge(c)}</span>
              <span class="fname" title={c.path}>{c.path}</span>
            </button>
          {/each}
        {/if}
      </div>
      <div class="section">
        <div class="section-title">未暂存</div>
        {#if unstaged.length === 0}
          <div class="empty-note">无</div>
        {:else}
          {#each unstaged as c (c.path)}
            <button class="file-row" onclick={() => openGitDiff(c.path, props.workspace)}>
              <span class="badge badge-unstaged">{statusBadge(c)}</span>
              <span class="fname" title={c.path}>{c.path}</span>
            </button>
          {/each}
        {/if}
      </div>
      <div class="section">
        <div class="section-title">未跟踪</div>
        {#if untracked.length === 0}
          <div class="empty-note">无</div>
        {:else}
          {#each untracked as c (c.path)}
            <button class="file-row" onclick={() => openFile(c.path)}>
              <span class="badge badge-untracked">{statusBadge(c)}</span>
              <span class="fname" title={c.path}>{c.path}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>

    <div class="empty-note hint">点击文件在中间编辑区查看 diff</div>

    <div class="commit-area">
      <textarea
        class="commit-input"
        placeholder="提交信息…（Cmd+Enter 提交）"
        bind:value={commitMsg}
        rows="2"
        onkeydown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void doCommit();
          }
        }}
      ></textarea>
      <div class="commit-row">
        <span class="commit-count">{commitMsg.trim().length}</span>
        <button class="commit-btn" disabled={busy || !commitMsg.trim()} onclick={() => void doCommit()}>
          {busy ? '提交中…' : '提交'}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .changes-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .sections {
    flex-shrink: 0;
    overflow: auto;
  }
  .section-title {
    padding: 5px 10px 2px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border);
  }
  .file-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 3px 10px;
    background: none;
    border: none;
    color: var(--text);
    font-size: var(--ui-font-size, 14px);
    cursor: pointer;
    text-align: left;
  }
  .file-row:hover {
    background: var(--hover);
  }
  .badge {
    font-size: 10px;
    font-family: var(--font-mono);
    flex-shrink: 0;
  }
  .badge-staged {
    color: #4aae6b;
  }
  .badge-unstaged {
    color: #d29922;
  }
  .badge-untracked {
    color: var(--text-secondary);
  }
  .fname {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .commit-area {
    border-top: 1px solid var(--border);
    padding: 6px 8px;
    flex-shrink: 0;
  }
  .commit-input {
    width: 100%;
    resize: none;
    font-family: inherit;
    font-size: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    padding: 4px 6px;
  }
  .commit-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
  }
  .commit-count {
    font-size: 11px;
    color: var(--text-secondary);
  }
  .commit-btn {
    font-size: 12px;
    padding: 3px 14px;
    border-radius: 4px;
    border: none;
    background: var(--accent);
    color: var(--text-on-accent);
    cursor: pointer;
  }
  .commit-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .panel-error {
    padding: 6px 10px;
    font-size: 11px;
    color: var(--danger);
    border-bottom: 1px solid var(--border);
  }
  .empty-note {
    padding: 6px 10px;
    font-size: 11px;
    color: var(--text-secondary);
  }
  .hint {
    padding: 10px 10px;
    font-size: 11px;
  }
</style>
