<script lang="ts">
  import { onMount } from 'svelte';
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

  let handle: TextEditorHandle | null = null;
  let compileTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(async () => {
    error = null;
    try {
      if (props.tab.content === null) {
        const content = await fsReadFile(props.tab.path);
        setTabContent(props.tab.id, content, false);
      }
    } catch (e) {
      if (isAppError(e) && e.code === 'file_too_large') {
        error = `文件过大（超过 ${MAX_TEXT_SIZE / 1024 / 1024}MB），建议使用外部工具打开`;
      } else if (isAppError(e) && e.code === 'encoding_not_supported') {
        error = '文件编码不支持（仅支持 UTF-8）';
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
      await fsWriteFile(props.tab.path, text);
      setTabContent(props.tab.id, text, false);
    } catch (e) {
      error = isAppError(e) ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  // 容器就绪后挂载 CM6；卸载时销毁
  $effect(() => {
    if (!container || loading || error) return;
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
    }, 250);
  });

  // 预览 HTML 更新后渲染 mermaid（{#html} 插入 DOM 需要下一帧）
  $effect(() => {
    const host = previewHost;
    if (!host) return;
    void renderMermaid(host);
  });
</script>

<div class="md-renderer">
  {#if loading}
    <div class="msg">加载中…</div>
  {:else if error}
    <div class="msg error">
      {error}
      {#if saving}<span class="saving">保存中…</span>{/if}
    </div>
  {:else}
    <div class="md-body">
      {#if props.tab.preview}
        <div class="preview-host markdown-body" bind:this={previewHost}>
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- 本地 markdown 渲染预览（设计决策：不 sanitize，见 M3 design.md） -->
          {@html previewHtml}
        </div>
      {:else}
        <div class="cm-host" bind:this={container}></div>
      {/if}
    </div>
    {#if saving}
      <div class="save-indicator">保存中…</div>
    {/if}
  {/if}
</div>

<style>
  .md-renderer {
    height: 100%;
    position: relative;
    overflow: hidden;
  }
  .md-body {
    display: flex;
    height: 100%;
  }
  .cm-host {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }
  .preview-host {
    flex: 1;
    min-width: 0;
    overflow: auto;
    padding: 16px 20px;
    user-select: text;
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
