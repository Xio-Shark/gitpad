<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import type { Tab } from '$lib/state.svelte';
  import { fsReadFile, fsWriteFile, isAppError, MAX_TEXT_SIZE } from '$lib/api';
  import { setTabContent } from '$lib/state.svelte';
  import { createTextEditorView, type TextEditorHandle } from './text-editor';

  let props = $props<{ tab: Tab }>();
  let container = $state<HTMLDivElement | null>(null);

  let handle: TextEditorHandle | null = null;
  let saving = $state(false);
  let error = $state<string | null>(null);
  let loading = $state(true);
  let status = $state({ line: 1, col: 1, chars: 0 });

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
      toast.success('已保存');
    } catch (e) {
      error = isAppError(e) ? e.message : String(e);
      toast.error(`保存失败：${error}`);
    } finally {
      saving = false;
    }
  }

  // 容器就绪（loading/error 之后）才初始化 CM6；卸载时销毁
  $effect(() => {
    if (!container || loading || error) return;
    handle = createTextEditorView(container, props.tab.content ?? '', props.tab.path, {
      onDocChange: (text) => setTabContent(props.tab.id, text, true),
      onSave: save,
      onStatusChange: (s) => (status = s),
    });
    status = { line: 1, col: 1, chars: props.tab.content?.length ?? 0 };
    return () => {
      handle?.destroy();
      handle = null;
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
    <div class="statusbar">
      <span class="status-item">第 {status.line} 行，第 {status.col} 列</span>
      <span class="spacer"></span>
      <span class="status-item">{status.chars.toLocaleString()} 字符</span>
      <span class="status-item enc">{props.tab.encoding.toUpperCase()}</span>
      {#if saving}<span class="status-item saving">保存中…</span>{/if}
    </div>
  {/if}
</div>

<style>
  .text-renderer {
    height: 100%;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--surface-app);
  }
  .cm-host {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .msg {
    padding: 24px;
    color: var(--text-secondary);
    font-size: 13px;
    text-align: center;
  }
  .msg.error {
    color: var(--danger);
  }
  .statusbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 2px 12px;
    height: 22px;
    font-size: 11px;
    color: var(--text-secondary);
    background: var(--surface-panel);
    border-top: 1px solid var(--border-subtle);
    user-select: none;
    font-family: var(--font-ui);
  }
  .status-item {
    display: inline-flex;
    align-items: center;
  }
  .spacer {
    flex: 1;
  }
  .statusbar .enc {
    color: var(--text-primary);
    opacity: 0.8;
    font-family: var(--font-code);
  }
  .statusbar .saving {
    color: var(--accent);
  }
</style>
