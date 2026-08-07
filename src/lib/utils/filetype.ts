/** 文件类型分类：格式分发（M6 插件扩展点） */

export type RendererKind = 'text' | 'image' | 'csv' | 'pdf' | 'unknown';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'avif']);

/** 文本类扩展名（无论是否有高亮包，都可作为文本打开） */
const TEXT_EXTS = new Set([
  'txt', 'log', 'md', 'markdown', 'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx', 'css', 'scss', 'less', 'html', 'htm',
  'xml', 'svg',
  'rs', 'py', 'java', 'go', 'c', 'h', 'cpp', 'cc', 'hpp', 'cs', 'php', 'rb', 'sh', 'bash',
  'sql', 'swift', 'kt', 'kts', 'dart', 'vue', 'svelte', 'lua', 'pl', 'r', 'scala', 'clj',
]);

export function classify(path: string): RendererKind {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === '') return 'text';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'csv') return 'csv';
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (TEXT_EXTS.has(ext)) return 'text';
  return 'unknown';
}
