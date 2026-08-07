/** 固定行高虚拟滚动：给定总行数与滚动容器，返回可见行区间 */
export function visibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowCount: number,
  rowHeight: number,
  overscan = 6
): { start: number; end: number; totalHeight: number } {
  const totalHeight = rowCount * rowHeight;
  if (rowCount === 0) return { start: 0, end: 0, totalHeight };
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return { start, end, totalHeight };
}
