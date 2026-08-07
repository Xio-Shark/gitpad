import { invoke } from '@tauri-apps/api/core';

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_symlink: boolean;
}

export interface AppError {
  code: string;
  message: string;
}

export function isAppError(e: unknown): e is AppError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    'message' in e
  );
}

export async function fsListDir(
  path: string,
  opts: { showHidden: boolean; showNodeModules: boolean }
): Promise<DirEntry[]> {
  return invoke<DirEntry[]>('fs_list_dir', {
    params: { path, show_hidden: opts.showHidden, show_node_modules: opts.showNodeModules },
  });
}

/** 文本读取上限（与 Rust 侧 MAX_TEXT_SIZE 一致） */
export const MAX_TEXT_SIZE = 10 * 1024 * 1024;
/** CSV 表格视图上限（超过则降级只读文本） */
export const MAX_CSV_TABLE_SIZE = 20 * 1024 * 1024;

export async function fsReadFile(path: string, maxSize?: number): Promise<string> {
  return invoke<string>('fs_read_file', {
    params: maxSize ? { path, max_size: maxSize } : { path },
  });
}

export async function fsWriteFile(path: string, content: string): Promise<void> {
  return invoke<void>('fs_write_file', { params: { path, content } });
}

export interface WalkFile {
  path: string;
  name: string;
}

export interface WalkResult {
  files: WalkFile[];
  truncated: boolean;
}

export async function fsWalk(
  root: string,
  opts: { showHidden: boolean; showNodeModules: boolean; limit?: number }
): Promise<WalkResult> {
  return invoke<WalkResult>('fs_walk', {
    params: {
      root,
      limit: opts.limit ?? 20000,
      show_hidden: opts.showHidden,
      show_node_modules: opts.showNodeModules,
    },
  });
}

export async function fsCreateFile(path: string): Promise<void> {
  return invoke<void>('fs_create_file', { params: { path } });
}

export async function fsCreateDir(path: string): Promise<void> {
  return invoke<void>('fs_create_dir', { params: { path } });
}

export async function fsRename(oldPath: string, newPath: string): Promise<void> {
  return invoke<void>('fs_rename', { params: { old_path: oldPath, new_path: newPath } });
}

export async function fsDelete(path: string, recursive: boolean): Promise<void> {
  return invoke<void>('fs_delete', { params: { path, recursive } });
}
