import { describe, expect, it } from 'vitest';
import { revealPathInTree, type TreeNode } from '../state.svelte';

describe('revealPathInTree', () => {
  it('returns false if root is null or path outside root', async () => {
    expect(await revealPathInTree(null, '/foo/bar')).toBe(false);
    const root: TreeNode = {
      name: 'root',
      path: '/workspace',
      isDir: true,
      isSymlink: false,
      expanded: true,
      loaded: true,
      children: [],
    };
    expect(await revealPathInTree(root, '/other/path')).toBe(false);
  });

  it('expands intermediate directories to reveal nested file', async () => {
    const childFile: TreeNode = {
      name: 'nested.ts',
      path: '/workspace/src/nested.ts',
      isDir: false,
      isSymlink: false,
      expanded: false,
      loaded: true,
      children: [],
    };
    const dirNode: TreeNode = {
      name: 'src',
      path: '/workspace/src',
      isDir: true,
      isSymlink: false,
      expanded: false,
      loaded: true,
      children: [childFile],
    };
    const root: TreeNode = {
      name: 'workspace',
      path: '/workspace',
      isDir: true,
      isSymlink: false,
      expanded: true,
      loaded: true,
      children: [dirNode],
    };

    expect(dirNode.expanded).toBe(false);
    const success = await revealPathInTree(root, '/workspace/src/nested.ts');
    expect(success).toBe(true);
    expect(dirNode.expanded).toBe(true);
  });
});
