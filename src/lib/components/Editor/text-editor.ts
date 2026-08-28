import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, foldGutter, foldKeymap } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { langLoaderFor } from './cm6';

export interface TextEditorCallbacks {
  /** 文档变更（撤销/重做/输入）时回调 */
  onDocChange: (text: string) => void;
  /** Cmd+S 触发保存 */
  onSave: (text: string) => Promise<void>;
  /** 光标/文档变化时回调（状态栏用） */
  onStatusChange?: (s: { line: number; col: number; chars: number }) => void;
}

export interface TextEditorHandle {
  view: EditorView;
  destroy(): void;
}

/** 组装 CM6 编辑器（TextRenderer / MarkdownRenderer 共用） */
export function createTextEditorView(
  container: HTMLElement,
  doc: string,
  path: string,
  cb: TextEditorCallbacks
): TextEditorHandle {
  const langCompartment = new Compartment();

  const state = EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      foldGutter(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      highlightSelectionMatches(),
      autocompletion(),
      keymap.of([
        {
          key: 'Mod-s',
          run: () => {
            void cb.onSave(view.state.doc.toString());
            return true;
          },
        },
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        ...foldKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      langCompartment.of([]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          cb.onDocChange(update.state.doc.toString());
        }
        if (update.selectionSet || update.docChanged) {
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head);
          cb.onStatusChange?.({ line: line.number, col: head - line.from + 1, chars: update.state.doc.length });
        }
      }),
      EditorView.theme({
        '&': { height: '100%', fontSize: 'var(--font-size-code, 13px)', backgroundColor: 'transparent' },
        '.cm-scroller': { fontFamily: 'var(--font-code, var(--font-mono))', lineHeight: '1.65' },
        '.cm-content': { userSelect: 'text', padding: '8px 0' },
        '.cm-gutters': {
          backgroundColor: 'transparent',
          color: 'var(--text-disabled)',
          borderRight: '1px solid var(--border-subtle)',
          paddingRight: '6px',
        },
        '.cm-activeLine': {
          backgroundColor: 'var(--surface-hover)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'transparent',
          color: 'var(--text-primary)',
          fontWeight: '500',
        },
        '&.cm-focused': { outline: 'none' },
      }),
    ],
  });

  const view = new EditorView({ state, parent: container });

  // 语言高亮懒加载（不阻塞打开）
  const loader = langLoaderFor(path);
  if (loader) {
    void loader().then((lang) => {
      view.dispatch({ effects: langCompartment.reconfigure(lang) });
    });
  }

  return {
    view,
    destroy() {
      view.destroy();
    },
  };
}
