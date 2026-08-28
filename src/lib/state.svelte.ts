import { fsListDir, fsWalk, type DirEntry, type WalkFile } from './api';
import { settings } from './settings.svelte';
import { classify, type RendererKind } from './utils/filetype';

export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  isSymlink: boolean;
  expanded: boolean;
  loaded: boolean;
  children: TreeNode[];
}

export interface Tab {
  id: string;
  path: string;
  name: string;
  kind: RendererKind;
  dirty: boolean;
  /** 文件编码（"utf-8" / "gbk"），保存时按原编码写回 */
  encoding: string;
  /** 文本内容缓存（dirty 对照与保存源） */
  content: string | null;
  /** git diff 预览所属工作区 */
  workspace?: string;
  /** 提交 diff 预览的提交 oid（存在时为历史提交查看模式） */
  commitOid?: string;
  /** Markdown 预览模式（眼睛按钮切换） */
  preview?: boolean;
}

// —— 会话恢复 ——
const SESSION_KEY = 'gitpad-session';

interface SessionState {
  workspacePath: string;
  paths: string[];
  activePath: string | null;
}

function loadSession(): SessionState | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.workspacePath !== 'string' || !Array.isArray(p?.paths)) return null;
    return p;
  } catch {
    return null;
  }
}

// 模块加载时缓存旧会话：持久化 effect 首次运行会写入空状态覆盖存储，
// 若等到 restoreSession 再读会读到空值
const cachedSession = loadSession();

