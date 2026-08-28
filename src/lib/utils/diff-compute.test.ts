import { describe, expect, it } from 'vitest';
import { computeWordDiff, buildSplitRows, enrichUnifiedLines, calculateDiffStats } from './diff-compute';

describe('diff-compute', () => {
  it('computes word diff between two modified lines', () => {
    const oldLine = 'const count = 10;';
    const newLine = 'const count = 20;';

    const { oldSegments, newSegments } = computeWordDiff(oldLine, newLine);

    expect(oldSegments).toEqual([
      { text: 'const count = ', changed: false },
      { text: '1', changed: true },
      { text: '0;', changed: false },
    ]);

    expect(newSegments).toEqual([
      { text: 'const count = ', changed: false },
      { text: '2', changed: true },
      { text: '0;', changed: false },
    ]);
  });

  it('handles identical lines without marking changes', () => {
    const res = computeWordDiff('hello', 'hello');
    expect(res.oldSegments).toEqual([{ text: 'hello', changed: false }]);
    expect(res.newSegments).toEqual([{ text: 'hello', changed: false }]);
  });

  it('builds split rows properly with paired diffs', () => {
    const lines = [
      { kind: ' ', text: 'import foo;', old_no: 1, new_no: 1 },
      { kind: '-', text: 'const a = 1;', old_no: 2, new_no: null },
      { kind: '+', text: 'const a = 2;', old_no: null, new_no: 2 },
      { kind: ' ', text: 'export default foo;', old_no: 3, new_no: 3 },
    ];

    const splitRows = buildSplitRows(lines);
    expect(splitRows.length).toBe(3);
    expect(splitRows[0]?.left.kind).toBe('ctx');
    expect(splitRows[1]?.left.kind).toBe('del');
    expect(splitRows[1]?.right.kind).toBe('add');
    expect(splitRows[1]?.left.segments).toBeDefined();
    expect(splitRows[2]?.left.kind).toBe('ctx');
  });

  it('enriches unified lines with intra-line word diffs', () => {
    const lines = [
      { kind: '-', text: 'let oldVal = 10;', old_no: 1, new_no: null },
      { kind: '+', text: 'let newVal = 10;', old_no: null, new_no: 1 },
      { kind: ' ', text: 'return oldVal;', old_no: 2, new_no: 2 },
    ];

    const enriched = enrichUnifiedLines(lines);
    expect(enriched.length).toBe(3);
    expect(enriched[0]?.segments).toBeDefined();
    expect(enriched[1]?.segments).toBeDefined();
  });

  it('calculates diff stats correctly', () => {
    const hunks = [
      {
        header: '@@ -1,3 +1,3 @@',
        lines: [
          { kind: ' ', text: 'a', old_no: 1, new_no: 1 },
          { kind: '-', text: 'b', old_no: 2, new_no: null },
          { kind: '+', text: 'c', old_no: null, new_no: 2 },
          { kind: '+', text: 'd', old_no: null, new_no: 3 },
        ],
      },
    ];

    const stats = calculateDiffStats(hunks);
    expect(stats).toEqual({ additions: 2, deletions: 1 });
  });
});
