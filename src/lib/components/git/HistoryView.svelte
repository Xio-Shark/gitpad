<script lang="ts">
  import { onMount } from 'svelte';
  import type { CommitInfo, DiffFile, HistoryData } from '$lib/git';
  import { gitCommitDiff, gitHistory } from '$lib/git';
  import { isAppError } from '$lib/api';
  import DiffView from './DiffView.svelte';
  import { layoutGraph, buildLinks, LANE_COLORS, LANE_WIDTH, ROW_HEIGHT, formatTime } from './gitgraph';

  let props = $props<{ workspace: string }>();

  let data = $state<HistoryData | null>(null);
  let error = $state<string | null>(null);
  let selected = $state<CommitInfo | null>(null);
  let selectedDiff = $state<DiffFile[]>([]);
  let diffLoading = $state(false);

  let rows = $derived(data ? layoutGraph(data.commits) : []);

  function yOf(oid: string): number {
    const idx = rows.findIndex((r) => r.commit.oid === oid);
    return idx === -1 ? -100 : idx * ROW_HEIGHT + ROW_HEIGHT / 2;
  }
  function laneOf(oid: string): number | undefined {
    return rows.find((r) => r.commit.oid === oid)?.lane;
  }

  let links = $derived(buildLinks(rows, yOf, laneOf));
  let maxLane = $derived(rows.reduce((m, r) => Math.max(m, r.lane), 0));

  onMount(() => {
    void load();
  });

  async function load() {
    error = null;
    try {
      data = await gitHistory(props.workspace, 100);
    } catch (e) {
      error = isAppError(e) ? e.message : String(e);
    }
  }

  async function openCommit(c: CommitInfo) {
    selected = c;
    selectedDiff = [];
    diffLoading = true;
    try {
      selectedDiff = await gitCommitDiff(props.workspace, c.oid);
    } catch (e) {
      error = isAppError(e) ? e.message : String(e);
    } finally {
      diffLoading = false;
    }
  }
</script>

<div class="history-view">
  {#if error}
    <div class="panel-error">{error}</div>
  {/if}
  {#if !data}
    <div class="empty-note">加载中…</div>
  {:else}
    <div class="list-area">
      {#each rows as row, i (row.commit.oid)}
        {@const c = row.commit}
        <button
          class="commit-row"
          class:active={selected?.oid === c.oid}
          onclick={() => void openCommit(c)}
        >
          <span class="graph-cell" style="width: {(maxLane + 1) * LANE_WIDTH + 8}px">
            <svg width="{(maxLane + 1) * LANE_WIDTH + 8}" height={ROW_HEIGHT}>
              {#each links.filter((l) => l.y1 === i * ROW_HEIGHT + ROW_HEIGHT / 2 || l.y2 === i * ROW_HEIGHT + ROW_HEIGHT / 2) as link, li (li)}
                <line x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} stroke={link.color} stroke-width="1.5" />
              {/each}
              <circle
                cx={row.lane * LANE_WIDTH + LANE_WIDTH / 2}
                cy={ROW_HEIGHT / 2}
                r="3.5"
                fill={LANE_COLORS[row.lane % LANE_COLORS.length]}
              />
            </svg>
          </span>
          <span class="commit-body">
            <span class="commit-msg" title={c.message}>{c.message}</span>
            <span class="commit-meta">{c.author} · {formatTime(c.time)}</span>
            {#if c.refs.length > 0}
              <span class="refs">
                {#each c.refs as ref, ri (ref)}
                  <span class="ref-tag" class:head={ref === 'HEAD'}>{ref}</span>
                {/each}
              </span>
            {/if}
          </span>
        </button>
      {/each}
    </div>
    {#if selected}
      <div class="detail-area">
        <div class="detail-head">
          <span class="detail-oid">{selected.short}</span>
          <span class="detail-author">{selected.author}</span>
          <span class="detail-time">{formatTime(selected.time)}</span>
        </div>
        <div class="detail-msg">{selected.message}</div>
        {#if diffLoading}
          <div class="empty-note">加载 diff…</div>
        {:else}
          <DiffView files={selectedDiff} readonly />
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .history-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .list-area {
    flex-shrink: 0;
    overflow: auto;
    max-height: 46%;
  }
  .commit-row {
    height: 26px;
    display: flex;
    align-items: center;
    gap: 2px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0 6px 0 0;
    text-align: left;
    width: 100%;
  }
  .commit-row:hover {
    background: var(--hover);
  }
  .commit-row.active {
    background: var(--accent);
  }
  .graph-cell {
    flex-shrink: 0;
    display: block;
  }
  .commit-body {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }
  .commit-msg {
    display: block;
    font-size: 12px;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .commit-meta {
    display: block;
    font-size: 10px;
    color: var(--text-secondary);
  }
  .commit-row.active .commit-msg {
    color: var(--text-on-accent);
  }
  .refs {
    display: flex;
    gap: 3px;
    margin-top: 1px;
  }
  .ref-tag {
    font-size: 9px;
    font-family: var(--font-mono);
    padding: 0 4px;
    border-radius: 3px;
    background: rgba(77, 170, 252, 0.2);
    color: #4daafc;
    border: 1px solid rgba(77, 170, 252, 0.4);
  }
  .ref-tag.head {
    background: rgba(210, 153, 34, 0.2);
    color: #d29922;
    border-color: rgba(210, 153, 34, 0.4);
  }
  .detail-area {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--border);
  }
  .detail-head {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 5px 8px;
    flex-shrink: 0;
  }
  .detail-oid {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-secondary);
  }
  .detail-author {
    font-size: 11px;
    color: var(--text-secondary);
  }
  .detail-time {
    font-size: 10px;
    color: var(--text-secondary);
    margin-left: auto;
  }
  .detail-msg {
    font-size: 12px;
    padding: 0 8px 5px;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .panel-error {
    padding: 6px 10px;
    font-size: 11px;
    color: var(--danger);
    border-bottom: 1px solid var(--border);
  }
  .empty-note {
    padding: 6px 10px;
    font-size: 11px;
    color: var(--text-secondary);
  }
</style>
