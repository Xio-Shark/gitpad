<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import Search from 'lucide-svelte/icons/search';
  import ArrowUpDown from 'lucide-svelte/icons/arrow-up-down';
  import ArrowUp from 'lucide-svelte/icons/arrow-up';
  import ArrowDown from 'lucide-svelte/icons/arrow-down';
  import Papa from 'papaparse';
  import type { Tab } from '$lib/state.svelte';
  import { clipboardCopy, fsReadFile, isAppError, MAX_CSV_TABLE_SIZE } from '$lib/api';
  import { setTabContent } from '$lib/state.svelte';
  import { visibleRange } from '$lib/utils/windowing';
  import TextRenderer from './TextRenderer.svelte';

  let props = $props<{ tab: Tab }>();

  let mode = $state<'table' | 'text'>('table');
  let rawRows: string[][] = $state([]);
  let header: string[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let parseError = $state(false);
  let searchQuery = $state('');
  let sortCol = $state<number | null>(null);
  let sortOrder = $state<'asc' | 'desc'>('asc');

  let scrollTop = $state(0);
  let viewportHeight = $state(600);
  const ROW_HEIGHT = 28;

  onMount(async () => {
    loading = true;
    error = null;
    try {
      if (props.tab.content === null) {
        const res = await fsReadFile(props.tab.path, MAX_CSV_TABLE_SIZE);
        props.tab.encoding = res.encoding;
        setTabContent(props.tab.id, res.content, false);
      }
      buildTable();
    } catch (e) {
      if (isAppError(e) && e.code === 'file_too_large') {
        error = `文件过大（超过 ${MAX_CSV_TABLE_SIZE / 1024 / 1024}MB），无法直接打开，建议外部工具`;
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
      rawRows = [];
      return;
    }
    header = data[0]!;
    rawRows = data.slice(1);
  }

  function handleSort(colIdx: number) {
    if (sortCol === colIdx) {
      if (sortOrder === 'asc') sortOrder = 'desc';
      else {
        sortCol = null;
        sortOrder = 'asc';
      }
    } else {
      sortCol = colIdx;
      sortOrder = 'asc';
    }
  }

  const filteredRows = $derived.by(() => {
    let rows = rawRows;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => r.some((cell) => cell.toLowerCase().includes(q)));
    }
    if (sortCol !== null) {
      const idx = sortCol;
      const order = sortOrder;
      rows = [...rows].sort((a, b) => {
        const valA = a[idx] ?? '';
        const valB = b[idx] ?? '';
        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return order === 'asc' ? numA - numB : numB - numA;
        }
        return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }
    return rows;
  });

  let range = $derived(visibleRange(scrollTop, viewportHeight, filteredRows.length, ROW_HEIGHT));
  let visibleRows = $derived(filteredRows.slice(range.start, range.end));

  async function copyCell(text: string) {
    try {
      await clipboardCopy(text);
      toast.success('已复制单元格内容');
    } catch {
      toast.error('复制失败');
    }
  }
</script>

<div class="csv-renderer">
  <div class="toolbar">
    <div class="mode-group">
      <button class="toggle-btn" class:active={mode === 'table'} onclick={() => (mode = 'table')} disabled={error !== null}>
        表格视图
      </button>
      <button class="toggle-btn" class:active={mode === 'text'} onclick={() => (mode = 'text')} disabled={error !== null}>
        文本源文件
      </button>
    </div>

    {#if mode === 'table' && !loading && !error}
      <div class="search-box">
        <Search size={12} strokeWidth={2} class="search-icon" />
        <input
          type="text"
          placeholder="筛选行数据…"
          bind:value={searchQuery}
        />
        {#if searchQuery}
          <button class="clear-btn" onclick={() => (searchQuery = '')}>×</button>
        {/if}
      </div>

      <span class="meta">
        共 {filteredRows.length.toLocaleString()} 行 / {header.length} 列
      </span>
    {/if}
  </div>

  {#if loading}
    <div class="msg">解析数据中…</div>
  {:else if error}
    <div class="msg error">{error}</div>
  {:else if parseError}
    <div class="msg">CSV 解析失败（非标准格式），已自动切换为文本编辑</div>
    <div class="text-host"><TextRenderer tab={props.tab} /></div>
  {:else if mode === 'table'}
    <div class="table-wrap selectable-text csv-table">
      <!-- Fixed Sticky Header at the top -->
      {#if header.length > 0}
        <div class="header-row">
          <span class="cell header-cell row-index">#</span>
          {#each header as cell, i (i)}
            <button
              class="cell header-cell sortable"
              onclick={() => handleSort(i)}
              title="点击排序"
            >
              <span class="header-text">{cell}</span>
              <span class="sort-icon">
                {#if sortCol === i}
                  {#if sortOrder === 'asc'}
                    <ArrowUp size={11} strokeWidth={2} />
                  {:else}
                    <ArrowDown size={11} strokeWidth={2} />
                  {/if}
                {:else}
                  <ArrowUpDown size={10} strokeWidth={1.5} class="inactive-sort" />
                {/if}
              </span>
            </button>
          {/each}
        </div>
      {/if}

      <div
        class="table-scroll"
        onscroll={(e) => (scrollTop = (e.currentTarget as HTMLDivElement).scrollTop)}
        bind:clientHeight={viewportHeight}
      >
        <div style="height: {range.totalHeight}px; position: relative;">
          {#each visibleRows as row, i (range.start + i)}
            <div
              class="table-row"
              style="top: {(range.start + i) * ROW_HEIGHT}px;"
            >
              <span class="cell row-index">{range.start + i + 1}</span>
              {#each row as cell, ci (ci)}
                <span
                  class="cell"
                  role="button"
                  tabindex="-1"
                  title="双击复制: {cell}"
                  ondblclick={() => void copyCell(cell)}
                >{cell}</span>
              {/each}
            </div>
          {/each}
        </div>
      </div>
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
    background: var(--surface-app);
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 12px;
    background: var(--surface-panel);
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }
  .mode-group {
    display: flex;
    background: var(--surface-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-control);
    padding: 2px;
    gap: 2px;
  }
  .toggle-btn {
    padding: 2px 8px;
    font-size: 11px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    border-radius: 3px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .toggle-btn:hover {
    color: var(--text-primary);
  }
  .toggle-btn.active {
    background: var(--surface-panel);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }
  .search-box {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--surface-app);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-control);
    padding: 2px 8px;
    width: 180px;
  }
  :global(.search-icon) {
    color: var(--text-secondary);
    flex-shrink: 0;
  }
  .search-box input {
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 11px;
    width: 100%;
    outline: none;
  }
  .clear-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    padding: 0 2px;
  }
  .meta {
    font-size: 11px;
    color: var(--text-secondary);
    font-family: var(--font-code);
    margin-left: auto;
  }
  .msg {
    padding: 24px;
    font-size: 13px;
    color: var(--text-secondary);
    text-align: center;
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
    background: var(--surface-panel);
  }
  .header-row {
    display: flex;
    background: var(--surface-elevated);
    border-bottom: 1px solid var(--border-strong);
    position: sticky;
    top: 0;
    z-index: 10;
    flex-shrink: 0;
  }
  .header-cell {
    font-weight: 600;
    color: var(--text-primary);
    background: transparent;
    border: none;
    text-align: left;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 30px;
    user-select: none;
  }
  .header-cell.sortable {
    cursor: pointer;
    transition: background var(--transition-fast);
  }
  .header-cell.sortable:hover {
    background: var(--surface-hover);
  }
  .header-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sort-icon {
    display: inline-flex;
    margin-left: 4px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }
  :global(.inactive-sort) {
    opacity: 0.35;
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
    border-bottom: 1px solid var(--border-subtle);
    white-space: nowrap;
    transition: background var(--transition-fast);
  }
  .table-row:hover {
    background: var(--surface-hover);
  }
  .cell {
    font-size: 11.5px;
    padding: 0 10px;
    border-right: 1px solid var(--border-subtle);
    min-width: 120px;
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
    color: var(--text-primary);
  }
  .cell.row-index {
    min-width: 44px;
    max-width: 44px;
    text-align: center;
    color: var(--text-secondary);
    font-family: var(--font-code);
    font-size: 10.5px;
    opacity: 0.7;
    user-select: none;
  }
  .text-host {
    flex: 1;
    min-height: 0;
  }
</style>