// 持久化打开的标签页（普通标签，不含 git diff 预览）；效仿 settings 的 effect.root 写法
$effect.root(() => {
  $effect(() => {
    const paths = tabs.list.filter((t) => t.kind !== 'gitdiff').map((t) => t.path);
    const active = tabs.list.find((t) => t.id === tabs.activeId && t.kind !== 'gitdiff');
    const session: SessionState = {
      workspacePath: workspace.rootPath ?? '',
      paths,
      activePath: active?.path ?? null,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  });
});

/** 恢复上次会话的标签页（workspace 打开后调用；仅匹配同一工作区） */
export function restoreSession(): void {
  const session = cachedSession;
  if (!session) return;
  if (workspace.rootPath !== session.workspacePath) return;
  for (const path of session.paths) {
    if (tabs.list.some((t) => t.path === path && t.kind !== 'gitdiff')) continue;
    const name = path.split('/').pop() ?? path;
    tabs.list.push({
      id: path,
      path,
      name,
      kind: classify(path),
      dirty: false,
      encoding: 'utf-8',
      content: null,
      preview: false,
    });
  }
  if (session.activePath) {
    const tab = tabs.list.find((t) => t.path === session.activePath && t.kind !== 'gitdiff');
    if (tab) tabs.activeId = tab.id;
  }
}

export const workspace = $state<{
  rootPath: string | null;
  root: TreeNode | null;
  /** 文件树当前选中节点（Option+Cmd+C 复制路径等依赖） */
  selectedPath: string | null;
}>({
  rootPath: null,
  root: null,
  selectedPath: null,
});

export const tabs = $state<{ list: Tab[]; activeId: string | null }>({
  list: [],
  activeId: null,
});

export function activeTab(): Tab | null {
  return tabs.list.find((t) => t.id === tabs.activeId) ?? null;
}

export function activateTab(id: string): void {
  ui.settingsOpen = false;
  tabs.activeId = id;
  const tab = tabs.list.find((t) => t.id === id);
  if (tab && tab.kind !== 'gitdiff' && tab.path) {
    workspace.selectedPath = tab.path;
  }
}

/** 打开文件到标签页：同路径去重（跳过 git diff 预览标签），聚焦已有 */
export function openFile(rawPath: string): Tab {
  ui.settingsOpen = false;
  let path = rawPath;
  if (!path.startsWith('/') && workspace.rootPath) {
    const root = workspace.rootPath.replace(/\/+$/, '');
    path = `${root}/${path.replace(/^\/+/, '')}`;
  }
  const existing = tabs.list.find(
    (t) => (t.path === path || t.path === rawPath) && t.kind !== 'gitdiff'
  );
  if (existing) {
    if (existing.path !== path) {
      existing.path = path;
      existing.id = path;
      existing.content = null;
    }
    tabs.activeId = existing.id;
    workspace.selectedPath = existing.path;
    return existing;
  }
  const name = path.split('/').pop() ?? path;
  const tab: Tab = {
    id: path,
    path,
    name,
    kind: classify(path),
    dirty: false,
    encoding: 'utf-8',
    content: null,
    preview: false,
  };
  tabs.list.push(tab);
  tabs.activeId = tab.id;
  workspace.selectedPath = tab.path;
  return tab;
}

/** 切换 Markdown 预览模式 */
export function toggleMarkdownPreview(tab: Tab): void {
  tab.preview = !tab.preview;
}

/** 在工作区打开某个文件的 git diff 预览标签页（同名文件去重） */
export function openGitDiff(path: string, workspacePath: string): Tab {
  ui.settingsOpen = false;
  const existing = tabs.list.find((t) => t.kind === 'gitdiff' && t.path === path && t.workspace === workspacePath);
  if (existing) {
    tabs.activeId = existing.id;
    return existing;
  }
  const name = `diff: ${path.split('/').pop() ?? path}`;
  const tab: Tab = {
    id: `gitdiff:${workspacePath}:${path}`,
    path,
    name,
    kind: 'gitdiff',
    dirty: false,
    encoding: 'utf-8',
    content: null,
    workspace: workspacePath,
  };
  tabs.list.push(tab);
  tabs.activeId = tab.id;
  return tab;
}

/** 打开提交历史中某个提交的 diff 预览标签页 */
export function openCommitDiff(workspacePath: string, oid: string, label: string): Tab {
  ui.settingsOpen = false;
  const existing = tabs.list.find(
    (t) => t.kind === 'gitdiff' && t.commitOid === oid && t.workspace === workspacePath
  );
  if (existing) {
    tabs.activeId = existing.id;
    return existing;
  }
  const tab: Tab = {
    id: `gitdiff:${workspacePath}:commit:${oid}`,
    path: oid,
    name: `diff: ${label}`,
    kind: 'gitdiff',
    dirty: false,
    encoding: 'utf-8',
    content: null,
    workspace: workspacePath,
    commitOid: oid,
  };
  tabs.list.push(tab);
  tabs.activeId = tab.id;
  return tab;
}
/** git 变更计数：任何 stage/unstage/commit 操作后自增，供面板自动刷新 */
export const gitEvents = $state<{ tick: number }>({ tick: 0 });

export function bumpGitTick(): void {
  gitEvents.tick++;
}

/** 窗口级 UI 状态（对象形式，避免跨模块直接赋值裸 $state） */
export const ui = $state<{ settingsOpen: boolean; gitTab: 'changes' | 'history' }>({
  settingsOpen: false,
  gitTab: 'changes',
});

/** 快速打开文件缓存：打开工作区时惰性构建，树结构变化后失效重建 */
export const quickOpen = $state<{ files: WalkFile[] | null; truncated: boolean; stale: boolean }>({
  files: null,
  truncated: false,
  stale: true,
});

export function invalidateQuickOpen(): void {
  quickOpen.files = null;
  quickOpen.stale = true;
}

export async function ensureQuickOpen(): Promise<void> {
  if (!workspace.rootPath) return;
  if (quickOpen.files && !quickOpen.stale) return;
  const res = await fsWalk(workspace.rootPath, settings);
  quickOpen.files = res.files;
  quickOpen.truncated = res.truncated;
  quickOpen.stale = false;
}

/** 重新加载目录的子条目（树局部刷新）；无对应节点时重载整树 */
export async function refreshNode(path: string): Promise<void> {
  const target = workspace.root ? findNode(workspace.root, path) : null;
  if (!target || !target.isDir) {
    await reloadRoot();
    return;
  }
  const entries = await fsListDir(target.path, settings);
  target.children = entries.map(toNode);
  target.loaded = true;
  target.expanded = true;
}

export function closeTab(id: string): void {
  const idx = tabs.list.findIndex((t) => t.id === id);
  if (idx === -1) return;
  tabs.list.splice(idx, 1);
  if (tabs.activeId === id) {
    const next = tabs.list[Math.max(0, idx - 1)];
    tabs.activeId = next ? next.id : null;
    if (next && next.kind !== 'gitdiff' && next.path) {
      workspace.selectedPath = next.path;
    } else if (!next) {
      workspace.selectedPath = null;
    }
  }
}

/** 关闭标签页：有未保存修改时询问（供标签 ×、中键、Cmd+W 共用） */
export function closeTabChecked(id: string): void {
  const tab = tabs.list.find((t) => t.id === id);
  if (!tab) return;
  const name = tab.path.split('/').pop() ?? tab.name;
  if (!tab.dirty || confirm(`文件 ${name} 有未保存修改，确定关闭？`)) {
    closeTab(id);
  }
}

export function setTabContent(id: string, content: string, dirty: boolean): void {
  const tab = tabs.list.find((t) => t.id === id);
  if (!tab) return;
  tab.content = content;
  tab.dirty = dirty;
}

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

export const RECENT_WORKSPACES_KEY = 'gitpad-recent-workspaces';

export function getRecentWorkspaces(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(RECENT_WORKSPACES_KEY);
    if (!raw) {
      // 如果尚无记录，尝试从旧 session 恢复一个
      const s = loadSession();
      return s?.workspacePath ? [s.workspacePath] : [];
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function recordRecentWorkspace(path: string): void {
  try {
    if (typeof localStorage === 'undefined' || !path) return;
    const current = getRecentWorkspaces();
    const next = [path, ...current.filter((p) => p !== path)].slice(0, 10);
    localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(next));
  } catch {}
}

export function removeRecentWorkspace(path: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const current = getRecentWorkspaces();
    const next = current.filter((p) => p !== path);
    localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(next));
  } catch {}
}

/** 打开 Workspace：设置根并加载第一层 */
export async function openWorkspace(path: string): Promise<void> {
  recordRecentWorkspace(path);
  invalidateQuickOpen();
  workspace.selectedPath = null;
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

/** 展开目标路径的所有祖先目录，实现类似 VS Code 的 Auto-Reveal */
export async function revealPathInTree(root: TreeNode | null, path: string): Promise<boolean> {
  if (!root || !path.startsWith(root.path)) return false;
  const rel = path.slice(root.path.length).replace(/^\//, '');
  if (!rel) return true;
  const parts = rel.split('/');
  let current = root;
  let curPath = root.path;
  for (let i = 0; i < parts.length - 1; i++) {
    curPath += '/' + parts[i];
    if (!current.loaded) {
      await expandNode(current);
    }
    let child = current.children.find((c) => c.path === curPath);
    if (!child) break;
    if (child.isDir) {
      child.expanded = true;
      if (!child.loaded) {
        await expandNode(child);
      }
      current = child;
    } else {
      break;
    }
  }
  return true;
}

