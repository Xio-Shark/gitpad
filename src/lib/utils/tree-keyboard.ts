export interface TreeKeyboardNode {
  path: string;
  isDir: boolean;
  expanded: boolean;
  children: TreeKeyboardNode[];
}

export interface FlatTreeRow {
  path: string;
  isDir: boolean;
  expanded: boolean;
  depth: number;
  /** Index among siblings for aria-setsize/posinset if needed */
  index: number;
}

export function flattenVisibleTree(root: TreeKeyboardNode | null): FlatTreeRow[] {
  const rows: FlatTreeRow[] = [];
  if (!root) return rows;

  function walk(node: TreeKeyboardNode, depth: number) {
    rows.push({
      path: node.path,
      isDir: node.isDir,
      expanded: node.expanded,
      depth,
      index: rows.length,
    });
    if (node.isDir && node.expanded) {
      for (const child of node.children) walk(child, depth + 1);
    }
  }

  walk(root, 0);
  return rows;
}

export type TreeNavAction =
  | { type: 'focus'; path: string }
  | { type: 'toggle'; path: string }
  | { type: 'collapse'; path: string }
  | { type: 'expand'; path: string }
  | { type: 'activate'; path: string }
  | { type: 'none' };

/**
 * Pure tree keyboard model (VS Code / WAI-ARIA tree pattern).
 * `focusedPath` is the roving tabindex owner.
 */
export function handleTreeKey(
  key: string,
  focusedPath: string | null,
  rows: FlatTreeRow[]
): TreeNavAction {
  if (rows.length === 0) return { type: 'none' };
  let idx = focusedPath ? rows.findIndex((r) => r.path === focusedPath) : 0;
  if (idx < 0) idx = 0;
  const current = rows[idx]!;

  switch (key) {
    case 'ArrowDown':
      return { type: 'focus', path: rows[Math.min(rows.length - 1, idx + 1)]!.path };
    case 'ArrowUp':
      return { type: 'focus', path: rows[Math.max(0, idx - 1)]!.path };
    case 'Home':
      return { type: 'focus', path: rows[0]!.path };
    case 'End':
      return { type: 'focus', path: rows[rows.length - 1]!.path };
    case 'ArrowRight':
      if (current.isDir && !current.expanded) return { type: 'expand', path: current.path };
      if (current.isDir && current.expanded && idx + 1 < rows.length) {
        return { type: 'focus', path: rows[idx + 1]!.path };
      }
      return { type: 'none' };
    case 'ArrowLeft':
      if (current.isDir && current.expanded) return { type: 'collapse', path: current.path };
      // Move to parent
      for (let i = idx - 1; i >= 0; i--) {
        if (rows[i]!.depth < current.depth) return { type: 'focus', path: rows[i]!.path };
      }
      return { type: 'none' };
    case 'Enter':
    case ' ':
      if (current.isDir) return { type: 'toggle', path: current.path };
      return { type: 'activate', path: current.path };
    default:
      return { type: 'none' };
  }
}
