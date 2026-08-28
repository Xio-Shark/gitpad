/** Required semantic CSS custom properties that must exist on :root in app.css */
export const REQUIRED_CSS_TOKENS = [
  '--surface-app',
  '--surface-panel',
  '--surface-elevated',
  '--surface-hover',
  '--text-primary',
  '--text-secondary',
  '--text-disabled',
  '--text-on-accent',
  '--border-subtle',
  '--border-strong',
  '--focus-ring',
  '--accent',
  '--success',
  '--warning',
  '--danger',
  '--font-ui',
  '--font-code',
  '--font-size-ui',
  '--font-size-meta',
  '--font-size-code',
  '--control-sm',
  '--control-md',
  '--row-height',
  '--radius-control',
  '--radius-popover',
  // Compatibility aliases consumed by existing components
  '--bg',
  '--bg-secondary',
  '--bg-alpha',
  '--border',
  '--hover',
  '--text',
  '--font-mono',
] as const;

/** Parse :root custom-property declarations from a CSS source string. */
export function parseRootCustomProperties(css: string): Set<string> {
  const found = new Set<string>();
  const rootBlocks = css.matchAll(/:root\s*(?:\[[^\]]+\])?\s*\{([^}]*)\}/g);
  for (const block of rootBlocks) {
    const body = block[1] ?? '';
    for (const match of body.matchAll(/(--[\w-]+)\s*:/g)) {
      found.add(match[1]!);
    }
  }
  return found;
}

export function missingRequiredTokens(css: string, required: readonly string[] = REQUIRED_CSS_TOKENS): string[] {
  const found = parseRootCustomProperties(css);
  return required.filter((token) => !found.has(token));
}
