import { convertFileSrc } from '@tauri-apps/api/core';
import {
  clampSafeContentBackground,
  isSafeContentBackground,
  normalizeHex,
} from './utils/contrast';
import {
  DEFAULT_APPEARANCE,
  DEFAULT_EDITOR_FONT,
  DEFAULT_UI_FONT,
  migrateAppearance,
  resolveThemePreference,
  type AppearanceV2,
  type ThemePreference,
} from './utils/settings-migrate';

export type Appearance = AppearanceV2;
export type { ThemePreference };

export interface Settings {
  showHidden: boolean;
  showNodeModules: boolean;
  appearance: Appearance;
}

const DEFAULTS: Settings = {
  showHidden: false,
  showNodeModules: false,
  appearance: { ...DEFAULT_APPEARANCE },
};

const STORAGE_KEY = 'gitpad-settings';

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function load(): Settings {
  try {
    if (typeof localStorage === 'undefined') return structuredClone(DEFAULTS);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    const themeHint = resolveThemePreference(
      parsed.appearance?.theme === 'system' ||
        parsed.appearance?.theme === 'dark' ||
        parsed.appearance?.theme === 'light'
        ? parsed.appearance.theme
        : 'dark',
      systemPrefersDark()
    );
    return {
      showHidden: parsed.showHidden ?? DEFAULTS.showHidden,
      showNodeModules: parsed.showNodeModules ?? DEFAULTS.showNodeModules,
      appearance: migrateAppearance(parsed.appearance, themeHint),
    };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[gitpad] malformed settings; recovering defaults', e);
    }
    return structuredClone(DEFAULTS);
  }
}

export const settings = $state<Settings>(load());

$effect.root(() => {
  $effect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  });
});

export function resolvedTheme(): 'dark' | 'light' {
  return resolveThemePreference(settings.appearance.theme, systemPrefersDark());
}

export function setContentBgColor(hex: string): boolean {
  const theme = resolvedTheme();
  const normalized = normalizeHex(hex);
  if (!normalized || !isSafeContentBackground(normalized, theme)) {
    return false;
  }
  settings.appearance.contentBgColor = normalized;
  return true;
}

export function setTheme(theme: ThemePreference): void {
  settings.appearance.theme = theme;
  const resolved = resolveThemePreference(theme, systemPrefersDark());
  settings.appearance.contentBgColor = clampSafeContentBackground(
    settings.appearance.contentBgColor,
    resolved
  );
}

/** 把外观设置应用到 CSS 变量与 document（$effect 自动随设置变化调用） */
export function applyAppearance(): void {
  const a = settings.appearance;
  const root = document.documentElement;
  const theme = resolveThemePreference(a.theme, systemPrefersDark());
  root.dataset.theme = theme;

  const uiFamily = a.uiFontFamily.trim() || DEFAULT_UI_FONT;
  const codeFamily = a.editorFontFamily.trim() || DEFAULT_EDITOR_FONT;
  const style = root.style;
  style.setProperty('--ui-font-family', uiFamily);
  style.setProperty('--font-ui', uiFamily);
  style.setProperty('--font-mono', codeFamily);
  style.setProperty('--font-code', codeFamily);
  style.setProperty('--ui-font-size', `${a.uiFontSize}px`);
  style.setProperty('--font-size-ui', `${a.uiFontSize}px`);
  style.setProperty('--font-size-code', `${a.editorFontSize}px`);

  const contentBg = clampSafeContentBackground(a.contentBgColor, theme);
  if (contentBg !== a.contentBgColor) {
    a.contentBgColor = contentBg;
  }

  const hasImage = a.bgImage.trim() !== '';
  const alpha = hasImage ? Math.min(1, Math.max(0.2, a.bgOpacity)) : 1;
  style.setProperty('--bg-alpha', hexToRgba(contentBg, alpha));
  // Content surface only — chrome stays on theme tokens.
  style.setProperty('--content-bg', contentBg);

  document.body.style.backgroundImage = hasImage ? `url(${convertFileSrc(a.bgImage)})` : 'none';
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundPosition = 'center';
  document.body.style.backgroundAttachment = 'fixed';
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(30, 30, 30, ${alpha})`;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
