<script lang="ts">
  import type { CommitInfo, HistoryData } from '$lib/git';
  import { gitHistory } from '$lib/git';
  import { isAppError } from '$lib/api';
  import { openCommitDiff } from '$lib/state.svelte';
  import { layoutGraph, buildLinks, LANE_COLORS, LANE_WIDTH, ROW_HEIGHT, formatTime } from './gitgraph';

  let props = $props<{ workspace: string }>();

  let data = $state<HistoryData | null>(null);
  let error = $state<string | null>(null);
  let selected = $state<CommitInfo | null>(null);

  let rows = $derived(data ? layoutGraph(data.commits) : []);

  function yOf(oid: string): number {
    const idx = rows.findIndex((r) => r.commit.oid === oid);
    return idx === -1 ? -100 : idx * ROW_HEIGHT + ROW_HEIGHT / 2;
  }
  function laneOf(oid: string): number | undefined {
    return rows.find((r) => r.commit.oid === oid)?.lane;
  }

  /** 连线按行切段：竖线/斜线在各行内连续，形成贯穿视觉 */
  interface Seg {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    row: number;
  }

  function sliceLinks(): Seg[] {
    const segs: Seg[] = [];
    for (const link of buildLinks(rows, yOf, laneOf)) {
      const yTop = Math.min(link.y1, link.y2);
      const yBot = Math.max(link.y1, link.y2);
      const rowA = Math.max(0, Math.floor(yTop / ROW_HEIGHT));
      const rowB = Math.min(rows.length - 1, Math.floor(yBot / ROW_HEIGHT));
      const dx = link.x2 - link.x1;
      const dy = link.y2 - link.y1;
      for (let i = rowA; i <= rowB; i++) {
        const t1 = (i * ROW_HEIGHT - link.y1) / dy;
        const t2 = ((i + 1) * ROW_HEIGHT - link.y1) / dy;
        const ta = Math.max(0, Math.min(t1, t2));
        const tb = Math.min(1, Math.max(t1, t2));
        if (tb - ta < 0.001) continue;
        segs.push({
          x1: link.x1 + dx * ta,
          y1: link.y1 + dy * ta,
          x2: link.x1 + dx * tb,
          y2: link.y1 + dy * tb,
          color: link.color,
          row: i,
        });
      }
    }
    return segs;
  }

  let segs = $derived(sliceLinks());
  let maxLane = $derived(rows.reduce((m, r) => Math.max(m, r.lane), 0));
  let graphWidth = $derived((maxLane + 1) * LANE_WIDTH + 8);

  function rowSegs(i: number): Seg[] {
    return segs.filter((s) => s.row === i);
  }

  function isHead(c: CommitInfo): boolean {
    return c.refs.includes('HEAD');
  }

  async function load() {
    error = null;
    try {
      data = await gitHistory(props.workspace, 200);
    } catch (e) {
      error = isAppError(e) ? e.message : String(e);
    }
  }

  async function openCommit(c: CommitInfo) {
    selected = c;
    openCommitDiff(props.workspace, c.oid, c.message || c.short);
  }
</script>

<div class="history-view">
  {#if error}
    <div class="panel-error">{error}</div>
  {/if}
  {#if !data}
    <div class="empty-note">加载中…</div>
  {:else if rows.length === 0}
    <div class="empty-note">暂无提交</div>
  {:else}
    <div class="list-area">
      {#each rows as row, i (row.commit.oid)}
        {@const c = row.commit}
        {@const head = isHead(c)}
        {@const merge = c.parents.length > 1}
        <button class="commit-row" class:active={selected?.oid === c.oid} onclick={() => void openCommit(c)}>
          <span class="graph-cell" style="width: {graphWidth}px">
            <svg width={graphWidth} height={ROW_HEIGHT}>
              {#each rowSegs(i) as s, si (si)}
                <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} stroke-width="2" />
              {/each}
              {#if merge}
                <polygon
                  points={[
                    row.lane * LANE_WIDTH + LANE_WIDTH / 2,
                    ROW_HEIGHT / 2 - 5,
                    row.lane * LANE_WIDTH + LANE_WIDTH / 2 + 5,
                    ROW_HEIGHT / 2,
                    row.lane * LANE_WIDTH + LANE_WIDTH / 2,
                    ROW_HEIGHT / 2 + 5,
                    row.lane * LANE_WIDTH + LANE_WIDTH / 2 - 5,
                    ROW_HEIGHT / 2,
                  ].join(' ')}
                  fill={LANE_COLORS[row.lane % LANE_COLORS.length]}
                />
              {:else}
                <circle
                  cx={row.lane * LANE_WIDTH + LANE_WIDTH / 2}
                  cy={ROW_HEIGHT / 2}
                  r={head ? 5.5 : 4.5}
                  fill="var(--bg)"
                  stroke={head ? '#d29922' : LANE_COLORS[row.lane % LANE_COLORS.length]}
                  stroke-width="2"
                />
                <circle
                  cx={row.lane * LANE_WIDTH + LANE_WIDTH / 2}
                  cy={ROW_HEIGHT / 2}
                  r="1.6"
                  fill={LANE_COLORS[row.lane % LANE_COLORS.length]}
                />
              {/if}
            </svg>
          </span>
          <span class="commit-body">
            <span class="commit-msg" title={c.message}>{c.message}</span>
            <span class="commit-meta">
              {c.author} · {formatTime(c.time)}
              {#if c.refs.length > 0}
                <span class="refs">
                  {#each c.refs as ref, ri (ref)}
                    <span class="ref-tag" class:head={ref === 'HEAD'}>{ref}</span>
                  {/each}
                </span>
              {/if}
            </span>
          </span>
        </button>
      {/each}
    </div>
    <div class="empty-note hint">点击提交，diff 在中间编辑区显示</div>
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
    flex: 1;
    overflow: auto;
  }
  .commit-row {
    height: 32px;
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
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .commit-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    color: var(--text-secondary);
  }
  .commit-row.active .commit-msg {
    color: var(--text-on-accent);
  }
  .commit-row.active .commit-meta {
    color: var(--text-on-accent);
    opacity: 0.85;
  }
  .refs {
    display: flex;
    gap: 3px;
    overflow: hidden;
  }
  .ref-tag {
    font-size: 9.5px;
    font-family: var(--font-mono);
    padding: 0 5px;
    border-radius: 3px;
    background: rgba(77, 170, 252, 0.2);
    color: #4daafc;
    border: 1px solid rgba(77, 170, 252, 0.4);
    white-space: nowrap;
  }
  .ref-tag.head {
    background: rgba(210, 153, 34, 0.2);
    color: #d29922;
    border-color: rgba(210, 153, 34, 0.4);
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
  .hint {
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
</style>
