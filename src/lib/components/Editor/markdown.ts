import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/common';
import katex from 'katex';
import { convertFileSrc } from '@tauri-apps/api/core';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark-dimmed.css';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMath(content: string, displayMode: boolean): string {
  try {
    return katex.renderToString(content, { throwOnError: false, displayMode });
  } catch {
    return `<pre>${escapeHtml(content)}</pre>`;
  }
}

/** 行内 $...$：$ 后不能是数字/空白/美元，避免误伤价格文本 */
function inlineMath(state: import('markdown-it').StateInline, silent: boolean): boolean {
  const src = state.src;
  const start = state.pos;
  if (src.charCodeAt(start) !== 0x24) return false; // $
  const next = src[start + 1];
  if (next === undefined || next === '$' || next === ' ' || next === '\t' || /\d/.test(next)) return false;

  let end = -1;
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '$' && src[i - 1] !== '\\' && src[i + 1] !== '$') {
      end = i;
      break;
    }
  }
  if (end === -1) return false;
  const content = src.slice(start + 1, end);
  if (!content.trim()) return false;

  if (silent) {
    state.pos = end + 1;
    return true;
  }
  const token = state.push('html_inline', '', 0);
  token.content = renderMath(content, false);
  state.pos = end + 1;
  return true;
}

/** 块级 $$...$$：支持单行（$$x$$）与独立闭合行（$$ \n ... \n $$） */
function blockMath(state: import('markdown-it').StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const pos = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  if (state.src.charCodeAt(pos) !== 0x24 || state.src.charCodeAt(pos + 1) !== 0x24) return false;

  const line = state.src.slice(pos, max);
  const single = /^\$\$(.+?)\$\$$/.exec(line);
  if (single && single[1].trim()) {
    if (silent) return true;
    const token = state.push('html_block', '', 0);
    token.content = renderMath(single[1].trim(), true);
    state.line = startLine + 1;
    return true;
  }

  // 多行形式：找以 $$ 结束的独立行
  const contentLines: string[] = [];
  let nextLine = startLine + 1;
  let closed = false;
  for (; nextLine < endLine; nextLine++) {
    const p = state.bMarks[nextLine] + state.tShift[nextLine];
    const e = state.eMarks[nextLine];
    const l = state.src.slice(p, e);
    if (l.trim() === '$$') {
      closed = true;
      break;
    }
    contentLines.push(l);
  }
  if (!closed) return false;
  if (!contentLines.some((l) => l.trim())) return false;

  if (silent) return true;
  const token = state.push('html_block', '', 0);
  token.content = renderMath(contentLines.join('\n').trim(), true);
  state.line = nextLine + 1;
  return true;
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  highlight(code: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch {
        return '';
      }
    }
    return '';
  },
});
md.inline.ruler.before('escape', 'math_inline', inlineMath);
md.block.ruler.before('paragraph', 'math_block', blockMath);

/**
 * 相对路径图片（./img.png、img.png）转 asset URL，绝对路径与网络路径原样保留。
 * 只处理 markdown 语法 `](...)`，HTML <img> 不处理（MVP）。
 */
function rewriteImages(src: string, tabPath: string): string {
  if (!tabPath) return src;
  const dir = tabPath.replace(/[^/\\]+$/, '');
  if (!dir) return src;
  return src.replace(/(\]\()([^)\s"'<>]+)/g, (m, prefix: string, raw: string) => {
    const p = raw.replace(/^\.\//, '');
    if (/^(https?:|asset:|file:|\/)/i.test(p)) return m;
    const decoded = decodeURIComponent(p);
    if (decoded.includes('..')) return m;
    return prefix + convertFileSrc(dir + decoded);
  });
}

/** Markdown 源 → HTML 片段（同步） */
export function compileMarkdown(src: string, tabPath: string): string {
  return md.render(rewriteImages(src, tabPath));
}

/** 预览容器内渲染 mermaid 图表（懒加载引擎，按需执行） */
let mermaidModule: Promise<typeof import('mermaid')> | null = null;

export async function renderMermaid(host: HTMLElement): Promise<void> {
  const blocks = host.querySelectorAll('pre code.language-mermaid');
  if (blocks.length === 0) return;
  if (!mermaidModule) mermaidModule = import('mermaid');
  const mermaid = await mermaidModule;
  mermaid.default.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
  for (const block of blocks) {
    const pre = block.closest('pre');
    if (!pre) continue;
    const src = block.textContent ?? '';
    if (!src.trim()) continue;
    const uid = `mmd-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const { svg } = await mermaid.default.render(uid, src);
      pre.outerHTML = svg;
    } catch {
      // 渲染失败保留源码块
    }
  }
}
