<script lang="ts">
  import { settings, applyAppearance } from '$lib/settings.svelte';
  import { pickImage } from '$lib/api';

  let props = $props<{ onClose: () => void }>();

  const FONT_PRESETS = [
    { label: 'Maple Mono（默认）', value: '' },
    { label: 'PingFang SC（苹方）', value: "'PingFang SC', sans-serif" },
    { label: 'Menlo', value: 'Menlo, monospace' },
    { label: 'Source Code Pro', value: "'Source Code Pro', monospace" },
    { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  ];

  // 外观生效由 $effect(applyAppearance) 触发，这里只需操作 settings
  $effect(() => {
    applyAppearance();
  });

  let busy = $state(false);
  let imgError = $state<string | null>(null);

  async function chooseImage() {
    busy = true;
    imgError = null;
    try {
      const path = await pickImage();
      if (path) {
        settings.appearance.bgImage = path;
      }
    } catch (e) {
      imgError = typeof e === 'string' ? e : String(e);
    } finally {
      busy = false;
    }
  }

  function changeFontSize(delta: number) {
    settings.appearance.fontSize = Math.min(26, Math.max(10, settings.appearance.fontSize + delta));
  }

  function imgName(path: string): string {
    return path.split('/').pop() ?? path;
  }
</script>

<div class="mask" role="presentation" onclick={() => props.onClose()}>
  <div class="panel" role="dialog" aria-label="外观设置" tabindex="0" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
    <div class="title">外观设置</div>

    <div class="field">
      <label for="f-font">字体样式</label>
      <div class="presets">
        {#each FONT_PRESETS as p (p.value)}
          <button
            class="chip"
            class:active={settings.appearance.fontFamily === p.value}
            style="font-family: {p.value || 'inherit'}"
            onclick={() => (settings.appearance.fontFamily = p.value)}
          >{p.label}</button>
        {/each}
      </div>
      <input
        id="f-font"
        class="text-input"
        placeholder="自定义字体名，如 Maple Mono NF / Menlo / 宋体"
        value={settings.appearance.fontFamily}
        oninput={(e) => (settings.appearance.fontFamily = (e.currentTarget as HTMLInputElement).value)}
      />
    </div>

    <div class="field">
      <label for="f-size-minus">字号</label>
      <div class="font-size-row">
        <button id="f-size-minus" onclick={() => changeFontSize(-1)}>−</button>
        <span class="font-size-val">{settings.appearance.fontSize}px</span>
        <button onclick={() => changeFontSize(1)}>+</button>
      </div>
    </div>

    <div class="field">
      <label for="f-color">背景颜色</label>
      <div class="color-row">
        <input
          id="f-color"
          type="color"
          value={settings.appearance.bgColor}
          oninput={(e) => (settings.appearance.bgColor = (e.currentTarget as HTMLInputElement).value)}
        />
        <input
          class="text-input"
          value={settings.appearance.bgColor}
          oninput={(e) => (settings.appearance.bgColor = (e.currentTarget as HTMLInputElement).value)}
        />
      </div>
    </div>

    <div class="field">
      <label for="f-img">背景图片</label>
      <div class="img-row">
        <button id="f-img" onclick={() => void chooseImage()} disabled={busy}>{busy ? '选择中…' : '选择图片…'}</button>
        {#if settings.appearance.bgImage}
          <span class="img-name" title={settings.appearance.bgImage}>{imgName(settings.appearance.bgImage)}</span>
          <button class="danger" onclick={() => (settings.appearance.bgImage = '')}>移除</button>
        {:else}
          <span class="img-name muted">未设置</span>
        {/if}
      </div>
      {#if settings.appearance.bgImage}
        <div class="opacity-row">
          <span>淡化</span>
          <input
            id="f-opacity"
            type="range"
            min="0.2"
            max="1"
            step="0.05"
            value={settings.appearance.bgOpacity}
            oninput={(e) => (settings.appearance.bgOpacity = Number((e.currentTarget as HTMLInputElement).value))}
          />
          <span class="img-name muted">{Math.round(settings.appearance.bgOpacity * 100)}%</span>
        </div>
      {/if}
      {#if imgError}
        <div class="error">{imgError}</div>
      {/if}
    </div>

    <div class="actions">
      <button class="primary" onclick={() => props.onClose()}>完成</button>
    </div>
  </div>
</div>

<style>
  .mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 96;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 12vh;
  }
  .panel {
    width: 420px;
    max-width: 92vw;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 18px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55);
    max-height: 80vh;
    overflow-y: auto;
  }
  .title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 14px;
  }
  .field {
    margin-bottom: 14px;
  }
  .field label {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
  }
  .chip {
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
  }
  .chip.active {
    background: var(--accent);
    color: var(--text-on-accent);
    border-color: var(--accent);
  }
  .text-input {
    width: 100%;
    box-sizing: border-box;
    font-size: 13px;
    padding: 5px 8px;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 4px;
  }
  .font-size-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .font-size-row button,
  .img-row button {
    font-size: 13px;
    padding: 3px 12px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
  }
  .font-size-val {
    font-size: 14px;
    min-width: 48px;
    text-align: center;
  }
  .color-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .color-row input[type='color'] {
    width: 44px;
    height: 30px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg);
    padding: 2px;
    cursor: pointer;
  }
  .img-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .img-name {
    font-size: 12px;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 180px;
  }
  .img-name.muted {
    color: var(--text-secondary);
  }
  .img-row button.danger {
    color: var(--danger);
  }
  .opacity-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .opacity-row input[type='range'] {
    flex: 1;
  }
  .error {
    color: var(--danger);
    font-size: 11px;
    margin-top: 6px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 6px;
  }
  .actions button {
    font-size: 13px;
    padding: 5px 22px;
    border-radius: 4px;
    border: none;
    background: var(--accent);
    color: var(--text-on-accent);
    cursor: pointer;
  }
</style>
