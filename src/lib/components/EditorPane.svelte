<script lang="ts">
  import { activeTab } from '$lib/state.svelte';
  import { isMarkdown } from '$lib/utils/filetype';
  import TextRenderer from './Editor/TextRenderer.svelte';
  import MarkdownRenderer from './Editor/MarkdownRenderer.svelte';
  import ImageRenderer from './Editor/ImageRenderer.svelte';
  import CsvRenderer from './Editor/CsvRenderer.svelte';

  let tab = $derived(activeTab());
</script>

<div class="editor-pane">
  {#if !tab}
    <div class="placeholder">
      <div class="placeholder-title">GitPad</div>
      <div class="placeholder-note">从左侧文件树选择文件</div>
    </div>
  {:else}
    {#key tab.id}
      {#if tab.kind === 'image'}
        <ImageRenderer tab={tab} />
      {:else if tab.kind === 'csv'}
        <CsvRenderer tab={tab} />
      {:else if tab.kind === 'text' && isMarkdown(tab.path)}
        <MarkdownRenderer tab={tab} />
      {:else if tab.kind === 'text'}
        <TextRenderer tab={tab} />
      {:else if tab.kind === 'pdf'}
        <div class="placeholder">
          <div class="placeholder-title">PDF 预览</div>
          <div class="placeholder-note">将在 M4 实现</div>
        </div>
      {:else}
        <div class="placeholder">
          <div class="placeholder-title">不支持的格式</div>
          <div class="placeholder-note">{tab.name}</div>
        </div>
      {/if}
    {/key}
  {/if}
</div>

<style>
  .editor-pane {
    height: 100%;
    min-width: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--text-secondary);
  }
  .placeholder-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--text);
  }
  .placeholder-note {
    font-size: 12px;
  }
</style>
