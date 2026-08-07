<script lang="ts">
  let props = $props<{
    title: string;
    initial?: string;
    placeholder?: string;
    onOk: (value: string) => void;
    onCancel: () => void;
  }>();

  let value = $state('');
  let error = $state<string | null>(null);
  let focusEl = $state<HTMLInputElement | null>(null);

  $effect(() => {
    value = props.initial ?? '';
  });

  $effect(() => {
    focusEl?.focus();
    focusEl?.select();
  });

  function submit() {
    const v = value.trim();
    if (!v) {
      error = '名称不能为空';
      return;
    }
    if (v.includes('/') || v.includes('\\')) {
      error = '名称不能包含斜杠';
      return;
    }
    props.onOk(v);
  }
</script>

<div
  class="dialog-mask"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) props.onCancel();
  }}
  onkeydown={(e) => {
    if (e.key === 'Escape') props.onCancel();
  }}
>
  <div class="dialog" role="dialog" aria-label={props.title}>
    <div class="dialog-title">{props.title}</div>
    <input
      class="dialog-input"
      value={value}
      placeholder={props.placeholder}
      oninput={(e) => (value = (e.currentTarget as HTMLInputElement).value)}
      onkeydown={(e) => {
        if (e.key === 'Enter') submit();
      }}
      bind:this={focusEl}
    />
    {#if error}
      <div class="dialog-error">{error}</div>
    {/if}
    <div class="dialog-actions">
      <button onclick={() => props.onCancel()}>取消</button>
      <button class="primary" onclick={() => submit()}>确定</button>
    </div>
  </div>
</div>

<style>
  .dialog-mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 18vh;
    z-index: 100;
  }
  .dialog {
    width: 320px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 16px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  }
  .dialog-title {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 10px;
  }
  .dialog-input {
    width: 100%;
    box-sizing: border-box;
    font-size: 13px;
    padding: 6px 8px;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 4px;
  }
  .dialog-input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .dialog-error {
    color: var(--danger);
    font-size: 11px;
    margin-top: 6px;
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }
  .dialog-actions button {
    font-size: 12px;
    padding: 4px 14px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
  }
  .dialog-actions button.primary {
    background: var(--accent);
    color: var(--text-on-accent);
    border: none;
  }
</style>
