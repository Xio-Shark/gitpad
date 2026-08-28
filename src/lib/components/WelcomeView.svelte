<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { toast } from 'svelte-sonner';
  import FolderOpen from 'lucide-svelte/icons/folder-open';
  import GitFork from 'lucide-svelte/icons/git-fork';
  import X from 'lucide-svelte/icons/x';
  import { getRecentWorkspaces, removeRecentWorkspace } from '$lib/state.svelte';

  let dragging = $state(false);
  let recentWorkspaces = $state<string[]>([]);
  let showAllWorkspaces = $state(false);
  let cloneModalOpen = $state(false);
  let cloneUrl = $state('');
  let cloning = $state(false);
  let unlisten: (() => void) | null = null;

  function refreshRecents() {
    const list = getRecentWorkspaces();
    if (list.length === 0) {
      // 预置当前已知工作区便于立刻展示与体验
      recentWorkspaces = ['/Users/tengyanxi/code/gitpad', '/Users/tengyanxi/code/bff/bm_bff_web'];
    } else {
      recentWorkspaces = list;
    }
  }

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      void pickFolder();
    }
    if (e.key === 'Escape' && cloneModalOpen) {
      cloneModalOpen = false;
    }
  }

  onMount(async () => {
    refreshRecents();
    window.addEventListener('keydown', onKey);

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
    window.removeEventListener('keydown', onKey);
    unlisten?.();
  });

  function openPath(path: string) {
    if (!path) return;
    window.location.href = `/?path=${encodeURIComponent(path)}`;
  }

  async function pickFolder() {
    try {
      const selected = await invoke<string | null>('pick_folder');
      if (selected) {
        openPath(selected);
      }
    } catch (e) {
      toast.error(typeof e === 'string' ? e : '选择文件夹失败');
    }
  }

  function handleRemoveRecent(e: MouseEvent, path: string) {
    e.stopPropagation();
    removeRecentWorkspace(path);
    recentWorkspaces = recentWorkspaces.filter((p) => p !== path);
  }

  function parsePathInfo(fullPath: string): { name: string; displayPath: string } {
    const normalized = fullPath.replace(/\/+$/, '');
    const name = normalized.split('/').pop() || normalized;
    let displayPath = normalized;
    const homeMatch = normalized.match(/^\/Users\/[^/]+/);
    if (homeMatch) {
      displayPath = '~' + normalized.slice(homeMatch[0].length);
    }
    return { name, displayPath };
  }

  const displayedWorkspaces = $derived(
    showAllWorkspaces ? recentWorkspaces : recentWorkspaces.slice(0, 3)
  );

  async function startClone() {
    if (!cloneUrl.trim()) return;
    toast.info('请选择保存克隆仓库的本地目录…');
    try {
      await invoke('pick_folder');
      cloneModalOpen = false;
      cloneUrl = '';
    } catch (e) {
      toast.error(typeof e === 'string' ? e : '克隆流程异常');
    }
  }
</script>

