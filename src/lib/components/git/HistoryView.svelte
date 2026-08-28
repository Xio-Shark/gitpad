<script lang="ts">
  import type { CommitInfo, HistoryData } from '$lib/git';
  import { gitHistory } from '$lib/git';
  import { isAppError } from '$lib/api';
  import { openCommitDiff } from '$lib/state.svelte';
  import {
    layoutGraph,
    buildLinks,
    LANE_COLORS,
    LANE_WIDTH,
    ROW_HEIGHT,
    formatTime,
  } from './gitgraph';

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

  /** 按行索引预聚合线段，避免滚动时在每行进行 O(N) 过滤 */
  function computeSegsByRow(): Map<number, Seg[]> {
    const map = new Map<number, Seg[]>();
    for (const link of buildLinks(rows, yOf, laneOf)) {
      const yTop = Math.min(link.y1, link.y2);
      const yBot = Math.max(link.y1, link.y2);
      const rowA = Math.max(0, Math.floor(yTop / ROW_HEIGHT));
      const rowB = Math.min(rows.length - 1, Math.floor(yBot / ROW_HEIGHT));
      const dx = link.x2 - link.x1;
      const dy = link.y2 - link.y1;

      for (let i = rowA; i <= rowB; i++) {
        if (Math.abs(dy) < 0.0001) {
          const seg: Seg = {
            x1: link.x1,
            y1: link.y1,
            x2: link.x2,
            y2: link.y2,
            color: link.color,
            row: i,
          };
          let arr = map.get(i);
          if (!arr) {
            arr = [];
            map.set(i, arr);
          }
          arr.push(seg);
          continue;
        }

        const t1 = (i * ROW_HEIGHT - link.y1) / dy;
        const t2 = ((i + 1) * ROW_HEIGHT - link.y1) / dy;
        const ta = Math.max(0, Math.min(t1, t2));
        const tb = Math.min(1, Math.max(t1, t2));
        if (tb - ta < 0.001) continue;

        const seg: Seg = {
          x1: link.x1 + dx * ta,
          y1: link.y1 + dy * ta,
          x2: link.x1 + dx * tb,
          y2: link.y1 + dy * tb,
          color: link.color,
          row: i,
        };
        let arr = map.get(i);
        if (!arr) {
          arr = [];
          map.set(i, arr);
        }
        arr.push(seg);
      }
    }
    return map;
  }

  let segsByRow = $derived(computeSegsByRow());
  let maxLane = $derived(rows.reduce((m, r) => Math.max(m, r.lane), 0));
  let graphWidth = $derived((maxLane + 1) * LANE_WIDTH + 8);

  /** 平滑贝塞尔曲线连接 */
  function segPath(s: Seg): string {
    const yMid = (s.y1 + s.y2) / 2;
    return `M ${s.x1} ${s.y1} C ${s.x1} ${yMid}, ${s.x2} ${yMid}, ${s.x2} ${s.y2}`;
  }

  function isHead(c: CommitInfo): boolean {
    return c.refs.includes('HEAD');
  }

  function getInitials(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return '?';
    return trimmed.slice(0, 2).toUpperCase();
  }

  async function load() {
    error = null;
    try {
      data = await gitHistory(props.workspace, 200);
    } catch (e) {
      error = isAppError(e) ? e.message : String(e);
    }
  }

  // 挂载即加载；切回该标签页或工作区变化时也刷新
  $effect(() => {
    void props.workspace;
    void load();
  });

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
    <div class="empty-note">加载提交历史中…</div>
  {:else if rows.length === 0}
    <div class="empty-note">暂无提交记录</div>
  {:else}
    <div class="list-area">
      {#each rows as row, i (row.commit.oid)}
        {@const c = row.commit}
        {@const head = isHead(c)}
        {@const merge = c.parents.length > 1}
        {@const laneColor = LANE_COLORS[row.lane % LANE_COLORS.length]}
        {@const nodeX = row.lane * LANE_WIDTH + LANE_WIDTH / 2}
        {@const nodeY = ROW_HEIGHT / 2}
        <button
          class="commit-row"
          class:active={selected?.oid === c.oid}
          onclick={() => void openCommit(c)}
          title={`查看提交详情: ${c.oid}\n${c.message}`}
        >
          <!-- 左侧平滑分支图谱 -->
          <span class="graph-cell" style="width: {graphWidth}px">
            <svg width={graphWidth} height={ROW_HEIGHT} class="graph-svg">
              {#each segsByRow.get(i) ?? [] as s, si (si)}
                <path
                  d={segPath(s)}
                  fill="none"
                  stroke={s.color}
                  stroke-width="1.75"
                  stroke-linecap="round"
                  opacity="0.85"
                />
              {/each}

              {#if merge}
                <polygon
                  points={[
                    nodeX, nodeY - 4.5,
                    nodeX + 4.5, nodeY,
                    nodeX, nodeY + 4.5,
                    nodeX - 4.5, nodeY,
                  ].join(' ')}
                  fill={laneColor}
                  stroke="var(--surface-panel)"
                  stroke-width="1.5"
                />
              {:else}
                <circle
                  cx={nodeX}
                  cy={nodeY}
                  r={head ? 4.5 : 3.5}
                  fill={head ? 'var(--accent)' : laneColor}
                  stroke="var(--surface-panel)"
                  stroke-width="1.5"
                />
                {#if head}
                  <circle
                    cx={nodeX}
                    cy={nodeY}
                    r={6.5}
                    fill="none"
                    stroke="var(--accent)"
                    stroke-width="1.2"
                    opacity="0.6"
                  />
                {/if}
              {/if}
            </svg>
          </span>

          <!-- 右侧提交主体信息 -->
          <div class="commit-body">
            <div class="commit-header-line">
              <span class="commit-msg" title={c.message}>{c.message || '(无提交信息)'}</span>
              <span class="commit-hash">{c.short}</span>
            </div>
            <div class="commit-meta-line">
              <span class="author-avatar">{getInitials(c.author)}</span>
              <span class="author-name" title={c.author}>{c.author}</span>
              <span class="commit-time">{formatTime(c.time)}</span>
              {#if c.refs.length > 0}
                <div class="refs-wrap">
                  {#each c.refs as ref (ref)}
                    <span class="ref-pill" class:head={ref === 'HEAD'}>{ref}</span>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .history-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--surface-panel);
    user-select: none;
    overscroll-behavior: contain;
  }
  .list-area {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    overscroll-behavior-y: contain;
  }
  .commit-row {
    height: 44px;
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    border-bottom: 1px solid color-mix(in srgb, var(--border-subtle) 40%, transparent);
    cursor: pointer;
    padding: 0 10px 0 4px;
    text-align: left;
    width: 100%;
    transition: background var(--transition-fast);
  }
  .commit-row:hover {
    background: var(--surface-hover);
  }
  .commit-row.active {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    box-shadow: inset 3px 0 0 var(--accent);
  }
  .graph-cell {
    flex-shrink: 0;
    display: block;
    height: 44px;
  }
  .graph-svg {
    display: block;
  }
  .commit-body {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
  }
  .commit-header-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .commit-msg {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    letter-spacing: -0.1px;
  }
  .commit-hash {
    font-size: 10px;
    font-family: var(--font-code);
    color: var(--text-secondary);
    background: var(--surface-app);
    padding: 1px 5px;
    border-radius: 4px;
    border: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }
  .commit-meta-line {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-secondary);
  }
  .author-avatar {
    font-size: 9px;
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--surface-app);
    border: 1px solid var(--border-subtle);
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .author-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 80px;
    font-size: 11px;
  }
  .commit-time {
    flex-shrink: 0;
    opacity: 0.75;
    font-size: 10.5px;
  }
  .refs-wrap {
    display: flex;
    gap: 4px;
    overflow: hidden;
    margin-left: auto;
  }
  .ref-pill {
    font-size: 9.5px;
    font-family: var(--font-code);
    padding: 0 5px;
    border-radius: 3px;
    background: var(--surface-app);
    color: var(--text-secondary);
    border: 1px solid var(--border-subtle);
    white-space: nowrap;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ref-pill.head {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    font-weight: 500;
  }
  .panel-error {
    padding: 10px 14px;
    font-size: 12px;
    color: var(--danger);
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    border-bottom: 1px solid var(--border-subtle);
  }
  .empty-note {
    padding: 24px 16px;
    font-size: 12.5px;
    color: var(--text-secondary);
    text-align: center;
  }
</style>
