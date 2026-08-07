<script lang="ts">
  let props = $props<{ filePath: string | null }>();
</script>

<div class="editor-pane">
  {#if props.filePath}
    <div class="placeholder">
      <div class="placeholder-title">文件已选中</div>
      <div class="placeholder-path">{props.filePath}</div>
      <div class="placeholder-note">编辑功能将在 M2 接入（CodeMirror）</div>
    </div>
  {:else}
    <div class="placeholder">
      <div class="placeholder-title">GitPad</div>
      <div class="placeholder-note">从左侧文件树选择文件</div>
    </div>
  {/if}
</div>

<style>
  .editor-pane {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }
  .placeholder {
    text-align: center;
    color: var(--text-secondary);
  }
  .placeholder-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--text);
  }
  .placeholder-path {
    font-size: 13px;
    font-family: var(--font-mono);
    word-break: break-all;
    max-width: 500px;
    margin-bottom: 8px;
  }
  .placeholder-note {
    font-size: 12px;
  }
</style>
