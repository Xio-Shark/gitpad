<script lang="ts">
  import { ensureQuickOpen, openFile, quickOpen } from '$lib/state.svelte';
  import type { WalkFile } from '$lib/api';

  let props = $props<{ open: boolean; onClose: () => void }>();

  let query = $state('');
  let cursor = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (props.open) {
      query = '';
      cursor = 0;
      void ensureQuickOpen();
      inputEl?.focus();
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
      cursor = Math.min(cursor + 1, results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cursor = Math.max(cursor - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const f = results[cursor];
      if (f) pick(f);
    }
  }
</script>

{#if props.open}
  <div class="qo-mask" role="presentation" onclick={() => props.onClose()}>
    <div class="qo-panel" role="dialog" aria-label="快速打开" tabindex="0" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <input
        class="qo-input"
        placeholder="输入文件名快速打开…"
        value={query}
        oninput={(e) => {
          query = (e.currentTarget as HTMLInputElement).value;
          cursor = 0;
        }}
        onkeydown={(e) => onKeydown(e)}
        bind:this={inputEl}
      />
      {#if quickOpen.truncated}
        <div class="qo-truncated">文件过多，已显示部分结果</div>
      {/if}
      <div class="qo-list">
        {#if results.length === 0}
          <div class="qo-empty">没有匹配的文件</div>
        {:else}
          {#each results as f, i (f.path)}
            <button class="qo-item" class:active={i === cursor} onclick={() => pick(f)}>
              <span class="qo-name">{f.name}</span>
              <span class="qo-path">{f.path}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .qo-mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 95;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 12vh;
  }
  .qo-panel {
    width: 520px;
    max-width: 90vw;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .qo-input {
    width: 100%;
    box-sizing: border-box;
    font-size: 14px;
    padding: 10px 12px;
    background: var(--bg);
    color: var(--text);
    border: none;
    border-bottom: 1px solid var(--border);
    outline: none;
  }
  .qo-truncated {
    padding: 4px 12px;
    font-size: 11px;
    color: #d29922;
  }
  .qo-list {
    max-height: 320px;
    overflow-y: auto;
  }
  .qo-item {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    padding: 6px 12px;
    background: none;
    border: none;
    color: var(--text);
    cursor: pointer;
    text-align: left;
  }
  .qo-item.active {
    background: var(--accent);
    color: var(--text-on-accent);
  }
  .qo-name {
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
  }
  .qo-path {
    font-size: 11px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .qo-item.active .qo-path {
    color: var(--text-on-accent);
    opacity: 0.8;
  }
  .qo-empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--text-secondary);
    text-align: center;
  }
</style>
