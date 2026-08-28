<script lang="ts">
  import { toast } from 'svelte-sonner';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import CornerDownLeft from 'lucide-svelte/icons/corner-down-left';
  import Plus from 'lucide-svelte/icons/plus';
  import Minus from 'lucide-svelte/icons/minus';
  import type { Change, StatusData } from '$lib/git';
  import { gitCommit, gitStage, gitStatus, gitUnstage } from '$lib/git';
  import { isAppError } from '$lib/api';
  import { bumpGitTick, gitEvents, openFile, openGitDiff } from '$lib/state.svelte';
  import { getFileIcon } from '$lib/utils/file-icons';

  let props = $props<{
    workspace: string;
    onStatus: (s: StatusData) => void;
  }>();

  let status = $state<StatusData | null>(null);
  let error = $state<string | null>(null);
  let commitMsg = $state('');
  let busy = $state(false);

  let stagedOpen = $state(true);
  let unstagedOpen = $state(true);
  let untrackedOpen = $state(true);

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
      const hash = await gitCommit(props.workspace, commitMsg.trim());
      toast.success(`提交成功 (${hash.slice(0, 7)})`);
      commitMsg = '';
      await refresh();
      bumpGitTick();
    } catch (e) {
      const msg = isAppError(e) ? e.message : String(e);
      error = msg;
      toast.error(`提交失败: ${msg}`);
    } finally {
      busy = false;
    }
  }

  async function stageAll(changes: Change[]) {
    if (busy || changes.length === 0) return;
    busy = true;
    try {
      for (const c of changes) {
        await gitStage(props.workspace, c.path);
      }
      bumpGitTick();
      await refresh();
      toast.success(`已暂存 ${changes.length} 个文件`);
    } catch (e) {
      toast.error(isAppError(e) ? e.message : String(e));
    } finally {
      busy = false;
    }
  }

  async function unstageAll(changes: Change[]) {
    if (busy || changes.length === 0) return;
    busy = true;
    try {
      for (const c of changes) {
        await gitUnstage(props.workspace, c.path);
      }
      bumpGitTick();
      await refresh();
      toast.success(`已取消暂存 ${changes.length} 个文件`);
    } catch (e) {
      toast.error(isAppError(e) ? e.message : String(e));
    } finally {
      busy = false;
    }
  }

  async function stageSingle(e: MouseEvent, file: string) {
    e.stopPropagation();
    busy = true;
    try {
      await gitStage(props.workspace, file);
      bumpGitTick();
      await refresh();
    } catch (e) {
      toast.error(isAppError(e) ? e.message : String(e));
    } finally {
      busy = false;
    }
  }

  async function unstageSingle(e: MouseEvent, file: string) {
    e.stopPropagation();
    busy = true;
    try {
      await gitUnstage(props.workspace, file);
      bumpGitTick();
      await refresh();
    } catch (e) {
      toast.error(isAppError(e) ? e.message : String(e));
    } finally {
      busy = false;
    }
  }

  function splitPath(fullPath: string): { dir: string; name: string } {
    const parts = fullPath.split('/');
    const name = parts.pop() ?? fullPath;
    const dir = parts.length > 0 ? parts.join('/') + '/' : '';
    return { dir, name };
  }

  function statusBadge(c: Change): { text: string; kind: 'm' | 'a' | 'd' | 'u' } {
    if (c.untracked) return { text: 'U', kind: 'u' };
    const s = c.status.toUpperCase();
    if (s.includes('D')) return { text: 'D', kind: 'd' };
    if (s.includes('A')) return { text: 'A', kind: 'a' };
    return { text: 'M', kind: 'm' };
  }
</script>

