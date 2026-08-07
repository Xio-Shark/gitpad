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
