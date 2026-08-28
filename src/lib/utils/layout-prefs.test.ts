import { describe, expect, it } from 'vitest';
import {
  MIN_EDITOR_WIDTH,
  SEPARATOR_WIDTH,
  clampExplorerWidth,
  clampGitWidth,
  gridTemplateColumns,
  migrateLayoutPreferences,
  paneToggleNext,
  resolvePanes,
} from './layout-prefs';

describe('layout preferences', () => {
  it('clamps explorer and git widths', () => {
    expect(clampExplorerWidth(100)).toBe(180);
    expect(clampExplorerWidth(400)).toBe(360);
    expect(clampGitWidth(100)).toBe(240);
    expect(clampGitWidth(900)).toBe(480);
  });

  it('migrates malformed layout to defaults', () => {
    expect(migrateLayoutPreferences({ explorerWidth: 'nope' })).toMatchObject({
      explorerOpen: true,
      explorerWidth: 240,
      gitOpen: true,
      gitWidth: 280,
    });
  });

  it('keeps editor ≥420px at 800px by hiding git in compact mode', () => {
    const resolved = resolvePanes(
      { explorerOpen: true, explorerWidth: 240, gitOpen: true, gitWidth: 280 },
      800
    );
    expect(resolved.compact).toBe(true);
    expect(resolved.explorerVisible).toBe(true);
    expect(resolved.gitVisible).toBe(false);
    const occupied =
      (resolved.explorerVisible ? resolved.explorerWidth : 0) +
      (resolved.gitVisible ? resolved.gitWidth : 0);
    expect(800 - occupied).toBeGreaterThanOrEqual(MIN_EDITOR_WIDTH);
  });

  it('shows both panes at 1200px', () => {
    const resolved = resolvePanes(
      { explorerOpen: true, explorerWidth: 240, gitOpen: true, gitWidth: 280 },
      1200
    );
    expect(resolved.explorerVisible).toBe(true);
    expect(resolved.gitVisible).toBe(true);
    expect(gridTemplateColumns(resolved)).toContain('minmax(420px, 1fr)');
  });

  it('prefers git when user toggles it open in compact mode', () => {
    const resolved = resolvePanes(
      { explorerOpen: true, explorerWidth: 240, gitOpen: true, gitWidth: 280 },
      800,
      'git'
    );
    expect(resolved.gitVisible).toBe(true);
    expect(resolved.explorerVisible).toBe(false);
  });

  it('reserves separator width so editor stays ≥420px', () => {
    const resolved = resolvePanes(
      { explorerOpen: true, explorerWidth: 360, gitOpen: true, gitWidth: 480 },
      800,
      'explorer'
    );
    const occupied =
      (resolved.explorerVisible ? resolved.explorerWidth + SEPARATOR_WIDTH : 0) +
      (resolved.gitVisible ? resolved.gitWidth + SEPARATOR_WIDTH : 0);
    expect(800 - occupied).toBeGreaterThanOrEqual(MIN_EDITOR_WIDTH);
  });

  it('shows git in compact mode when prefs say open but explorer is currently visible', () => {
    const prefs = { explorerOpen: true, explorerWidth: 240, gitOpen: true, gitWidth: 280 };
    // Default compact: explorer visible, git hidden despite gitOpen.
    const next = paneToggleNext('git', prefs, 800, null);
    expect(next.gitOpen).toBe(true);
    expect(next.preferredSide).toBe('git');
    const resolved = resolvePanes(prefs, 800, next.preferredSide);
    expect(resolved.gitVisible).toBe(true);
    expect(resolved.explorerVisible).toBe(false);
  });

  it('hides the currently visible explorer on toggle', () => {
    const prefs = { explorerOpen: true, explorerWidth: 240, gitOpen: true, gitWidth: 280 };
    const next = paneToggleNext('explorer', prefs, 800, null);
    expect(next.explorerOpen).toBe(false);
  });
});
