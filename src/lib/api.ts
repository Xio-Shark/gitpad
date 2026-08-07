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
