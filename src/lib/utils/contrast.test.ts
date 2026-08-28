import { describe, expect, it } from 'vitest';
import { isSafeContentBackground, meetsContrastAA } from './contrast';

describe('contrast', () => {
  it('accepts default dark content background', () => {
    expect(isSafeContentBackground('#1e1e1e', 'dark')).toBe(true);
    expect(meetsContrastAA('#1e1e1e', '#d4d4d4')).toBe(true);
  });

  it('rejects light background on dark theme', () => {
    expect(isSafeContentBackground('#ffffff', 'dark')).toBe(false);
  });
});
