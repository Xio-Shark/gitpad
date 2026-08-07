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
 * 经典 lane 分配（类似 git 官方图形）：
 * 按 topo 序（新→旧）遍历，每个提交占用/复用一列；
 * 第一父继承本列，其余父占空闲列；同一提交被多个子引用时清除所有残留位置。
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
    // 清除该提交在 lanes 里的所有残留位置（多个子引用同一父时）
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] === c.oid) lanes[i] = null;
    }

    rows.push({ commit: c, lane });

    const parents = c.parents;
    if (parents.length === 0) {
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
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (sameDay) return `今天 ${hm}`;
  if (isYesterday) return `昨天 ${hm}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}
