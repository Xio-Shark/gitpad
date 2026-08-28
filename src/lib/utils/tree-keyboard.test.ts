import { describe, expect, it } from 'vitest';
import { flattenVisibleTree, handleTreeKey, type TreeKeyboardNode } from './tree-keyboard';

const sample: TreeKeyboardNode = {
  path: '/root',
  isDir: true,
  expanded: true,
  children: [
    {
      path: '/root/a',
      isDir: true,
      expanded: false,
      children: [{ path: '/root/a/x.ts', isDir: false, expanded: false, children: [] }],
    },
    { path: '/root/b.ts', isDir: false, expanded: false, children: [] },
  ],
};

describe('tree keyboard', () => {
  it('flattens only expanded directories', () => {
    const rows = flattenVisibleTree(sample);
    expect(rows.map((r) => r.path)).toEqual(['/root', '/root/a', '/root/b.ts']);
  });

  it('navigates with arrows and expands/collapses dirs', () => {
    const rows = flattenVisibleTree(sample);
    expect(handleTreeKey('ArrowDown', '/root', rows)).toEqual({ type: 'focus', path: '/root/a' });
    expect(handleTreeKey('ArrowRight', '/root/a', rows)).toEqual({ type: 'expand', path: '/root/a' });
    expect(handleTreeKey('Enter', '/root/b.ts', rows)).toEqual({ type: 'activate', path: '/root/b.ts' });
    expect(handleTreeKey('Home', '/root/b.ts', rows)).toEqual({ type: 'focus', path: '/root' });
  });
});
