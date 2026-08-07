import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { langLoaderFor } from './cm6';

export interface TextEditorCallbacks {
  /** 文档变更（撤销/重做/输入）时回调 */
  onDocChange: (text: string) => void;
  /** Cmd+S 触发保存 */
  onSave: (text: string) => Promise<void>;
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
        ...completionKeymap,
        indentWithTab,
      ]),
      langCompartment.of([]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          cb.onDocChange(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        '&': { height: '100%', fontSize: 'var(--ui-font-size, 14px)', backgroundColor: 'transparent' },
        '.cm-scroller': { fontFamily: "var(--font-mono)" },
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
