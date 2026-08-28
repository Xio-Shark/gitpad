import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUIRED_CSS_TOKENS, missingRequiredTokens, parseRootCustomProperties } from './css-tokens';

describe('css tokens', () => {
  it('app.css declares every required semantic token', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/routes/app.css'), 'utf8');
    expect(missingRequiredTokens(css)).toEqual([]);
  });

  it('parseRootCustomProperties finds dark and light theme variables', () => {
    const css = `
      :root { --accent: #0e639c; }
      :root[data-theme='light'] { --accent: #0078d4; --surface-app: #fff; }
    `;
    const found = parseRootCustomProperties(css);
    expect(found.has('--accent')).toBe(true);
    expect(found.has('--surface-app')).toBe(true);
    expect(REQUIRED_CSS_TOKENS.includes('--accent')).toBe(true);
  });
});
