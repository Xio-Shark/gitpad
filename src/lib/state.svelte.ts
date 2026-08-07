import { fsListDir, type DirEntry } from './api';
import { settings } from './settings.svelte';

export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  isSymlink: boolean;
  expanded: boolean;
  loaded: boolean;
  children: TreeNode[];
}

export const workspace = $state<{ rootPath: string | null; root: TreeNode | null }>({
  rootPath: null,
  root: null,
});

function toNode(e: DirEntry): TreeNode {
  return {
    name: e.name,
    path: e.path,
    isDir: e.is_dir,
    isSymlink: e.is_symlink,
    expanded: false,
    loaded: false,
    children: [],
  };
}

/** 打开 Workspace：设置根并加载第一层 */
export async function openWorkspace(path: string): Promise<void> {
  workspace.rootPath = path;
  const entries = await fsListDir(path, settings);
  workspace.root = {
    name: path.split('/').pop() || path,
    path,
    isDir: true,
    isSymlink: false,
    expanded: true,
    loaded: true,
    children: entries.map(toNode),
  };
}

/** 惰性展开目录：未加载则拉取子条目 */
export async function expandNode(node: TreeNode): Promise<void> {
  if (node.loaded) return;
  const entries = await fsListDir(node.path, settings);
  node.children = entries.map(toNode);
  node.loaded = true;
}

export function toggleNode(node: TreeNode): void {
  if (!node.isDir) return;
  node.expanded = !node.expanded;
  if (node.expanded && !node.loaded) {
    void expandNode(node);
  }
}

/** 重载根目录（设置变更后刷新），保留已展开子树的展开状态 */
export async function reloadRoot(): Promise<void> {
  if (!workspace.rootPath) return;
  const expandedPaths = collectExpandedPaths(workspace.root);
  const entries = await fsListDir(workspace.rootPath, settings);
  const newRoot: TreeNode = {
    name: workspace.rootPath.split('/').pop() || workspace.rootPath,
    path: workspace.rootPath,
    isDir: true,
    isSymlink: false,
    expanded: true,
    loaded: true,
    children: entries.map(toNode),
  };
  workspace.root = newRoot;
  // 恢复展开状态：重新加载之前展开的目录
  for (const path of expandedPaths) {
    if (path === newRoot.path) continue;
    const node = findNode(newRoot, path);
    if (node?.isDir && node.children.length === 0) {
      node.expanded = true;
      await expandNode(node);
    }
  }
}

function collectExpandedPaths(root: TreeNode | null): string[] {
  const paths: string[] = [];
  function walk(node: TreeNode) {
    if (node.isDir && node.expanded && node.loaded) {
      paths.push(node.path);
      for (const child of node.children) walk(child);
    }
  }
  if (root) walk(root);
  return paths;
}

/** 按 path 查找节点（用于设置变更后恢复展开状态；当前实现重载根，展开状态按 path 合并） */
export function findNode(node: TreeNode, path: string): TreeNode | null {
  if (node.path === path) return node;
  for (const child of node.children) {
    const found = findNode(child, path);
    if (found) return found;
  }
  return null;
}