<div class="welcome-studio">
  <div class="studio-center" transition:fade={{ duration: 120 }}>
    <!-- 品牌 Logo 与标题（去广告语纯粹视觉） -->
    <div class="brand-section">
      <div class="logo-mark">
        <svg class="logo-svg" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="36" height="36" rx="10" fill="currentColor" fill-opacity="0.1"/>
          <path d="M11 10L17 16L11 22" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M18 24H25" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
        </svg>
      </div>
      <h1 class="brand-name">GitPad</h1>
    </div>

    <!-- 顶部主操作按钮（双排对齐参考图） -->
    <div class="action-buttons">
      <button class="studio-btn primary" onclick={pickFolder}>
        <FolderOpen size={16} strokeWidth={1.5} />
        <span>打开文件夹…</span>
        <kbd class="kbd-badge">⌘O</kbd>
      </button>

      <button class="studio-btn secondary" onclick={() => (cloneModalOpen = !cloneModalOpen)}>
        <GitFork size={15} strokeWidth={1.5} />
        <span>克隆仓库…</span>
      </button>
    </div>

    <!-- 克隆仓库快速输入卡片 -->
    {#if cloneModalOpen}
      <div class="clone-card" transition:fade={{ duration: 100 }}>
        <input
          class="clone-input"
          placeholder="输入 Git 仓库 URL (如 https://github.com/...)"
          bind:value={cloneUrl}
          onkeydown={(e) => e.key === 'Enter' && void startClone()}
        />
        <div class="clone-footer">
          <button class="btn-cancel" onclick={() => (cloneModalOpen = false)}>取消</button>
          <button class="btn-confirm" disabled={!cloneUrl.trim() || cloning} onclick={() => void startClone()}>
            {cloning ? '克隆中…' : '选择目录并克隆'}
          </button>
        </div>
      </div>
    {/if}

    <!-- 工作区卡片列表（完全对齐参考图） -->
    <div class="workspaces-section">
      <div class="section-title">工作区</div>

      <div class="workspaces-list">
        {#if displayedWorkspaces.length === 0}
          <div class="workspaces-empty">暂无最近打开的工作区</div>
        {:else}
          {#each displayedWorkspaces as ws (ws)}
            {@const info = parsePathInfo(ws)}
            <div
              class="workspace-item"
              role="button"
              tabindex="0"
              onclick={() => void openPath(ws)}
              onkeydown={(e) => e.key === 'Enter' && void openPath(ws)}
            >
              <div class="item-main">
                <span class="item-name">{info.name}</span>
                <span class="item-path">{info.displayPath}</span>
              </div>
              <button
                class="item-remove-btn"
                title="从最近列表中移除"
                onclick={(e) => handleRemoveRecent(e, ws)}
              >
                <X size={13} strokeWidth={1.5} />
              </button>
            </div>
          {/each}
        {/if}
      </div>

      {#if recentWorkspaces.length > 3}
        <button class="toggle-more-btn" onclick={() => (showAllWorkspaces = !showAllWorkspaces)}>
          {showAllWorkspaces ? '收起工作区' : '显示更多…'}
        </button>
      {/if}
    </div>
  </div>

  <!-- 全窗口拖入时浮现的毛玻璃遮罩 -->
  {#if dragging}
    <div class="drag-fullscreen-overlay" transition:fade={{ duration: 100 }}>
      <div class="drag-fullscreen-box">
        <FolderOpen size={48} strokeWidth={1.5} class="drag-icon" />
        <div class="drag-text-title">松开以在此打开工作区</div>
      </div>
    </div>
  {/if}
</div>

<style>
  .welcome-studio {
    height: 100vh;
    width: 100vw;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-app);
    color: var(--text-primary);
    position: relative;
    overflow-y: auto;
    overflow-x: hidden;
    user-select: none;
    overscroll-behavior: none;
  }

  .studio-center {
    width: 100%;
    max-width: 440px;
    padding: 32px 24px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    box-sizing: border-box;
  }

  /* 顶部品牌区（无广告语） */
  .brand-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 26px;
  }
  .logo-mark {
    width: 44px;
    height: 44px;
    color: var(--accent);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .logo-svg {
    width: 44px;
    height: 44px;
  }
  .brand-name {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.3px;
    color: var(--text-primary);
  }

  /* 顶部操作按钮 */
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 32px;
  }

  .studio-btn {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    padding: 0 16px;
    box-sizing: border-box;
  }
  .studio-btn:active {
    transform: scale(0.98);
  }

  .studio-btn.primary {
    background: var(--accent);
    color: var(--text-on-accent);
    border: 1px solid color-mix(in srgb, var(--accent) 80%, white);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 2px 8px rgba(59, 130, 246, 0.25);
  }
  .studio-btn.primary:hover {
    filter: brightness(1.06);
    transform: translateY(-0.5px);
  }

  .studio-btn.secondary {
    background: var(--surface-panel);
    color: var(--text-primary);
    border: 1px solid var(--border-subtle);
  }
  .studio-btn.secondary:hover {
    background: var(--surface-hover);
    border-color: var(--border-strong);
    transform: translateY(-0.5px);
  }

  .kbd-badge {
    margin-left: auto;
    font-family: var(--font-code);
    font-size: 10.5px;
    font-weight: 500;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.18);
    color: var(--text-on-accent);
    border: 1px solid rgba(255, 255, 255, 0.25);
  }

  /* 克隆弹出输入卡片 */
  .clone-card {
    padding: 12px;
    background: var(--surface-panel);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    margin-bottom: 24px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .clone-input {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-size: 12.5px;
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: var(--surface-app);
    color: var(--text-primary);
    outline: none;
  }
  .clone-input:focus {
    border-color: var(--focus-ring);
  }
  .clone-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .btn-cancel {
    padding: 4px 10px;
    font-size: 12px;
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
  }
  .btn-cancel:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }
  .btn-confirm {
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 500;
    border-radius: var(--radius-control);
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--text-on-accent);
    cursor: pointer;
  }

  /* 工作区列表区 */
  .workspaces-section {
    display: flex;
    flex-direction: column;
  }
  .section-title {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 12px;
    letter-spacing: -0.1px;
  }
  .workspaces-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .workspaces-empty {
    padding: 16px;
    text-align: center;
    font-size: 12px;
    color: var(--text-secondary);
    background: var(--surface-panel);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
  }

  /* 工作区条目卡片（完全对齐参考图） */
  .workspace-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: var(--surface-panel);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .workspace-item:hover {
    background: var(--surface-hover);
    border-color: var(--border-strong);
    transform: translateY(-0.5px);
  }
  .item-main {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    overflow: hidden;
  }
  .item-name {
    font-size: 13.5px;
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: -0.1px;
  }
  .item-path {
    font-size: 11.5px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-code);
  }

  .item-remove-btn {
    opacity: 0;
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
    flex-shrink: 0;
    margin-left: 8px;
  }
  .workspace-item:hover .item-remove-btn {
    opacity: 1;
  }
  .item-remove-btn:hover {
    background: var(--surface-app);
    color: var(--danger);
    border-color: var(--border-subtle);
  }

  .toggle-more-btn {
    margin-top: 14px;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    text-align: center;
    transition: color var(--transition-fast);
    padding: 6px 0;
  }
  .toggle-more-btn:hover {
    color: var(--text-primary);
  }

  /* 拖入全屏遮罩 */
  .drag-fullscreen-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--surface-app) 82%, transparent);
    backdrop-filter: blur(16px);
    border: 2px dashed var(--accent);
    pointer-events: none;
  }
  .drag-fullscreen-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  :global(.drag-icon) {
    color: var(--accent);
  }
  .drag-text-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }
</style>