<div class="changes-view">
  {#if error}
    <div class="panel-error">{error}</div>
  {/if}

  {#if !status}
    <div class="empty-note">扫描变更中…</div>
  {:else}
    <div class="sections-scroll">
      <!-- 1. 已暂存变更 -->
      <section class="change-group">
        <div class="group-header">
          <button
            class="header-toggle"
            onclick={() => (stagedOpen = !stagedOpen)}
            aria-expanded={stagedOpen}
          >
            <span class="chevron-icon">
              {#if stagedOpen}
                <ChevronDown size={12} strokeWidth={2} />
              {:else}
                <ChevronRight size={12} strokeWidth={2} />
              {/if}
            </span>
            <span class="group-title">已暂存变更</span>
            <span class="count-pill" class:active={staged.length > 0}>{staged.length}</span>
          </button>
          {#if staged.length > 0}
            <button
              class="group-action-btn"
              title="全部取消暂存"
              disabled={busy}
              onclick={() => void unstageAll(staged)}
            >
              <Minus size={12} strokeWidth={2} />
            </button>
          {/if}
        </div>

        {#if stagedOpen}
          {#if staged.length === 0}
            <div class="group-empty">无已暂存文件</div>
          {:else}
            <div class="files-list">
              {#each staged as c (c.path)}
                {@const Icon = getFileIcon(c.path, false)}
                {@const { dir, name } = splitPath(c.path)}
                {@const b = statusBadge(c)}
                <div
                  class="file-row"
                  role="button"
                  tabindex="0"
                  onclick={() => openGitDiff(c.path, props.workspace)}
                  onkeydown={(e) => e.key === 'Enter' && openGitDiff(c.path, props.workspace)}
                >
                  <span class="file-icon"><Icon size={14} strokeWidth={1.5} /></span>
                  <span class="file-path-text" title={c.path}>
                    <span class="file-name">{name}</span>
                    {#if dir}<span class="dir-prefix">{dir}</span>{/if}
                  </span>
                  <span class="status-badge status-{b.kind}">{b.text}</span>
                  <button
                    class="row-action-btn"
                    title="取消暂存"
                    onclick={(e) => void unstageSingle(e, c.path)}
                  >
                    <Minus size={12} strokeWidth={1.5} />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </section>

      <!-- 2. 未暂存变更 -->
      <section class="change-group">
        <div class="group-header">
          <button
            class="header-toggle"
            onclick={() => (unstagedOpen = !unstagedOpen)}
            aria-expanded={unstagedOpen}
          >
            <span class="chevron-icon">
              {#if unstagedOpen}
                <ChevronDown size={12} strokeWidth={1.5} />
              {:else}
                <ChevronRight size={12} strokeWidth={1.5} />
              {/if}
            </span>
            <span class="group-title">未暂存变更</span>
            <span class="count-pill" class:active={unstaged.length > 0}>{unstaged.length}</span>
          </button>
          {#if unstaged.length > 0}
            <button
              class="group-action-btn"
              title="全部暂存"
              disabled={busy}
              onclick={() => void stageAll(unstaged)}
            >
              <Plus size={12} strokeWidth={1.5} />
            </button>
          {/if}
        </div>

        {#if unstagedOpen}
          {#if unstaged.length === 0}
            <div class="group-empty">工作区干净</div>
          {:else}
            <div class="files-list">
              {#each unstaged as c (c.path)}
                {@const Icon = getFileIcon(c.path, false)}
                {@const { dir, name } = splitPath(c.path)}
                {@const b = statusBadge(c)}
                <div
                  class="file-row"
                  role="button"
                  tabindex="0"
                  onclick={() => openGitDiff(c.path, props.workspace)}
                  onkeydown={(e) => e.key === 'Enter' && openGitDiff(c.path, props.workspace)}
                >
                  <span class="file-icon"><Icon size={14} strokeWidth={1.5} /></span>
                  <span class="file-path-text" title={c.path}>
                    <span class="file-name">{name}</span>
                    {#if dir}<span class="dir-prefix">{dir}</span>{/if}
                  </span>
                  <span class="status-badge status-{b.kind}">{b.text}</span>
                  <button
                    class="row-action-btn"
                    title="暂存文件"
                    onclick={(e) => void stageSingle(e, c.path)}
                  >
                    <Plus size={12} strokeWidth={1.5} />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </section>

      <!-- 3. 未跟踪文件 -->
      <section class="change-group">
        <div class="group-header">
          <button
            class="header-toggle"
            onclick={() => (untrackedOpen = !untrackedOpen)}
            aria-expanded={untrackedOpen}
          >
            <span class="chevron-icon">
              {#if untrackedOpen}
                <ChevronDown size={12} strokeWidth={1.5} />
              {:else}
                <ChevronRight size={12} strokeWidth={1.5} />
              {/if}
            </span>
            <span class="group-title">未跟踪文件</span>
            <span class="count-pill" class:active={untracked.length > 0}>{untracked.length}</span>
          </button>
          {#if untracked.length > 0}
            <button
              class="group-action-btn"
              title="全部暂存"
              disabled={busy}
              onclick={() => void stageAll(untracked)}
            >
              <Plus size={12} strokeWidth={1.5} />
            </button>
          {/if}
        </div>

        {#if untrackedOpen}
          {#if untracked.length === 0}
            <div class="group-empty">无新文件</div>
          {:else}
            <div class="files-list">
              {#each untracked as c (c.path)}
                {@const Icon = getFileIcon(c.path, false)}
                {@const { dir, name } = splitPath(c.path)}
                {@const b = statusBadge(c)}
                <div
                  class="file-row"
                  role="button"
                  tabindex="0"
                  onclick={() => openFile(c.path.startsWith('/') ? c.path : `${props.workspace}/${c.path}`)}
                  onkeydown={(e) => e.key === 'Enter' && openFile(c.path.startsWith('/') ? c.path : `${props.workspace}/${c.path}`)}
                >
                  <span class="file-icon"><Icon size={14} strokeWidth={1.5} /></span>
                  <span class="file-path-text" title={c.path}>
                    <span class="file-name">{name}</span>
                    {#if dir}<span class="dir-prefix">{dir}</span>{/if}
                  </span>
                  <span class="status-badge status-{b.kind}">U</span>
                  <button
                    class="row-action-btn"
                    title="暂存文件"
                    onclick={(e) => void stageSingle(e, c.path)}
                  >
                    <Plus size={12} strokeWidth={1.5} />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </section>
    </div>

    <!-- 底部提交框 -->
    <div class="commit-dock">
      <textarea
        class="commit-textarea"
        placeholder="提交说明… (⌘Enter 快速提交)"
        bind:value={commitMsg}
        rows="2"
        onkeydown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void doCommit();
          }
        }}
      ></textarea>
      <div class="commit-actions">
        <span class="commit-hint">{commitMsg.trim().length} 字符 · ⌘↵</span>
        <button
          class="commit-submit-btn"
          disabled={busy || !commitMsg.trim()}
          onclick={() => void doCommit()}
        >
          <span>{busy ? '提交中…' : '提交'}</span>
          <CornerDownLeft size={12} strokeWidth={2} />
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
    background: var(--surface-panel);
    user-select: none;
    overscroll-behavior: contain;
  }
  .sections-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    overscroll-behavior: contain;
    overscroll-behavior-y: contain;
  }
  .change-group {
    border-bottom: 1px solid color-mix(in srgb, var(--border-subtle) 60%, transparent);
  }
  .group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: color-mix(in srgb, var(--surface-app) 40%, transparent);
  }
  .header-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--text-primary);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: -0.1px;
  }
  .chevron-icon {
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
  }
  .group-title {
    color: var(--text-primary);
  }
  .count-pill {
    font-size: 10px;
    font-family: var(--font-code);
    padding: 0 5px;
    border-radius: 999px;
    background: var(--surface-app);
    color: var(--text-secondary);
    border: 1px solid var(--border-subtle);
  }
  .count-pill.active {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 30%, transparent);
    font-weight: 500;
  }
  .group-action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .group-action-btn:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text-primary);
    border-color: var(--border-subtle);
  }
  .group-empty {
    padding: 10px 14px 12px 24px;
    font-size: 11px;
    color: var(--text-secondary);
    opacity: 0.6;
    font-style: italic;
  }
  .files-list {
    display: flex;
    flex-direction: column;
  }
  .file-row {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 8px 5px 14px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background var(--transition-fast);
  }
  .file-row:hover {
    background: var(--surface-hover);
  }
  .file-row:hover .status-badge {
    display: none;
  }
  .status-badge {
    font-family: var(--font-code);
    font-size: 9.5px;
    font-weight: 700;
    width: 15px;
    height: 15px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    flex-shrink: 0;
    margin-left: auto;
  }
  .status-m {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.15);
  }
  .status-a {
    color: #10b981;
    background: rgba(16, 185, 129, 0.15);
  }
  .status-d {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
  }
  .status-u {
    color: #0ea5e9;
    background: rgba(14, 165, 233, 0.15);
  }
  .file-icon {
    display: inline-flex;
    align-items: center;
    color: var(--text-secondary);
    flex-shrink: 0;
  }
  .file-path-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: flex;
    align-items: baseline;
    gap: 4px;
  }
  .file-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
  }
  .dir-prefix {
    font-size: 10.5px;
    color: var(--text-secondary);
    opacity: 0.7;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .row-action-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    border: 1px solid var(--border-subtle);
    background: var(--surface-panel);
    color: var(--text-secondary);
    cursor: pointer;
  }
  .file-row:hover .row-action-btn {
    display: inline-flex;
  }
  .row-action-btn:hover {
    color: var(--text-primary);
    background: var(--surface-app);
  }

  /* 底部提交框 */
  .commit-dock {
    padding: 10px 12px;
    border-top: 1px solid var(--border-subtle);
    background: var(--surface-panel);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .commit-textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-size: 12px;
    font-family: inherit;
    line-height: 1.4;
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: var(--surface-app);
    color: var(--text-primary);
    outline: none;
    resize: none;
    transition: border-color var(--transition-fast);
  }
  .commit-textarea:focus {
    border-color: var(--focus-ring);
  }
  .commit-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .commit-hint {
    font-size: 10.5px;
    color: var(--text-secondary);
  }
  .commit-submit-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 500;
    border-radius: var(--radius-control);
    border: 1px solid color-mix(in srgb, var(--accent) 70%, white);
    background: var(--accent);
    color: var(--text-on-accent);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .commit-submit-btn:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .commit-submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .panel-error {
    padding: 8px 12px;
    font-size: 11.5px;
    color: var(--danger);
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    border-bottom: 1px solid var(--border-subtle);
  }
  .empty-note {
    padding: 24px 16px;
    font-size: 12.5px;
    color: var(--text-secondary);
    text-align: center;
  }
</style>
