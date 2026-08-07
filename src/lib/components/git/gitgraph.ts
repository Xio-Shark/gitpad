import type { CommitInfo } from '$lib/git';

export interface GraphRow {
  commit: CommitInfo;
  lane: number;
}

export const ROW_HEIGHT = 26;
export const LANE_WIDTH = 18;

export const LANE_COLORS = [
  '#4daafc',
  '#f97583',
  '#7ee787',
  '#d29922',
  '#b392f0',
  '#39c5cf',
  '#f0883e',
  '#76e3ea',
];

/**
 * 简单 lane 分配：按 topo 序（新→旧）遍历，
 * 每个 commit 占用（或复用）一列；第一父继承本列，其余父占用空闲列。
 */
export function layoutGraph(commits: CommitInfo[]): GraphRow[] {
  const lanes: (string | null)[] = [];
  const rows: GraphRow[] = [];

  for (const c of commits) {
    let lane = lanes.indexOf(c.oid);
    if (lane === -1) {
      lane = lanes.findIndex((l) => l === null);
      if (lane === -1) {
        lanes.push(null);
        lane = lanes.length - 1;
      }
    }
    rows.push({ commit: c, lane });

    const parents = c.parents;
    if (parents.length === 0) {
      lanes[lane] = null;
      continue;
    }
    lanes[lane] = parents[0];
    for (let i = 1; i < parents.length; i++) {
      const p = parents[i];
      if (!lanes.includes(p)) {
        const empty = lanes.findIndex((l) => l === null);
        if (empty === -1) {
          lanes.push(p);
        } else {
          lanes[empty] = p;
        }
      }
    }
  }
  return rows;
}

/** 生成连线（commit → parent 的斜线/竖线），坐标系：行顶 y = index * ROW_HEIGHT + ROW_HEIGHT/2 */
export function buildLinks(
  rows: GraphRow[],
  yOf: (oid: string) => number,
  laneOf: (oid: string) => number | undefined
): { x1: number; y1: number; x2: number; y2: number; color: string }[] {
  const links: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
  for (const row of rows) {
    const x1 = row.lane * LANE_WIDTH + LANE_WIDTH / 2;
    const y1 = yOf(row.commit.oid);
    for (const parent of row.commit.parents) {
      const l = laneOf(parent);
      if (l === undefined) continue;
      links.push({
        x1,
        y1,
        x2: l * LANE_WIDTH + LANE_WIDTH / 2,
        y2: yOf(parent),
        color: LANE_COLORS[row.lane % LANE_COLORS.length],
      });
    }
  }
  return links;
}

export function formatTime(seconds: number): string {
  const d = new Date(seconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
