<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import PanelLeft from 'lucide-svelte/icons/panel-left';
  import GitBranch from 'lucide-svelte/icons/git-branch';

  import FileTree from '$lib/components/FileTree.svelte';
  import EditorPane from '$lib/components/EditorPane.svelte';
  import GitPanel from '$lib/components/GitPanel.svelte';
  import WelcomeView from '$lib/components/WelcomeView.svelte';
  import TabBar from '$lib/components/TabBar.svelte';
  import QuickOpen from '$lib/components/QuickOpen.svelte';
  import SettingsPanel from '$lib/components/SettingsPanel.svelte';
  import {
    openWorkspace,
    workspace,
    openFile,
    activeTab,
    closeTabChecked,
    restoreSession,
    ui,
  } from '$lib/state.svelte';
  import { applyAppearance } from '$lib/settings.svelte';
  import {
    layoutGridTemplate,
    layoutPrefs,
    resolvedLayout,
    setContainerWidth,
    setExplorerWidth,
    setGitWidth,
    toggleExplorer,
    toggleGit,
  } from '$lib/layout.svelte';
  import { EXPLORER_MAX, EXPLORER_MIN, GIT_MAX, GIT_MIN } from '$lib/utils/layout-prefs';

  let loadError = $state<string | null>(null);
  let quickOpenOpen = $state(false);
  let appEl = $state<HTMLDivElement | null>(null);
  let resizeTarget = $state<'explorer' | 'git' | null>(null);
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  let workspacePath = $derived(page.url.searchParams.get('path'));
  let panes = $derived(resolvedLayout());
  let gridColumns = $derived(layoutGridTemplate());

  onMount(() => {
    applyAppearance();

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault();
        quickOpenOpen = !quickOpenOpen;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (ui.settingsOpen) {
          ui.settingsOpen = false;
          return;
        }
        const tab = activeTab();
        if (tab) closeTabChecked(tab.id);
      }
      if (e.key === 'Escape' && ui.settingsOpen) {
        e.preventDefault();
        ui.settingsOpen = false;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        ui.settingsOpen = !ui.settingsOpen;
      }
      // Cmd+B toggle Explorer
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b' && !e.shiftKey) {
        e.preventDefault();
        toggleExplorer();
      }
      // Cmd+Shift+G toggle Git panel
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        toggleGit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  $effect(() => {
    if (workspacePath) {
      void openWorkspace(workspacePath)
        .then(() => restoreSession())
        .catch((e) => {
          loadError = typeof e === 'string' ? e : JSON.stringify(e);
        });
    }
  });

  $effect(() => {
    if (!appEl) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === 'number') setContainerWidth(w);
    });
    ro.observe(appEl);
    setContainerWidth(appEl.clientWidth);
    return () => ro.disconnect();
  });

  function startResize(side: 'explorer' | 'git', e: PointerEvent) {
    resizeTarget = side;
    resizeStartX = e.clientX;
    resizeStartWidth = side === 'explorer' ? layoutPrefs.explorerWidth : layoutPrefs.gitWidth;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onResizeMove(e: PointerEvent) {
    if (!resizeTarget) return;
    if (resizeTarget === 'explorer') {
      setExplorerWidth(resizeStartWidth + (e.clientX - resizeStartX));
    } else {
      setGitWidth(resizeStartWidth - (e.clientX - resizeStartX));
    }
  }

  function endResize() {
    resizeTarget = null;
  }

  function onSeparatorKey(side: 'explorer' | 'git', e: KeyboardEvent) {
    const step = e.shiftKey ? 20 : 10;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (side === 'explorer') setExplorerWidth(layoutPrefs.explorerWidth - step);
      else setGitWidth(layoutPrefs.gitWidth + step);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (side === 'explorer') setExplorerWidth(layoutPrefs.explorerWidth + step);
      else setGitWidth(layoutPrefs.gitWidth - step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (side === 'explorer') setExplorerWidth(EXPLORER_MIN);
      else setGitWidth(GIT_MIN);
    } else if (e.key === 'End') {
      e.preventDefault();
      if (side === 'explorer') setExplorerWidth(EXPLORER_MAX);
      else setGitWidth(GIT_MAX);
    }
  }
</script>

{#if workspacePath}
  <div class="app" bind:this={appEl} style="grid-template-columns: {gridColumns};">
    {#if panes.explorerVisible}
      <aside class="sidebar nav-surface">
        {#if loadError}
          <div class="load-error">{loadError}</div>
        {:else}
          <FileTree root={workspace.root} onFileClick={(p) => openFile(p)} />
        {/if}
      </aside>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        class="splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整资源管理器宽度"
        aria-valuenow={layoutPrefs.explorerWidth}
        aria-valuemin={EXPLORER_MIN}
        aria-valuemax={EXPLORER_MAX}
        tabindex="0"
        onpointerdown={(e) => startResize('explorer', e)}
        onpointermove={onResizeMove}
        onpointerup={endResize}
        onpointercancel={endResize}
        onkeydown={(e) => onSeparatorKey('explorer', e)}
      ></div>
    {/if}

    <main class="editor">
      <div class="editor-chrome nav-surface">
        <button
          class="icon-btn pane-toggle"
          class:active={panes.explorerVisible}
          aria-pressed={panes.explorerVisible}
          aria-label={panes.explorerVisible ? '隐藏资源管理器' : '显示资源管理器'}
          title="资源管理器 (⌘B)"
          onclick={() => toggleExplorer()}
        >
          <PanelLeft size={15} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          class="icon-btn pane-toggle"
          class:active={panes.gitVisible}
          aria-pressed={panes.gitVisible}
          aria-label={panes.gitVisible ? '隐藏 Git 面板' : '显示 Git 面板'}
          title="Git 面板 (⌘⇧G)"
          onclick={() => toggleGit()}
        >
          <GitBranch size={15} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <div class="tabbar-slot">
          <TabBar />
        </div>
      </div>
      <div class="editor-body">
        {#if ui.settingsOpen}
          <SettingsPanel onClose={() => (ui.settingsOpen = false)} />
        {:else}
          <EditorPane />
        {/if}
      </div>
    </main>

    {#if panes.gitVisible}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        class="splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整 Git 面板宽度"
        aria-valuenow={layoutPrefs.gitWidth}
        aria-valuemin={GIT_MIN}
        aria-valuemax={GIT_MAX}
        tabindex="0"
        onpointerdown={(e) => startResize('git', e)}
        onpointermove={onResizeMove}
        onpointerup={endResize}
        onpointercancel={endResize}
        onkeydown={(e) => onSeparatorKey('git', e)}
      ></div>
      <aside class="git nav-surface"><GitPanel /></aside>
    {/if}
  </div>
  <QuickOpen open={quickOpenOpen} onClose={() => (quickOpenOpen = false)} />
{:else}
  <WelcomeView />
{/if}

<style>
  .app {
    display: grid;
    height: 100vh;
    overflow: hidden;
    background: var(--surface-app);
    color: var(--text-primary);
  }
  .sidebar {
    border-right: none;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: var(--surface-panel);
  }
  .splitter {
    width: 4px;
    margin: 0 -2px;
    cursor: col-resize;
    background: transparent;
    position: relative;
    z-index: 2;
  }
  .splitter::after {
    content: '';
    position: absolute;
    inset: 0 -2px;
    background: transparent;
  }
  .splitter:hover::after,
  .splitter:focus-visible::after {
    background: var(--focus-ring);
    opacity: 0.55;
  }
  .editor {
    min-width: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .editor-chrome {
    display: flex;
    align-items: stretch;
    gap: 2px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-app);
    padding: 0 4px;
    height: 38px;
    box-sizing: border-box;
    flex-shrink: 0;
  }
  .pane-toggle {
    align-self: center;
    width: 26px;
    height: 26px;
    color: var(--text-secondary);
    border: none;
    background: transparent;
  }
  .pane-toggle:hover {
    color: var(--text-primary);
    background: var(--surface-hover);
  }
  .pane-toggle.active {
    color: var(--text-primary);
    background: transparent;
  }
  .tabbar-slot {
    flex: 1;
    min-width: 0;
  }
  .editor-body {
    flex: 1;
    min-height: 0;
    background: var(--bg-alpha);
  }
  .git {
    min-width: 0;
    background: var(--surface-panel);
  }
  .load-error {
    padding: 12px;
    color: var(--danger);
    font-size: var(--font-size-meta);
    word-break: break-all;
  }
</style>
