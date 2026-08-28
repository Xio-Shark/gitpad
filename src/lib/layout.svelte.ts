import {
  DEFAULT_LAYOUT,
  LAYOUT_STORAGE_KEY,
  clampExplorerWidth,
  clampGitWidth,
  gridTemplateColumns,
  migrateLayoutPreferences,
  paneToggleNext,
  resolvePanes,
  type LayoutPreferences,
  type PaneSide,
  type ResolvedPanes,
} from './utils/layout-prefs';

function load(): LayoutPreferences {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT };
    return migrateLayoutPreferences(JSON.parse(raw));
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[gitpad] malformed layout prefs; recovering defaults', e);
    }
    return { ...DEFAULT_LAYOUT };
  }
}

export const layoutPrefs = $state<LayoutPreferences>(load());

/** Last side the user explicitly toggled open — used in compact mode. */
let preferredSide = $state<PaneSide | null>(null);
export const containerWidth = $state<{ value: number }>({ value: 1200 });

$effect.root(() => {
  $effect(() => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutPrefs));
  });
});

export function resolvedLayout(): ResolvedPanes {
  return resolvePanes(layoutPrefs, containerWidth.value, preferredSide);
}

export function layoutGridTemplate(): string {
  return gridTemplateColumns(resolvedLayout());
}

export function toggleExplorer(): void {
  const next = paneToggleNext('explorer', layoutPrefs, containerWidth.value, preferredSide);
  layoutPrefs.explorerOpen = next.explorerOpen;
  layoutPrefs.gitOpen = next.gitOpen;
  preferredSide = next.preferredSide;
}

export function toggleGit(): void {
  const next = paneToggleNext('git', layoutPrefs, containerWidth.value, preferredSide);
  layoutPrefs.explorerOpen = next.explorerOpen;
  layoutPrefs.gitOpen = next.gitOpen;
  preferredSide = next.preferredSide;
}

export function setExplorerWidth(width: number): void {
  layoutPrefs.explorerWidth = clampExplorerWidth(width);
}

export function setGitWidth(width: number): void {
  layoutPrefs.gitWidth = clampGitWidth(width);
}

export function setContainerWidth(width: number): void {
  containerWidth.value = Math.max(0, Math.round(width));
}
