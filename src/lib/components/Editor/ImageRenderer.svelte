<script lang="ts">
  import { convertFileSrc } from '@tauri-apps/api/core';
  import type { Tab } from '$lib/state.svelte';

  let props = $props<{ tab: Tab }>();

  let fit = $state(true);
  let loadFailed = $state(false);

  let src = $derived(convertFileSrc(props.tab.path));
</script>

<div class="image-renderer">
  <div class="toolbar">
    <button class:active={fit} onclick={() => (fit = true)}>适应窗口</button>
    <button class:active={!fit} onclick={() => (fit = false)}>原始尺寸</button>
  </div>
  <div class="canvas" class:fit onscroll={() => {}}>
    {#if loadFailed}
      <div class="msg error">图片加载失败或文件已损坏</div>
    {:else}
      <img
        src={src}
        alt={props.tab.name}
        onerror={() => (loadFailed = true)}
        onload={() => (loadFailed = false)}
        class:fit-img={fit}
      />
    {/if}
  </div>
</div>

<style>
  .image-renderer {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #101010;
  }
  .toolbar {
    display: flex;
    gap: 6px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .toolbar button {
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
  }
  .toolbar button.active {
    background: var(--accent);
    color: var(--text-on-accent);
  }
  .canvas {
    flex: 1;
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
  }
  .canvas.fit {
    align-items: center;
    justify-content: center;
  }
  img {
    max-width: none;
  }
  .fit-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .msg.error {
    color: var(--danger);
    font-size: 13px;
  }
</style>
