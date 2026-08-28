<script lang="ts">
  import { tick } from 'svelte';
  import { toast } from 'svelte-sonner';
  import X from 'lucide-svelte/icons/x';
  import Eye from 'lucide-svelte/icons/eye';
  import Settings from 'lucide-svelte/icons/settings';
  import GitCompare from 'lucide-svelte/icons/git-compare';
  import {
    activateTab,
    activeTab,
    closeTabChecked,
    tabs,
    toggleMarkdownPreview,
    ui,
    type Tab,
  } from '$lib/state.svelte';
  import { isMarkdown } from '$lib/utils/filetype';
  import { getFileIcon } from '$lib/utils/file-icons';
  import { clipboardCopy } from '$lib/api';

  let tabbarScrollEl = $state<HTMLDivElement | null>(null);

  const current = $derived(activeTab());
  const showPreviewToggle = $derived(
    !ui.settingsOpen &&
      current?.kind === 'text' &&
      current.path !== '' &&
      isMarkdown(current.path) &&
      !current.commitOid
  );

  type TabMenuState = { x: number; y: number; tab: Tab; index: number } | null;
  let tabMenu = $state<TabMenuState>(null);

  // 激活标签自动居中 / 滚入视口
  $effect(() => {
    const targetId = ui.settingsOpen ? 'settings' : tabs.activeId;
    if (!targetId || !tabbarScrollEl) return;
    tick().then(() => {
      const el = document.getElementById(`tab-${targetId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
  });

  function onWheel(e: WheelEvent) {
    if (!tabbarScrollEl) return;
    if (e.deltaY !== 0 && e.deltaX === 0) {
      tabbarScrollEl.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }

  function focusTabAt(index: number) {
    const tab = tabs.list[index];
    if (!tab) return;
    activateTab(tab.id);
    queueMicrotask(() => {
      document.getElementById(`tab-btn-${tab.id}`)?.focus();
    });
  }

  function onTabKeydown(e: KeyboardEvent, index: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusTabAt(Math.min(tabs.list.length - 1, index + 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusTabAt(Math.max(0, index - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusTabAt(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusTabAt(tabs.list.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateTab(tabs.list[index]!.id);
    } else if (e.key === 'Delete' || (e.key === 'w' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      closeTabChecked(tabs.list[index]!.id);
    }
  }

  function showContextMenu(e: MouseEvent, tab: Tab, index: number) {
    e.preventDefault();
    tabMenu = {
      x: Math.min(e.clientX, window.innerWidth - 170),
      y: e.clientY + 8,
      tab,
      index,
    };
  }

  function hideContextMenu() {
    tabMenu = null;
  }

  function closeOtherTabs(targetId: string) {
    hideContextMenu();
    const otherTabs = tabs.list.filter((t) => t.id !== targetId);
    for (const t of otherTabs) {
      closeTabChecked(t.id);
    }
  }

  function closeTabsToRight(index: number) {
    hideContextMenu();
    const rightTabs = tabs.list.slice(index + 1);
    for (const t of rightTabs) {
      closeTabChecked(t.id);
    }
  }

  async function copyTabPath(path: string) {
    hideContextMenu();
    try {
      await clipboardCopy(path);
      toast.success('已复制路径到剪贴板');
    } catch {
      toast.error('复制失败');
    }
  }
</script>

<div class="tabbar-container nav-surface">
  <div
    class="tabbar-scroll"
    role="tablist"
    aria-label="打开的文件"
    bind:this={tabbarScrollEl}
    onwheel={onWheel}
  >
    {#each tabs.list as tab, index (tab.id)}
      {@const active = !ui.settingsOpen && tab.id === tabs.activeId}
      {@const Icon = tab.kind === 'gitdiff' ? GitCompare : getFileIcon(tab.name, false)}
      <div
        id="tab-{tab.id}"
        class="tab"
        class:active
        role="presentation"
        oncontextmenu={(e) => showContextMenu(e, tab, index)}
      >
        <button
          id="tab-btn-{tab.id}"
          class="tab-activate"
          role="tab"
          aria-selected={active}
          tabindex={active ? 0 : -1}
          title={tab.path}
          onclick={() => activateTab(tab.id)}
          onauxclick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              closeTabChecked(tab.id);
            }
          }}
          onkeydown={(e) => onTabKeydown(e, index)}
        >
          <span class="tab-icon">
            <Icon size={13} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <span class="tab-name">{tab.name}</span>
          {#if tab.dirty}
            <span class="dirty-dot" title="未保存" aria-label="未保存"></span>
          {/if}
        </button>
        <button
          class="tab-close icon-btn"
          aria-label={`关闭 ${tab.name}`}
          title="关闭 (⌘W)"
          tabindex={active ? 0 : -1}
          onclick={() => closeTabChecked(tab.id)}
        >
          <X size={12} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    {/each}

    {#if ui.settingsOpen}
      <div id="tab-settings" class="tab active" role="presentation">
        <button
          id="tab-btn-settings"
          class="tab-activate"
          role="tab"
          aria-selected={true}
          tabindex={0}
          title="设置"
          onclick={() => (ui.settingsOpen = true)}
        >
          <span class="tab-icon">
            <Settings size={13} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <span class="tab-name">设置</span>
        </button>
        <button
          class="tab-close icon-btn"
          aria-label="关闭设置"
          title="关闭设置 (⌘W / Esc)"
          tabindex={0}
          onclick={() => (ui.settingsOpen = false)}
        >
          <X size={12} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    {/if}

    {#if tabs.list.length === 0 && !ui.settingsOpen}
      <div class="tabbar-empty">无打开的标签页</div>
    {/if}
  </div>

  {#if showPreviewToggle && current}
    <div class="tabbar-actions">
      <button
        class="preview-toggle icon-btn"
        class:active={current.preview ?? false}
        aria-label={current.preview ? '退出 Markdown 预览' : 'Markdown 预览'}
        title={current.preview ? '退出预览' : '预览'}
        onclick={() => toggleMarkdownPreview(current)}
      >
        <Eye size={13} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  {/if}
</div>

{#if tabMenu}
  <div
    class="ctx-mask"
    role="presentation"
    onclick={() => hideContextMenu()}
    oncontextmenu={(e) => {
      e.preventDefault();
      hideContextMenu();
    }}
  ></div>
  <div
    class="ctx-menu menu-content"
    style="left: {tabMenu.x}px; top: {tabMenu.y}px;"
    role="menu"
    tabindex="-1"
    aria-label="标签页操作"
  >
    <button
      class="menu-item"
      role="menuitem"
      onclick={() => {
        const id = tabMenu!.tab.id;
        hideContextMenu();
        closeTabChecked(id);
      }}
    >
      <span>关闭标签页</span>
      <span class="menu-shortcut">⌘W</span>
    </button>
    <button
      class="menu-item"
      role="menuitem"
      disabled={tabs.list.length <= 1}
      onclick={() => closeOtherTabs(tabMenu!.tab.id)}
    >
      <span>关闭其他标签页</span>
    </button>
    <button
      class="menu-item"
      role="menuitem"
      disabled={tabMenu.index >= tabs.list.length - 1}
      onclick={() => closeTabsToRight(tabMenu!.index)}
    >
      <span>关闭右侧标签页</span>
    </button>
    <div class="menu-separator" role="separator"></div>
    <button
      class="menu-item"
      role="menuitem"
      onclick={() => copyTabPath(tabMenu!.tab.path)}
    >
      <span>复制绝对路径</span>
      <span class="menu-shortcut">⌥⌘C</span>
    </button>
  </div>
{/if}

<style>
  .tabbar-container {
    display: flex;
    align-items: stretch;
    height: 38px;
    width: 100%;
    min-width: 0;
  }
  .tabbar-scroll {
    display: flex;
    align-items: stretch;
    height: 100%;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tabbar-scroll::-webkit-scrollbar {
    display: none;
  }
  .tabbar-actions {
    display: flex;
    align-items: center;
    padding: 0 4px;
    flex-shrink: 0;
  }
  .tab {
    display: flex;
    align-items: center;
    height: 38px;
    min-width: 0;
    max-width: 220px;
    border-right: 1px solid var(--border-subtle);
    flex-shrink: 0;
    position: relative;
    transition: background var(--transition-fast), color var(--transition-fast);
    background: transparent;
  }
  .tab:hover {
    background: var(--surface-hover);
  }
  .tab.active {
    background: var(--surface-elevated);
    box-shadow: 0 1px 0 var(--surface-elevated);
    margin-bottom: -1px;
    z-index: 1;
  }
  .tab.active::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--accent);
  }
  .tab-activate {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 4px 0 10px;
    height: 100%;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: var(--font-size-ui);
    letter-spacing: -0.01em;
  }
  .tab.active .tab-activate {
    color: var(--text-primary);
    font-weight: 500;
  }
  .tab-icon {
    display: inline-flex;
    flex-shrink: 0;
    color: var(--text-secondary);
  }
  .tab.active .tab-icon {
    color: var(--text-primary);
  }
  .tab-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dirty-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
    margin-left: 3px;
  }
  .tab-close {
    width: 18px;
    height: 18px;
    min-width: 18px;
    min-height: 18px;
    border: none;
    background: transparent;
    margin-right: 6px;
    margin-left: 2px;
    border-radius: 4px;
    color: var(--text-secondary);
    opacity: 0;
    transition: all var(--transition-fast);
  }
  .tab:hover .tab-close,
  .tab.active .tab-close {
    opacity: 0.65;
  }
  .tab-close:hover {
    opacity: 1;
    background: var(--surface-hover);
    color: var(--text-primary);
  }
  .tabbar-empty {
    padding: 8px 12px;
    font-size: var(--font-size-meta);
    color: var(--text-secondary);
    align-self: center;
  }
  .preview-toggle {
    align-self: center;
  }
  .preview-toggle.active {
    background: var(--accent);
    color: var(--text-on-accent);
    border-color: var(--accent);
  }
  .ctx-mask {
    position: fixed;
    inset: 0;
    z-index: 90;
  }
  .ctx-menu {
    position: fixed;
    z-index: 91;
  }
</style>
