<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import type { Tab } from '$lib/state.svelte';
  import { PdfDocument, highlightMatches, type SearchHit } from './pdf';

  let props = $props<{ tab: Tab }>();

  let loading = $state(true);
  let error = $state<string | null>(null);
  let numPages = $state(0);
  let pageNum = $state(1);
  let scale = $state(1);
  let fitWidth = $state(false);
  let indexing = $state(false);
  let searchQuery = $state('');
  let matchIdx = $state(0);
  let totalMatches = $state(0);
  let noMatch = $state(false);
  let statusMsg = $state('');

  let container = $state<HTMLDivElement | null>(null);
  let doc = $state<PdfDocument | null>(null);
  let currentRender: { cancel(): void } | null = null;
  let hits: SearchHit[] = [];
  let renderSeq = 0;
  let searchPromise: Promise<void> | null = null;

  onMount(() => {
    void load();
  });

  onDestroy(() => {
    currentRender?.cancel();
    doc?.destroy();
    doc = null;
  });

  async function load() {
    loading = true;
    error = null;
    try {
      doc = await PdfDocument.open(convertFileSrc(props.tab.path));
      numPages = doc.numPages;
      pageNum = 1;
      await renderPage();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  const pageInput = $state({ value: '1' });

  async function renderPage() {
    if (!doc || !container) return;
    const seq = ++renderSeq;
    currentRender?.cancel();
    currentRender = null;
    try {
      const handle = await doc.renderPage(pageNum, scale, container);
      if (seq !== renderSeq) {
        handle.cancel();
        return;
      }
      currentRender = handle;
      pageInput.value = String(pageNum);
      if (searchQuery.trim()) {
        highlightMatches(handle.textLayerDiv, searchQuery);
      }
    } catch (e) {
      if (seq !== renderSeq) return;
      error = e instanceof Error ? e.message : String(e);
    }
  }

  function zoomBy(factor: number) {
    fitWidth = false;
    scale = Math.min(3, Math.max(0.5, scale * factor));
    void renderPage();
  }

  async function fitToWidth() {
    if (!doc || !container) return;
    fitWidth = true;
    const size = await doc.pageSizeAtScale1(pageNum);
    const available = container.clientWidth - 48;
    scale = Math.min(3, Math.max(0.5, available / size.width));
    void renderPage();
  }

  function goToPage(p: number) {
    if (!doc) return;
    const clamped = Math.min(numPages, Math.max(1, p));
    pageNum = clamped;
    void renderPage();
  }

  async function doSearch() {
    if (!doc || searchPromise) return;
    const q = searchQuery.trim();
    noMatch = false;
    if (!q) {
      hits = [];
      totalMatches = 0;
      matchIdx = 0;
      statusMsg = '';
      return;
    }
    indexing = true;
    statusMsg = '正在索引…';
    searchPromise = (async () => {
      try {
        hits = await doc!.searchAll(q, (done, total) => {
          statusMsg = `正在索引… ${done}/${total}`;
        });
        totalMatches = hits.length;
        matchIdx = 0;
        if (hits.length === 0) {
          noMatch = true;
          statusMsg = `未找到 "${q}"`;
        } else {
          noMatch = false;
          statusMsg = '';
          await jumpToHit(0);
        }
      } finally {
        indexing = false;
        searchPromise = null;
      }
    })();
    await searchPromise;
  }

  async function jumpToHit(i: number) {
    if (hits.length === 0) return;
    const idx = ((i % hits.length) + hits.length) % hits.length;
    matchIdx = idx;
    const hit = hits[idx];
    pageNum = hit.page;
    await renderPage();
  }

  function nextHit() {
    if (hits.length === 0) return;
    void jumpToHit(matchIdx + 1);
  }

  function prevHit() {
    if (hits.length === 0) return;
    void jumpToHit(matchIdx - 1);
  }
</script>

<div class="pdf-renderer">
  {#if loading}
    <div class="msg">加载中…</div>
  {:else if error}
    <div class="msg error">{error}</div>
  {:else if doc}
    <div class="toolbar">
      <div class="group">
        <button title="缩小" onclick={() => zoomBy(0.8)}>−</button>
        <span class="scale-label">{Math.round(scale * 100)}%</span>
        <button title="放大" onclick={() => zoomBy(1.25)}>+</button>
        <button class:active={fitWidth} title="适应宽度" onclick={() => void fitToWidth()}>适应</button>
      </div>
      <div class="group">
        <button title="上一页" disabled={pageNum <= 1} onclick={() => goToPage(pageNum - 1)}>◀</button>
        <input
          class="page-input"
          bind:value={pageInput.value}
          aria-label="页码"
          onchange={() => {
            const n = parseInt(pageInput.value, 10);
            if (!Number.isNaN(n)) goToPage(n);
            else pageInput.value = String(pageNum);
          }}
        />
        <span class="page-total">/ {numPages}</span>
        <button title="下一页" disabled={pageNum >= numPages} onclick={() => goToPage(pageNum + 1)}>▶</button>
      </div>
      <div class="group search-group">
        <input
          class="search-input"
          placeholder="搜索…"
          bind:value={searchQuery}
          onkeydown={(e) => {
            if (e.key === 'Enter') void doSearch();
            if (e.key === 'Escape') {
              searchQuery = '';
              hits = [];
              totalMatches = 0;
              statusMsg = '';
            }
          }}
        />
        {#if totalMatches > 0}
          <span class="match-count">{matchIdx + 1}/{totalMatches}</span>
          <button disabled={totalMatches === 0} onclick={prevHit}>↑</button>
          <button disabled={totalMatches === 0} onclick={nextHit}>↓</button>
        {:else if noMatch}
          <span class="no-match">未找到</span>
        {/if}
      </div>
      {#if statusMsg && !noMatch && totalMatches === 0}
        <span class="status">{statusMsg}</span>
      {/if}
    </div>
    <div class="canvas-wrap">
      <div class="page-stage" bind:this={container}></div>
    </div>
  {/if}
</div>

<style>
  .pdf-renderer {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #101010;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .group {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .toolbar button {
    font-size: 12px;
    padding: 3px 9px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
  }
  .toolbar button:hover:not(:disabled) {
    color: var(--text);
  }
  .toolbar button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .toolbar button.active {
    background: var(--accent);
    color: var(--text-on-accent);
  }
  .scale-label {
    font-size: 12px;
    color: var(--text-secondary);
    min-width: 44px;
    text-align: center;
  }
  .page-input {
    width: 44px;
    padding: 2px 4px;
    font-size: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    text-align: right;
  }
  .page-total {
    font-size: 12px;
    color: var(--text-secondary);
  }
  .search-input {
    width: 140px;
    padding: 3px 8px;
    font-size: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
  }
  .match-count {
    font-size: 12px;
    color: var(--text-secondary);
  }
  .no-match {
    font-size: 12px;
    color: var(--danger);
  }
  .status {
    font-size: 12px;
    color: var(--text-secondary);
  }
  .canvas-wrap {
    flex: 1;
    overflow: auto;
    padding: 16px 24px;
  }
  .page-stage {
    position: relative;
    margin: 0 auto;
    width: fit-content;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  }
  .msg {
    padding: 16px;
    color: var(--text-secondary);
    font-size: 13px;
  }
  .msg.error {
    color: var(--danger);
  }
</style>
