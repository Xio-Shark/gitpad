import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

/** 搜索高亮回调：渲染页面文本层时，给匹配项 span 加类 */
export const SEARCH_HIT_CLASS = 'search-hit';

export interface PageRender {
  canvas: HTMLCanvasElement;
  textLayerDiv: HTMLDivElement;
  cancel(): void;
}

export class PdfDocument {
  private doc: PDFDocumentProxy;
  private loadingTask: pdfjsLib.PDFDocumentLoadingTask;
  private pageTexts = new Map<number, string>();

  private constructor(doc: PDFDocumentProxy, loadingTask: pdfjsLib.PDFDocumentLoadingTask) {
    this.doc = doc;
    this.loadingTask = loadingTask;
  }

  static async open(url: string): Promise<PdfDocument> {
    const loadingTask = pdfjsLib.getDocument({ url, cMapUrl: '/pdfjs/cmaps/', cMapPacked: true });
    const doc = await loadingTask.promise;
    return new PdfDocument(doc, loadingTask);
  }

  get numPages(): number {
    return this.doc.numPages;
  }

  /** scale=1 时的页面尺寸（用于"适应宽度"换算） */
  async pageSizeAtScale1(pageNum: number): Promise<{ width: number; height: number }> {
    const page = await this.doc.getPage(pageNum);
    const vp = page.getViewport({ scale: 1 });
    page.cleanup();
    return { width: vp.width, height: vp.height };
  }

  destroy(): void {
    void this.loadingTask.destroy();
  }

  /** 按给定缩放渲染一页到容器；返回 canvas 与 textLayer 及取消函数 */
  async renderPage(pageNum: number, scale: number, container: HTMLElement): Promise<PageRender> {
    const page = await this.doc.getPage(pageNum);
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale * dpr });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${viewport.width / dpr}px`;
    canvas.style.height = `${viewport.height / dpr}px`;
    canvas.style.display = 'block';

    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.width = `${viewport.width / dpr}px`;
    textLayerDiv.style.height = `${viewport.height / dpr}px`;

    const ctx = canvas.getContext('2d', { alpha: false })!;
    let cancelled = false;
    const renderTask = page.render({ canvas, viewport });

    const done = renderTask.promise.catch((e) => {
      if (!cancelled) throw e;
    });

    const textContent = await page.getTextContent();
    if (cancelled) {
      renderTask.cancel();
    } else {
      try {
        await new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport,
        }).render();
      } catch (e) {
        // 文本层失败不影响页面渲染
      }
    }

    container.innerHTML = '';
    container.appendChild(canvas);
    container.appendChild(textLayerDiv);

    await done;
    page.cleanup();

    return {
      canvas,
      textLayerDiv,
      cancel() {
        cancelled = true;
        renderTask.cancel();
      },
    };
  }

  /** 获取页面纯文本（缓存） */
  async pageText(pageNum: number): Promise<string> {
    const cached = this.pageTexts.get(pageNum);
    if (cached !== undefined) return cached;
    const page = await this.doc.getPage(pageNum);
    const tc: TextContent = await page.getTextContent();
    const text = tc.items
      .map((item) => (item as TextItem).str ?? '')
      .join(' ');
    this.pageTexts.set(pageNum, text);
    return text;
  }

  /** 全局搜索：返回跨页匹配位置列表（页码从 1 起） */
  async searchAll(query: string, onProgress?: (done: number, total: number) => void): Promise<SearchHit[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];
    for (let i = 1; i <= this.doc.numPages; i++) {
      onProgress?.(i, this.doc.numPages);
      const text = await this.pageText(i);
      const lower = text.toLowerCase();
      let idx = lower.indexOf(q);
      while (idx !== -1) {
        hits.push({ page: i, index: idx, length: q.length });
        idx = lower.indexOf(q, idx + q.length);
      }
    }
    return hits;
  }
}

export interface SearchHit {
  page: number;
  index: number;
  length: number;
}

/** 在 textLayer 中高亮当前页匹配项（按文本归一化后定位） */
export function highlightMatches(textLayerDiv: HTMLElement, query: string): number {
  textLayerDiv.querySelectorAll(`.${SEARCH_HIT_CLASS}`).forEach((el) => {
    el.classList.remove(SEARCH_HIT_CLASS);
  });
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  let count = 0;
  const spans = textLayerDiv.querySelectorAll('span');
  for (const span of spans) {
    const text = (span.textContent ?? '').toLowerCase();
    if (text.includes(q)) {
      span.classList.add(SEARCH_HIT_CLASS);
      count++;
    }
  }
  return count;
}
