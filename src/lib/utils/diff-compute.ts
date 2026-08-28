import type { DiffLine, Hunk } from '$lib/git';

export interface DiffSegment {
  text: string;
  changed: boolean;
}

export interface SplitCell {
  lineNo: number | null;
  text: string;
  kind: 'add' | 'del' | 'ctx' | 'empty';
  segments?: DiffSegment[];
}

export interface SplitRow {
  left: SplitCell;
  right: SplitCell;
}

/**
 * Computes word-level diff segments between two strings (an old line and a new line).
 * Finds longest common prefix and suffix to highlight the changed middle words.
 */
export function computeWordDiff(
  oldStr: string,
  newStr: string
): { oldSegments: DiffSegment[]; newSegments: DiffSegment[] } {
  if (oldStr === newStr) {
    return {
      oldSegments: [{ text: oldStr, changed: false }],
      newSegments: [{ text: newStr, changed: false }],
    };
  }

  // Find common prefix
  let prefixLen = 0;
  const minLen = Math.min(oldStr.length, newStr.length);
  while (prefixLen < minLen && oldStr[prefixLen] === newStr[prefixLen]) {
    prefixLen++;
  }

  // Find common suffix (not overlapping prefix)
  let oldSuffixLen = 0;
  let newSuffixLen = 0;
  while (
    oldSuffixLen < oldStr.length - prefixLen &&
    newSuffixLen < newStr.length - prefixLen &&
    oldStr[oldStr.length - 1 - oldSuffixLen] === newStr[newStr.length - 1 - newSuffixLen]
  ) {
    oldSuffixLen++;
    newSuffixLen++;
  }

  const oldPrefix = oldStr.slice(0, prefixLen);
  const oldChanged = oldStr.slice(prefixLen, oldStr.length - oldSuffixLen);
  const oldSuffix = oldStr.slice(oldStr.length - oldSuffixLen);

  const newPrefix = newStr.slice(0, prefixLen);
  const newChanged = newStr.slice(prefixLen, newStr.length - newSuffixLen);
  const newSuffix = newStr.slice(newStr.length - newSuffixLen);

  const oldSegments: DiffSegment[] = [];
  if (oldPrefix) oldSegments.push({ text: oldPrefix, changed: false });
  if (oldChanged) oldSegments.push({ text: oldChanged, changed: true });
  if (oldSuffix) oldSegments.push({ text: oldSuffix, changed: false });

  const newSegments: DiffSegment[] = [];
  if (newPrefix) newSegments.push({ text: newPrefix, changed: false });
  if (newChanged) newSegments.push({ text: newChanged, changed: true });
  if (newSuffix) newSegments.push({ text: newSuffix, changed: false });

  return { oldSegments, newSegments };
}

/**
 * Builds side-by-side split rows from hunk lines, pairing deleted and added blocks.
 */
export function buildSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;

  while (i < lines.length) {
    const cur = lines[i]!;

    if (cur.kind !== '+' && cur.kind !== '-') {
      // Context line
      rows.push({
        left: { lineNo: cur.old_no, text: cur.text, kind: 'ctx' },
        right: { lineNo: cur.new_no, text: cur.text, kind: 'ctx' },
      });
      i++;
      continue;
    }

    // Collect consecutive '-' lines and consecutive '+' lines
    const delLines: DiffLine[] = [];
    const addLines: DiffLine[] = [];

    while (i < lines.length && lines[i]!.kind === '-') {
      delLines.push(lines[i]!);
      i++;
    }
    while (i < lines.length && lines[i]!.kind === '+') {
      addLines.push(lines[i]!);
      i++;
    }

    const maxCount = Math.max(delLines.length, addLines.length);

    for (let k = 0; k < maxCount; k++) {
      const del = delLines[k];
      const add = addLines[k];

      if (del && add) {
        // Paired line modification: compute intra-line word diff
        const { oldSegments, newSegments } = computeWordDiff(del.text, add.text);
        rows.push({
          left: { lineNo: del.old_no, text: del.text, kind: 'del', segments: oldSegments },
          right: { lineNo: add.new_no, text: add.text, kind: 'add', segments: newSegments },
        });
      } else if (del) {
        rows.push({
          left: { lineNo: del.old_no, text: del.text, kind: 'del' },
          right: { lineNo: null, text: '', kind: 'empty' },
        });
      } else if (add) {
        rows.push({
          left: { lineNo: null, text: '', kind: 'empty' },
          right: { lineNo: add.new_no, text: add.text, kind: 'add' },
        });
      }
    }
  }

  return rows;
}

/**
 * Computes intra-line segments for unified diff lines where single modifications occur.
 */
export function enrichUnifiedLines(lines: DiffLine[]): { line: DiffLine; segments?: DiffSegment[] }[] {
  const result: { line: DiffLine; segments?: DiffSegment[] }[] = [];
  let i = 0;

  while (i < lines.length) {
    const cur = lines[i]!;

    if (cur.kind === '-' && i + 1 < lines.length && lines[i + 1]!.kind === '+') {
      // 1-to-1 replaced line
      const next = lines[i + 1]!;
      const { oldSegments, newSegments } = computeWordDiff(cur.text, next.text);
      result.push({ line: cur, segments: oldSegments });
      result.push({ line: next, segments: newSegments });
      i += 2;
      continue;
    }

    result.push({ line: cur });
    i++;
  }

  return result;
}

/**
 * Calculate total additions and deletions for a hunk or file
 */
export function calculateDiffStats(hunks: Hunk[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.kind === '+') additions++;
      else if (line.kind === '-') deletions++;
    }
  }

  return { additions, deletions };
}
