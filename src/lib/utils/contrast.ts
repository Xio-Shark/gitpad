/** Relative luminance (sRGB) for a 6-digit hex color. */
export function relativeLuminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function contrastRatio(bgHex: string, fgHex: string): number | null {
  const a = relativeLuminance(bgHex);
  const b = relativeLuminance(fgHex);
  if (a == null || b == null) return null;
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA for normal text requires ≥ 4.5:1. */
export function meetsContrastAA(bgHex: string, fgHex: string, minRatio = 4.5): boolean {
  const ratio = contrastRatio(bgHex, fgHex);
  return ratio != null && ratio >= minRatio;
}

/**
 * Editor/content background must stay contrast-safe against the active theme
 * primary text. Rejects light backgrounds on dark chrome and vice versa.
 */
export function isSafeContentBackground(bgHex: string, theme: 'dark' | 'light'): boolean {
  const fg = theme === 'dark' ? '#d4d4d4' : '#1e1e1e';
  if (!meetsContrastAA(bgHex, fg)) return false;
  const lum = relativeLuminance(bgHex);
  if (lum == null) return false;
  // Keep content surface aligned with chrome theme direction.
  return theme === 'dark' ? lum <= 0.35 : lum >= 0.65;
}

export function clampSafeContentBackground(bgHex: string, theme: 'dark' | 'light'): string {
  if (isSafeContentBackground(bgHex, theme)) return normalizeHex(bgHex) ?? (theme === 'dark' ? '#1e1e1e' : '#ffffff');
  return theme === 'dark' ? '#1e1e1e' : '#ffffff';
}

export function normalizeHex(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  return `#${m[1]!.toLowerCase()}`;
}
