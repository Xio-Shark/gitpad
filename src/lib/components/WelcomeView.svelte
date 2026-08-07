<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount, onDestroy } from 'svelte';

  let dragging = $state(false);
  let error = $state<string | null>(null);

  let unlisten: (() => void) | null = null;

  onMount(async () => {
    unlisten = await getCurrentWindow().onDragDropEvent((e) => {
      if (e.payload.type === 'over') {
        dragging = true;
      } else if (e.payload.type === 'leave') {
        dragging = false;
      } else if (e.payload.type === 'drop') {
        dragging = false;
        const paths = e.payload.paths;
        if (paths.length === 0) return;
        void openPath(paths[0]);
      }
    });
  });

  onDestroy(() => {
    unlisten?.();
  });

  async function openPath(path: string) {
    error = null;
    try {
      await invoke('open_workspace', { path });
    } catch (e) {
      error = typeof e === 'string' ? e : JSON.stringify(e);
    }
  }

  async function pickFolder() {
    error = null;
    try {
      await invoke('pick_folder');
    } catch (e) {
      error = typeof e === 'string' ? e : JSON.stringify(e);
    }
  }
</script>

<div class="welcome" class:dragging>
  <div class="card">
    <h1>GitPad</h1>
    <p class="sub">轻量编辑器 + Git 客户端</p>
    <div class="drop-zone">
      <div class="drop-icon">{dragging ? '📂' : '📁'}</div>
      <p class="drop-text">拖入文件夹打开 Workspace</p>
    </div>
    <button class="pick-btn" onclick={pickFolder}>选择文件夹…</button>
    {#if error}
      <p class="error">{error}</p>
    {/if}
  </div>
</div>

<style>
  .welcome {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
  }
  .welcome.dragging .card {
    border-color: var(--accent);
  }
  .card {
    width: 420px;
    padding: 40px;
    border: 2px dashed var(--border);
    border-radius: 12px;
    text-align: center;
    background: var(--bg-secondary);
  }
  h1 {
    margin: 0 0 4px;
    font-size: 28px;
  }
  .sub {
    margin: 0 0 24px;
    color: var(--text-secondary);
    font-size: 14px;
  }
  .drop-zone {
    padding: 32px 0;
    border-radius: 8px;
  }
  .drop-icon {
    font-size: 40px;
  }
  .drop-text {
    color: var(--text-secondary);
    font-size: 14px;
  }
  .pick-btn {
    margin-top: 8px;
    padding: 8px 20px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--accent);
    color: var(--text-on-accent);
    font-size: 14px;
    cursor: pointer;
  }
  .error {
    margin-top: 16px;
    color: var(--danger);
    font-size: 12px;
    word-break: break-all;
  }
</style>
