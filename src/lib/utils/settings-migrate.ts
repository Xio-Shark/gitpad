import { clampSafeContentBackground, normalizeHex } from './contrast';

export type ThemePreference = 'system' | 'dark' | 'light';

export interface AppearanceV2 {
  uiFontFamily: string;
  editorFontFamily: string;
  uiFontSize: number;
  editorFontSize: number;
  theme: ThemePreference;
  /** Editor/content background; chrome uses theme tokens. */
  contentBgColor: string;
  bgImage: string;
  bgOpacity: number;
}

export const DEFAULT_UI_FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
export const DEFAULT_EDITOR_FONT =
  "'Maple Mono NF', 'Maple Mono', 'JetBrains Mono', 'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export const DEFAULT_APPEARANCE: AppearanceV2 = {
  uiFontFamily: '',
  editorFontFamily: '',
  uiFontSize: 13,
  editorFontSize: 16,
  theme: 'dark',
  contentBgColor: '#1e1e1e',
  bgImage: '',
  bgOpacity: 0.85,
};

function clampUiFontSize(n: number): number {
  return Math.min(20, Math.max(11, Math.round(n)));
}

function clampEditorFontSize(n: number): number {
  return Math.min(36, Math.max(10, Math.round(n)));
}

function asTheme(v: unknown): ThemePreference {
  return v === 'system' || v === 'dark' || v === 'light' ? v : 'dark';
}

/**
 * Migrate persisted settings appearance from v1 (fontFamily/fontSize/bgColor)
 * or partial v2 shapes into AppearanceV2 without dropping editor prefs.
 */
export function migrateAppearance(raw: unknown, resolvedTheme: 'dark' | 'light' = 'dark'): AppearanceV2 {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_APPEARANCE };

  const a = raw as Record<string, unknown>;
  const hasV2 =
    'uiFontFamily' in a ||
    'editorFontFamily' in a ||
    'uiFontSize' in a ||
    'editorFontSize' in a ||
    'contentBgColor' in a ||
    'theme' in a;

  const legacyFamily = typeof a.fontFamily === 'string' ? a.fontFamily : '';
  const legacySize = typeof a.fontSize === 'number' && Number.isFinite(a.fontSize) ? a.fontSize : undefined;
  const legacyBg =
    typeof a.bgColor === 'string'
      ? a.bgColor
      : typeof a.contentBgColor === 'string'
        ? a.contentBgColor
        : DEFAULT_APPEARANCE.contentBgColor;

  const editorFontFamily = hasV2
    ? typeof a.editorFontFamily === 'string'
      ? a.editorFontFamily
      : legacyFamily
    : legacyFamily;

  const uiFontFamily = hasV2 && typeof a.uiFontFamily === 'string' ? a.uiFontFamily : '';

  const editorFontSize = clampEditorFontSize(
    hasV2 && typeof a.editorFontSize === 'number' && Number.isFinite(a.editorFontSize)
      ? a.editorFontSize
      : (legacySize ?? DEFAULT_APPEARANCE.editorFontSize)
  );

  const uiFontSize = clampUiFontSize(
    hasV2 && typeof a.uiFontSize === 'number' && Number.isFinite(a.uiFontSize)
      ? a.uiFontSize
      : DEFAULT_APPEARANCE.uiFontSize
  );

  const theme = asTheme(a.theme);
  const contentBg = clampSafeContentBackground(
    normalizeHex(typeof legacyBg === 'string' ? legacyBg : DEFAULT_APPEARANCE.contentBgColor) ??
      DEFAULT_APPEARANCE.contentBgColor,
    resolvedTheme
  );

  return {
    uiFontFamily,
    editorFontFamily,
    uiFontSize,
    editorFontSize,
    theme,
    contentBgColor: contentBg,
    bgImage: typeof a.bgImage === 'string' ? a.bgImage : '',
    bgOpacity:
      typeof a.bgOpacity === 'number' && Number.isFinite(a.bgOpacity)
        ? Math.min(1, Math.max(0.2, a.bgOpacity))
        : DEFAULT_APPEARANCE.bgOpacity,
  };
}

export function resolveThemePreference(
  theme: ThemePreference,
  prefersDark = true
): 'dark' | 'light' {
  if (theme === 'system') return prefersDark ? 'dark' : 'light';
  return theme;
}
