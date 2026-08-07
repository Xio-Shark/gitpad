import { invoke } from '@tauri-apps/api/core';

export interface Change {
  path: string;
  status: string;
  staged: boolean;
  untracked: boolean;
}

export interface DiffLine {
  kind: string;
  text: string;
  old_no: number | null;
  new_no: number | null;
}

export interface Hunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  hunks: Hunk[];
  is_new: boolean;
  is_deleted: boolean;
  is_binary: boolean;
}

export interface StatusData {
  is_git: boolean;
  branch: string;
  ahead: number;
  behind: number;
  changes: Change[];
}

export interface RefInfo {
  name: string;
  oid: string;
}

export interface CommitInfo {
  oid: string;
  short: string;
  message: string;
  author: string;
  time: number;
  parents: string[];
  refs: string[];
}

export interface HistoryData {
  refs: RefInfo[];
  commits: CommitInfo[];
}

export function gitStatus(workspace: string): Promise<StatusData> {
  return invoke<StatusData>('git_status', { workspace });
}

export function gitDiff(workspace: string, file: string | null, staged: boolean): Promise<DiffFile[]> {
  return invoke<DiffFile[]>('git_diff', { workspace, file, staged });
}

export function gitStage(workspace: string, file: string, hunks?: number[]): Promise<void> {
  return invoke<void>('git_stage', { workspace, file, hunks: hunks ?? null });
}

export function gitUnstage(workspace: string, file: string, hunks?: number[]): Promise<void> {
  return invoke<void>('git_unstage', { workspace, file, hunks: hunks ?? null });
}

export function gitCommit(workspace: string, message: string): Promise<string> {
  return invoke<string>('git_commit', { workspace, message });
}

export function gitPush(workspace: string): Promise<string> {
  return invoke<string>('git_push', { workspace, remote: null });
}

export function gitPull(workspace: string): Promise<string> {
  return invoke<string>('git_pull', { workspace, remote: null });
}

export function gitHistory(workspace: string, limit?: number): Promise<HistoryData> {
  return invoke<HistoryData>('git_history', { workspace, limit: limit ?? 100 });
}

export function gitCommitDiff(workspace: string, oid: string): Promise<DiffFile[]> {
  return invoke<DiffFile[]>('git_commit_diff', { workspace, oid });
}
