<script lang="ts">
  import Search from 'lucide-svelte/icons/search';
  import { ensureQuickOpen, openFile, quickOpen } from '$lib/state.svelte';
  import { isAppError, type WalkFile } from '$lib/api';
  import { getFileIcon } from '$lib/utils/file-icons';

  let props = $props<{ open: boolean; onClose: () => void }>();

  let query = $state('');
  let cursor = $state(0);
  let error = $state<string | null>(null);
  let inputEl = $state<HTMLInputElement | null>(null);
  let panelEl = $state<HTMLDivElement | null>(null);
  let previouslyFocused: Element | null = null;

  $effect(() => {
    if (props.open) {
      previouslyFocused = document.activeElement;
      query = '';
      cursor = 0;
      error = null;
      ensureQuickOpen().catch((e) => {
        error = isAppError(e) ? e.message : String(e);
      });
      queueMicrotask(() => inputEl?.focus());
    } else if (previouslyFocused instanceof HTMLElement) {
      previouslyFocused.focus();
      previouslyFocused = null;
    }
  });

  const results = $derived.by(() => {
    const files = quickOpen.files ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return files.slice(0, 50);
    const scored: { f: WalkFile; score: number }[] = [];
    for (const f of files) {
      const name = f.name.toLowerCase();
      const path = f.path.toLowerCase();
      if (name.includes(q) || path.includes(q)) {
        let score = 0;
        if (name.startsWith(q)) score = 0;
        else if (name.includes(q)) score = 1;
        else if (path.includes(q)) score = 2;
        scored.push({ f, score });
      }
    }
    scored.sort((a, b) => a.score - b.score || a.f.name.localeCompare(b.f.name));
    return scored.slice(0, 50).map((s) => s.f);
  });

  const activeId = $derived(results[cursor] ? `qo-opt-${cursor}` : undefined);

  function pick(f: WalkFile) {
    openFile(f.path);
    props.onClose();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      props.onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      cursor = Math.min(cursor + 1, Math.max(0, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cursor = Math.max(cursor - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const f = results[cursor];
      if (f) pick(f);
    } else if (e.key === 'Tab') {
      const focusables = panelEl?.querySelectorAll<HTMLElement>(
        'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const list = [...focusables];
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
</script>

{#if props.open}
  <div class="qo-mask" role="presentation" onclick={() => props.onClose()}>
    <div
      class="qo-panel"
      role="dialog"
      aria-modal="true"
      aria-label="快速打开"
      tabindex="-1"
      bind:this={panelEl}
      onclick={(e) => e.stopPropagation()}
      onkeydown={onKeydown}
    >
      <div class="input-wrapper">
        <Search size={15} strokeWidth={1.5} class="search-icon" />
        <input
          class="qo-input"
          placeholder="输入文件名快速搜索与打开 (⌘P)…"
          role="combobox"
          aria-expanded="true"
          aria-controls="qo-listbox"
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          value={query}
          oninput={(e) => {
            query = (e.currentTarget as HTMLInputElement).value;
            cursor = 0;
          }}
          bind:this={inputEl}
        />
      </div>

      {#if quickOpen.truncated}
        <div class="qo-truncated" role="status">工作区文件较多，已限制显示匹配项</div>
      {/if}
      {#if error}
        <div class="qo-error" role="alert">扫描失败：{error}</div>
      {:else}
        <div class="qo-list" id="qo-listbox" role="listbox" aria-label="匹配文件">
          {#if results.length === 0}
            <div class="qo-empty">没有匹配的文件</div>
          {:else}
            {#each results as f, i (f.path)}
              {@const Icon = getFileIcon(f.name, false)}
              <button
                id="qo-opt-{i}"
                class="qo-item"
                class:active={i === cursor}
                role="option"
                aria-selected={i === cursor}
                tabindex="-1"
                onclick={() => pick(f)}
              >
                <span class="item-icon">
                  <Icon size={14} strokeWidth={1.5} />
                </span>
                <span class="qo-name">{f.name}</span>
                <span class="qo-path">{f.path}</span>
              </button>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .qo-mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 95;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 14vh;
  }
  .qo-panel {
    width: 580px;
    max-width: 90vw;
    background: color-mix(in srgb, var(--surface-elevated) 94%, transparent);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-popover);
    box-shadow: var(--shadow-popover);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .input-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    background: transparent;
    border-bottom: 1px solid var(--border-subtle);
  }
  :global(.search-icon) {
    color: var(--text-secondary);
    flex-shrink: 0;
  }
  .qo-input {
    width: 100%;
    box-sizing: border-box;
    font-size: 13.5px;
    padding: 12px 0;
    min-height: 42px;
    background: transparent;
    color: var(--text-primary);
    border: none;
    outline: none;
    letter-spacing: -0.01em;
  }
  .qo-truncated {
    padding: 4px 14px;
    font-size: 11px;
    color: var(--warning);
    background: color-mix(in srgb, var(--warning) 8%, transparent);
  }
  .qo-error {
    padding: 16px 14px;
    font-size: 12px;
    color: var(--danger);
    text-align: center;
  }
  .qo-list {
    max-height: 340px;
    overflow-y: auto;
    padding: 4px;
  }
  .qo-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    min-height: 30px;
    background: transparent;
    border: none;
    border-radius: var(--radius-control);
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
    transition: background var(--transition-fast), color var(--transition-fast);
  }
  .qo-item:hover {
    background: var(--surface-hover);
  }
  .qo-item.active {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--text-primary);
  }
  .item-icon {
    color: var(--text-secondary);
    display: inline-flex;
    flex-shrink: 0;
  }
  .qo-name {
    font-size: 12.5px;
    font-weight: 500;
    flex-shrink: 0;
  }
  .qo-path {
    font-size: 11px;
    font-family: var(--font-code);
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.7;
    margin-left: 4px;
  }
  .qo-empty {
    padding: 24px 12px;
    font-size: 12px;
    color: var(--text-secondary);
    text-align: center;
  }
</style>
