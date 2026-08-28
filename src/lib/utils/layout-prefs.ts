export interface LayoutPreferences {
  explorerOpen: boolean;
  explorerWidth: number;
  gitOpen: boolean;
  gitWidth: number;
}

export const LAYOUT_STORAGE_KEY = 'gitpad-layout-v1';
export const COMPACT_BREAKPOINT = 960;
export const MIN_EDITOR_WIDTH = 420;
export const SEPARATOR_WIDTH = 4;
export const EXPLORER_MIN = 180;
export const EXPLORER_MAX = 360;
export const EXPLORER_DEFAULT = 240;
export const GIT_MIN = 240;
export const GIT_MAX = 480;
export const GIT_DEFAULT = 280;

export type PaneSide = 'explorer' | 'git';

export const DEFAULT_LAYOUT: LayoutPreferences = {
  explorerOpen: true,
  explorerWidth: EXPLORER_DEFAULT,
  gitOpen: true,
  gitWidth: GIT_DEFAULT,
};

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function clampExplorerWidth(width: number): number {
  return clamp(Math.round(width), EXPLORER_MIN, EXPLORER_MAX);
}

export function clampGitWidth(width: number): number {
  return clamp(Math.round(width), GIT_MIN, GIT_MAX);
}

export function migrateLayoutPreferences(raw: unknown): LayoutPreferences {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_LAYOUT };
  const o = raw as Partial<LayoutPreferences>;
  return {
    explorerOpen: typeof o.explorerOpen === 'boolean' ? o.explorerOpen : DEFAULT_LAYOUT.explorerOpen,
    explorerWidth: clampExplorerWidth(
      typeof o.explorerWidth === 'number' && Number.isFinite(o.explorerWidth)
        ? o.explorerWidth
        : DEFAULT_LAYOUT.explorerWidth
    ),
    gitOpen: typeof o.gitOpen === 'boolean' ? o.gitOpen : DEFAULT_LAYOUT.gitOpen,
    gitWidth: clampGitWidth(
      typeof o.gitWidth === 'number' && Number.isFinite(o.gitWidth) ? o.gitWidth : DEFAULT_LAYOUT.gitWidth
    ),
  };
}

export interface ResolvedPanes {
  explorerVisible: boolean;
  gitVisible: boolean;
  explorerWidth: number;
  gitWidth: number;
  editorMinWidth: number;
  compact: boolean;
}

/**
 * Resolve visible panes for a container width.
 * Compact mode (<960): at most one side pane; prefer the pane the user just toggled open,
 * falling back to explorer then git from stored prefs.
 */
export function resolvePanes(
  prefs: LayoutPreferences,
  containerWidth: number,
  preferredSide: 'explorer' | 'git' | null = null
): ResolvedPanes {
  const compact = containerWidth < COMPACT_BREAKPOINT;
  let explorerVisible = prefs.explorerOpen;
  let gitVisible = prefs.gitOpen;

  if (compact) {
    if (explorerVisible && gitVisible) {
      if (preferredSide === 'git') {
        explorerVisible = false;
      } else if (preferredSide === 'explorer') {
        gitVisible = false;
      } else {
        // Default: keep explorer, hide git so editor stays usable at 800px.
        gitVisible = false;
      }
    }
  }

  let explorerWidth = explorerVisible ? prefs.explorerWidth : 0;
  let gitWidth = gitVisible ? prefs.gitWidth : 0;

  // Guarantee editor ≥ 420px by shrinking/hiding side panes if needed.
  // Separators occupy grid tracks and must be reserved in the side budget.
  const sepBudget = () =>
    ((explorerVisible ? 1 : 0) + (gitVisible ? 1 : 0)) * SEPARATOR_WIDTH;
  let sideBudget = Math.max(0, containerWidth - MIN_EDITOR_WIDTH - sepBudget());
  let used = explorerWidth + gitWidth;
  if (used > sideBudget) {
    const scale = sideBudget / used;
    explorerWidth = explorerVisible ? Math.floor(explorerWidth * scale) : 0;
    gitWidth = gitVisible ? Math.floor(gitWidth * scale) : 0;
    used = explorerWidth + gitWidth;
    if (used > sideBudget) {
      // Drop the non-preferred side first.
      if (gitVisible && preferredSide !== 'git') {
        gitVisible = false;
        gitWidth = 0;
      } else if (explorerVisible) {
        explorerVisible = false;
        explorerWidth = 0;
      }
      sideBudget = Math.max(0, containerWidth - MIN_EDITOR_WIDTH - sepBudget());
    }
    // Re-clamp remaining visible pane into remaining budget.
    if (explorerVisible) {
      explorerWidth = clamp(explorerWidth, 0, sideBudget);
      if (explorerWidth < EXPLORER_MIN) {
        explorerVisible = false;
        explorerWidth = 0;
        sideBudget = Math.max(0, containerWidth - MIN_EDITOR_WIDTH - sepBudget());
      }
    }
    if (gitVisible) {
      gitWidth = clamp(gitWidth, 0, sideBudget - explorerWidth);
      if (gitWidth < GIT_MIN) {
        gitVisible = false;
        gitWidth = 0;
      }
    }
  }

  return {
    explorerVisible,
    gitVisible,
    explorerWidth: explorerVisible ? clampExplorerWidth(explorerWidth) : 0,
    gitWidth: gitVisible ? clampGitWidth(gitWidth) : 0,
    editorMinWidth: MIN_EDITOR_WIDTH,
    compact,
  };
}

/**
 * Toggle semantics based on *effective* visibility (compact mode may hide a
 * pane whose preference is still open). Showing a hidden-by-compact pane only
 * updates preferredSide instead of flipping its open flag off.
 */
export function paneToggleNext(
  side: PaneSide,
  prefs: LayoutPreferences,
  containerWidth: number,
  preferredSide: PaneSide | null
): { explorerOpen: boolean; gitOpen: boolean; preferredSide: PaneSide | null } {
  const resolved = resolvePanes(prefs, containerWidth, preferredSide);
  if (side === 'explorer') {
    if (resolved.explorerVisible) {
      return {
        explorerOpen: false,
        gitOpen: prefs.gitOpen,
        preferredSide,
      };
    }
    return {
      explorerOpen: true,
      gitOpen: prefs.gitOpen,
      preferredSide: 'explorer',
    };
  }
  if (resolved.gitVisible) {
    return {
      explorerOpen: prefs.explorerOpen,
      gitOpen: false,
      preferredSide,
    };
  }
  return {
    explorerOpen: prefs.explorerOpen,
    gitOpen: true,
    preferredSide: 'git',
  };
}

export function gridTemplateColumns(resolved: ResolvedPanes): string {
  const parts: string[] = [];
  if (resolved.explorerVisible) {
    parts.push(`${resolved.explorerWidth}px`);
    parts.push(`${SEPARATOR_WIDTH}px`);
  }
  parts.push(`minmax(${resolved.editorMinWidth}px, 1fr)`);
  if (resolved.gitVisible) {
    parts.push(`${SEPARATOR_WIDTH}px`);
    parts.push(`${resolved.gitWidth}px`);
  }
  return parts.join(' ');
}
