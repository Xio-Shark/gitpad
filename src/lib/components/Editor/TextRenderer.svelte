<script lang="ts">
  import { onMount } from 'svelte';
  import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
  import { EditorState, Compartment } from '@codemirror/state';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
  import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
  import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
  import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
  import type { Tab } from '$lib/state.svelte';
  import { fsReadFile, fsWriteFile, isAppError, MAX_TEXT_SIZE } from '$lib/api';
  import { setTabContent } from '$lib/state.svelte';
  import { langLoaderFor } from './cm6';

  let props = $props<{ tab: Tab }>();
  let container = $state<HTMLDivElement | null>(null);

  let view: EditorView | null = null;
  let saving = $state(false);
  let error = $state<string | null>(null);
  let loading = $state(true);

  const langCompartment = new Compartment();

  onMount(async () => {
    loading = true;
    error = null;
    try {
      if (props.tab.content === null) {
        const content = await fsReadFile(props.tab.path);
        setTabContent(props.tab.id, content, false);
      }
      initEditor();
      loading = false;
    } catch (e) {
      loading = false;
      if (isAppError(e) && e.code === 'file_too_large') {
        error = `文件过大（超过 ${MAX_TEXT_SIZE / 1024 / 1024}MB），建议使用外部工具打开`;
      } else if (isAppError(e) && e.code === 'encoding_not_supported') {
        error = '文件编码不支持（仅支持 UTF-8）';
      } else {
        error = isAppError(e) ? e.message : String(e);
      }
    }
  });

  function initEditor(): void {
    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          void save();
          return true;
        },
      },
    ]);

    const state = EditorState.create({
      doc: props.tab.content ?? '',
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        highlightSelectionMatches(),
        autocompletion(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, ...completionKeymap, indentWithTab]),
        saveKeymap,
        langCompartment.of([]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setTabContent(props.tab.id, update.state.doc.toString(), true);
          }
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px' },
          '.cm-scroller': { fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace" },
          '&.cm-focused': { outline: 'none' },
        }),
      ],
    });

    if (!container) return;
    view = new EditorView({ state, parent: container });

    // 语言高亮懒加载（不阻塞打开）
    const loader = langLoaderFor(props.tab.path);
    if (loader) {
      void loader().then((lang) => {
        view?.dispatch({ effects: langCompartment.reconfigure(lang) });
      });
    }
  }

  async function save(): Promise<void> {
    if (!view || saving) return;
    saving = true;
    error = null;
    try {
      const content = view.state.doc.toString();
      await fsWriteFile(props.tab.path, content);
      setTabContent(props.tab.id, content, false);
    } catch (e) {
      error = isAppError(e) ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  $effect(() => {
    return () => {
      view?.destroy();
      view = null;
    };
  });
</script>

<div class="text-renderer">
  {#if loading}
    <div class="msg">加载中…</div>
  {:else if error}
    <div class="msg error">
      {error}
      {#if saving}<span class="saving">保存中…</span>{/if}
    </div>
  {:else}
    <div class="cm-host" bind:this={container}></div>
    {#if saving}
      <div class="save-indicator">保存中…</div>
    {/if}
  {/if}
</div>

<style>
  .text-renderer {
    height: 100%;
    position: relative;
    overflow: hidden;
  }
  .cm-host {
    height: 100%;
    overflow: hidden;
  }
  .msg {
    padding: 16px;
    color: var(--text-secondary);
    font-size: 13px;
  }
  .msg.error {
    color: var(--danger);
  }
  .save-indicator {
    position: absolute;
    bottom: 6px;
    right: 10px;
    font-size: 11px;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
  }
</style>
