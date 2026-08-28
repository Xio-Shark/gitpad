import { describe, expect, it } from 'vitest';
import { migrateAppearance } from './settings-migrate';

describe('migrateAppearance', () => {
  it('migrates v1 fontFamily/fontSize/bgColor into editor prefs', () => {
    const next = migrateAppearance(
      {
        fontFamily: 'Menlo, monospace',
        fontSize: 18,
        bgColor: '#1e1e1e',
        bgImage: '',
        bgOpacity: 0.9,
      },
      'dark'
    );
    expect(next.editorFontFamily).toBe('Menlo, monospace');
    expect(next.editorFontSize).toBe(18);
    expect(next.uiFontFamily).toBe('');
    expect(next.uiFontSize).toBe(13);
    expect(next.contentBgColor).toBe('#1e1e1e');
    expect(next.bgOpacity).toBe(0.9);
  });

  it('keeps v2 fields and clamps unsafe light content bg on dark theme', () => {
    const next = migrateAppearance(
      {
        uiFontFamily: "'PingFang SC', sans-serif",
        editorFontFamily: 'Menlo, monospace',
        uiFontSize: 14,
        editorFontSize: 15,
        theme: 'dark',
        contentBgColor: '#ffffff',
      },
      'dark'
    );
    expect(next.uiFontFamily).toBe("'PingFang SC', sans-serif");
    expect(next.editorFontSize).toBe(15);
    expect(next.contentBgColor).toBe('#1e1e1e');
  });

  it('returns defaults for malformed input', () => {
    const next = migrateAppearance(null);
    expect(next.theme).toBe('dark');
    expect(next.editorFontSize).toBe(16);
    expect(next.uiFontSize).toBe(13);
  });

  it('clamps font sizes within expanded ranges', () => {
    const minNext = migrateAppearance({ uiFontSize: 5, editorFontSize: 5 });
    expect(minNext.uiFontSize).toBe(11);
    expect(minNext.editorFontSize).toBe(10);

    const maxNext = migrateAppearance({ uiFontSize: 99, editorFontSize: 99 });
    expect(maxNext.uiFontSize).toBe(20);
    expect(maxNext.editorFontSize).toBe(36);
  });
});
