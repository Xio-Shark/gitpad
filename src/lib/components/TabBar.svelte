<script lang="ts">
  import { activeTab, closeTabChecked, tabs, toggleMarkdownPreview } from '$lib/state.svelte';
  import type { RendererKind } from '$lib/utils/filetype';
  import { isMarkdown } from '$lib/utils/filetype';

  const KIND_ICON: Record<RendererKind, string> = {
    text: '📄',
    image: '🖼️',
    csv: '📊',
    pdf: '📕',
    gitdiff: '🔀',
    unknown: '❔',
  };

  const current = $derived(activeTab());
  const showPreviewToggle = $derived(
    current?.kind === 'text' && current.path !== '' && isMarkdown(current.path) && !current.commitOid
  );
</script>

<div class="tabbar" role="tablist">
  {#each tabs.list as tab (tab.id)}
    <div
      class="tab"
      class:active={tab.id === tabs.activeId}
      role="tab"
      aria-selected={tab.id === tabs.activeId}
      tabindex="0"
      title={tab.path}
      onclick={() => (tabs.activeId = tab.id)}
      onauxclick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          closeTabChecked(tab.id);
        }
      }}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          tabs.activeId = tab.id;
        }
      }}
    >
      <span class="tab-icon">{KIND_ICON[tab.kind]}</span>
      <span class="tab-name">{tab.name}</span>
      {#if tab.dirty}
        <span class="dirty-dot" title="未保存"></span>
      {/if}
      <button
        class="tab-close"
        title="关闭"
        onclick={(e) => {
          e.stopPropagation();
          closeTabChecked(tab.id);
        }}
      >×</button>
    </div>
  {/each}
  {#if tabs.list.length === 0}
    <div class="tabbar-empty">无打开的标签页</div>
  {/if}
  {#if showPreviewToggle && current}
    <button
      class="preview-toggle"
      class:active={current.preview ?? false}
      title={current.preview ? '退出预览' : '预览'}
      onclick={() => toggleMarkdownPreview(current)}
    >👁</button>
  {/if}
</div>

<style>
  .tabbar {
    display: flex;
    align-items: flex-end;
    height: 32px;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    flex-shrink: 0;
    scrollbar-width: thin;
  }
  .tab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 8px;
    height: 30px;
    min-width: 0;
    max-width: 200px;
    border-right: 1px solid var(--border);
    cursor: pointer;
    font-size: 14px;
    color: var(--text-secondary);
    user-select: none;
    flex-shrink: 0;
  }
  .tab:hover {
    background: var(--hover);
  }
  .tab.active {
    background: var(--bg-secondary);
    color: var(--text);
  }
  .tab-icon {
    font-size: 11px;
  }
  .tab-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dirty-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
  }
  .tab-close {
    border: none;
    background: none;
    color: inherit;
    font-size: 14px;
    line-height: 1;
    padding: 0 2px;
    cursor: pointer;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .tab-close:hover {
    background: var(--border);
  }
  .tabbar-empty {
    padding: 8px 10px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .preview-toggle {
    margin-left: auto;
    margin-right: 6px;
    align-self: center;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 12px;
    padding: 1px 8px;
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .preview-toggle:hover {
    color: var(--text);
  }
  .preview-toggle.active {
    background: var(--accent);
    color: var(--text-on-accent);
    border-color: var(--accent);
  }
</style>
