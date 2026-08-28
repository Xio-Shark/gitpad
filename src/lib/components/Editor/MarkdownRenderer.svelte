<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import Edit3 from 'lucide-svelte/icons/edit-3';
  import Columns from 'lucide-svelte/icons/columns';
  import Eye from 'lucide-svelte/icons/eye';
  import type { Tab } from '$lib/state.svelte';
  import { fsReadFile, fsWriteFile, isAppError, MAX_TEXT_SIZE } from '$lib/api';
  import { setTabContent } from '$lib/state.svelte';
  import { createTextEditorView, type TextEditorHandle } from './text-editor';
  import { compileMarkdown, renderMermaid } from './markdown';

  let props = $props<{ tab: Tab }>();

  let container = $state<HTMLDivElement | null>(null);
  let previewHost = $state<HTMLElement | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let saving = $state(false);
  let previewHtml = $state('');
  let viewMode = $state<'edit' | 'split' | 'preview'>('edit');

  $effect(() => {
    if (props.tab.preview !== undefined) {
      viewMode = props.tab.preview ? 'preview' : 'edit';
    }
  });

  let handle: TextEditorHandle | null = null;
  let compileTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(async () => {
    error = null;
    try {
      if (props.tab.content === null) {
        const res = await fsReadFile(props.tab.path);
        props.tab.encoding = res.encoding;
        setTabContent(props.tab.id, res.content, false);
      }
    } catch (e) {
      if (isAppError(e) && e.code === 'file_too_large') {
        error = `文件过大（超过 ${MAX_TEXT_SIZE / 1024 / 1024}MB），建议使用外部工具打开`;
      } else if (isAppError(e) && e.code === 'encoding_not_supported') {
        error = '文件编码不支持（仅支持 UTF-8 / GBK）';
      } else {
        error = isAppError(e) ? e.message : String(e);
      }
    } finally {
      loading = false;
    }
  });

  async function save(text: string): Promise<void> {
    if (saving) return;
    saving = true;
    error = null;
    try {
      await fsWriteFile(props.tab.path, text, props.tab.encoding);
      setTabContent(props.tab.id, text, false);
      toast.success('已保存文件');
    } catch (e) {
      error = isAppError(e) ? e.message : String(e);
      toast.error(`保存失败：${error}`);
    } finally {
      saving = false;
    }
  }

  // 容器就绪后挂载 CM6；卸载时销毁
  $effect(() => {
    if (!container || loading || error || viewMode === 'preview') return;
    handle = createTextEditorView(container, props.tab.content ?? '', props.tab.path, {
      onDocChange: (text) => setTabContent(props.tab.id, text, true),
      onSave: save,
    });
    return () => {
      handle?.destroy();
      handle = null;
    };
  });

  // 内容变化 → 防抖编译预览
  $effect(() => {
    const content = props.tab.content;
    if (content === null) return;
    if (compileTimer) clearTimeout(compileTimer);
    compileTimer = setTimeout(() => {
      previewHtml = compileMarkdown(content, props.tab.path);
    }, 150);
  });

  // 预览 HTML 更新后渲染 mermaid
  $effect(() => {
    const host = previewHost;
    if (!host || viewMode === 'edit') return;
    void renderMermaid(host);
  });
</script>

<div class="md-renderer">
  <div class="md-toolbar">
    <span class="file-path">{props.tab.name}</span>
    <div class="mode-toggles">
      <button
        class="toggle-btn"
        class:active={viewMode === 'edit'}
        title="纯编辑模式"
        onclick={() => (viewMode = 'edit')}
      >
        <Edit3 size={12} strokeWidth={1.75} aria-hidden="true" />
        <span>编辑</span>
      </button>
      <button
        class="toggle-btn"
        class:active={viewMode === 'split'}
        title="双栏对照预览"
        onclick={() => (viewMode = 'split')}
      >
        <Columns size={12} strokeWidth={1.75} aria-hidden="true" />
        <span>双栏</span>
      </button>
      <button
        class="toggle-btn"
        class:active={viewMode === 'preview'}
        title="纯预览模式"
        onclick={() => (viewMode = 'preview')}
      >
        <Eye size={12} strokeWidth={1.75} aria-hidden="true" />
        <span>预览</span>
      </button>
    </div>
  </div>

  {#if loading}
    <div class="msg">加载中…</div>
  {:else if error}
    <div class="msg error">{error}</div>
  {:else}
    <div class="md-body" class:split-mode={viewMode === 'split'}>
      {#if viewMode === 'edit' || viewMode === 'split'}
        <div class="cm-host" bind:this={container}></div>
      {/if}
      {#if viewMode === 'split'}
        <div class="split-divider"></div>
      {/if}
      {#if viewMode === 'preview' || viewMode === 'split'}
        <div class="preview-host markdown-body" bind:this={previewHost}>
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html previewHtml}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .md-renderer {
    height: 100%;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--surface-app);
  }
  .md-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 12px;
    background: var(--surface-panel);
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }
  .file-path {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }
  .mode-toggles {
    display: flex;
    background: var(--surface-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-control);
    padding: 2px;
    gap: 2px;
  }
  .toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    font-size: 11px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    border-radius: 3px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .toggle-btn:hover {
    color: var(--text-primary);
  }
  .toggle-btn.active {
    background: var(--surface-panel);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }
  .md-body {
    flex: 1;
    min-height: 0;
    display: flex;
    position: relative;
  }
  .cm-host {
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow: hidden;
  }
  .split-divider {
    width: 1px;
    background: var(--border-subtle);
    flex-shrink: 0;
  }
  .preview-host {
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow-y: auto;
    padding: 16px 24px;
    user-select: text;
    background: var(--surface-panel);
  }
  .msg {
    padding: 20px;
    color: var(--text-secondary);
    font-size: 13px;
    text-align: center;
  }
  .msg.error {
    color: var(--danger);
  }
</style>
