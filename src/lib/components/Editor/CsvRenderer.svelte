<script lang="ts">
  import { onMount } from 'svelte';
  import Papa from 'papaparse';
  import type { Tab } from '$lib/state.svelte';
  import { fsReadFile, isAppError, MAX_CSV_TABLE_SIZE } from '$lib/api';
  import { setTabContent } from '$lib/state.svelte';
  import { visibleRange } from '$lib/utils/windowing';
  import TextRenderer from './TextRenderer.svelte';

  let props = $props<{ tab: Tab }>();

  let mode = $state<'table' | 'text'>('table');
  let rows: string[][] = $state([]);
  let header: string[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let parseError = $state(false);

  let scrollTop = $state(0);
  let viewportHeight = $state(600);
  const ROW_HEIGHT = 28;

  onMount(async () => {
    loading = true;
    error = null;
    try {
      if (props.tab.content === null) {
        const content = await fsReadFile(props.tab.path, MAX_CSV_TABLE_SIZE);
        setTabContent(props.tab.id, content, false);
      }
      buildTable();
    } catch (e) {
      if (isAppError(e) && e.code === 'file_too_large') {
        error = `文件过大（超过 ${MAX_CSV_TABLE_SIZE / 1024 / 1024}MB），无法打开，建议外部工具`;
      } else {
        error = isAppError(e) ? e.message : String(e);
      }
    } finally {
      loading = false;
    }
  });

  function buildTable(): void {
    const content = props.tab.content ?? '';
    const result = Papa.parse<string[]>(content, { skipEmptyLines: 'greedy' });
    if (result.errors.length > 0 && result.data.length === 0) {
      parseError = true;
      mode = 'text';
      return;
    }
    const data = result.data as string[][];
    if (data.length === 0) {
      header = [];
      rows = [];
      return;
    }
    header = data[0];
    rows = data.slice(1);
  }

  let range = $derived(visibleRange(scrollTop, viewportHeight, rows.length, ROW_HEIGHT));
  let visibleRows = $derived(rows.slice(range.start, range.end));
</script>

<div class="csv-renderer">
  <div class="toolbar">
    <button class:active={mode === 'table'} onclick={() => (mode = 'table')} disabled={error !== null}>
      表格
    </button>
    <button class:active={mode === 'text'} onclick={() => (mode = 'text')} disabled={error !== null}>
      文本
    </button>
    <span class="meta">{rows.length.toLocaleString()} 行 × {header.length} 列</span>
  </div>

  {#if loading}
    <div class="msg">加载中…</div>
  {:else if error}
    <div class="msg error">{error}</div>
  {:else if parseError}
    <div class="msg">CSV 解析失败（可能不是标准 CSV），已切换到文本模式</div>
    <div class="text-host"><TextRenderer tab={props.tab} /></div>
  {:else if mode === 'table'}
    <div class="table-wrap">
      <div class="table-scroll" onscroll={(e) => (scrollTop = (e.currentTarget as HTMLDivElement).scrollTop)} bind:clientHeight={viewportHeight}>
        <div style="height: {range.totalHeight}px; position: relative;">
          {#each visibleRows as row, i (range.start + i)}
            <div
              class="table-row"
              style="top: {(range.start + i) * ROW_HEIGHT}px;"
            >
              {#each row as cell, ci (ci)}
                <span class="cell">{cell}</span>
              {/each}
            </div>
          {/each}
        </div>
      </div>
      {#if header.length > 0}
        <div class="header-row">
          {#each header as cell, i (i)}
            <span class="cell header-cell">{cell}</span>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="text-host"><TextRenderer tab={props.tab} /></div>
  {/if}
</div>

<style>
  .csv-renderer {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .toolbar button {
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
  }
  .toolbar button.active {
    background: var(--accent);
    color: var(--text-on-accent);
  }
  .toolbar button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .meta {
    font-size: 11px;
    color: var(--text-secondary);
    margin-left: 8px;
  }
  .msg {
    padding: 16px;
    font-size: 13px;
    color: var(--text-secondary);
  }
  .msg.error {
    color: var(--danger);
  }
  .table-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .table-scroll {
    flex: 1;
    overflow: auto;
    position: relative;
  }
  .table-row {
    position: absolute;
    left: 0;
    right: 0;
    height: 28px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  .table-row:hover {
    background: var(--hover);
  }
  .cell {
    font-size: 12px;
    padding: 0 10px;
    border-right: 1px solid var(--border);
    min-width: 120px;
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
  }
  .header-row {
    display: flex;
    border-top: 1px solid var(--border);
    background: var(--bg-secondary);
    position: sticky;
    bottom: 0;
  }
  .header-cell {
    font-weight: 600;
    color: var(--text);
  }
  .text-host {
    flex: 1;
    min-height: 0;
  }
</style>
