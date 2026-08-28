<script lang="ts">
  let props = $props<{
    title: string;
    initial?: string;
    placeholder?: string;
    onOk: (value: string) => void;
    onCancel: () => void;
  }>();

  function initialValue(): string {
    return props.initial ?? '';
  }
  let value = $state(initialValue());
  let error = $state<string | null>(null);
  let focusEl = $state<HTMLInputElement | null>(null);
  let dialogEl = $state<HTMLDivElement | null>(null);
  let previouslyFocused: Element | null = null;

  $effect(() => {
    previouslyFocused = document.activeElement;
    focusEl?.focus();
    focusEl?.select();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
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

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      props.onCancel();
      return;
    }
    if (e.key !== 'Tab' || !dialogEl) return;
    const focusables = dialogEl.querySelectorAll<HTMLElement>(
      'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const list = [...focusables];
    if (list.length === 0) return;
    const first = list[0]!;
    const last = list[list.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

<div
  class="dialog-mask"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) props.onCancel();
  }}
  onkeydown={onKeydown}
>
  <div
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-label={props.title}
    bind:this={dialogEl}
  >
    <div class="dialog-title" id="dialog-title">{props.title}</div>
    <input
      class="dialog-input"
      value={value}
      placeholder={props.placeholder}
      aria-labelledby="dialog-title"
      oninput={(e) => (value = (e.currentTarget as HTMLInputElement).value)}
      onkeydown={(e) => {
        if (e.key === 'Enter') submit();
      }}
      bind:this={focusEl}
    />
    {#if error}
      <div class="dialog-error" role="alert">{error}</div>
    {/if}
    <div class="dialog-actions">
      <button type="button" onclick={() => props.onCancel()}>取消</button>
      <button type="button" class="primary" onclick={() => submit()}>确定</button>
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
    background: var(--surface-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-popover);
    padding: 14px 16px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  }
  .dialog-title {
    font-size: var(--font-size-ui);
    font-weight: 600;
    margin-bottom: 10px;
  }
  .dialog-input {
    width: 100%;
    box-sizing: border-box;
    font-size: var(--font-size-ui);
    padding: 6px 8px;
    min-height: 32px;
    background: var(--surface-app);
    color: var(--text-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-control);
  }
  .dialog-input:focus {
    outline: none;
    border-color: var(--focus-ring);
  }
  .dialog-error {
    color: var(--danger);
    font-size: var(--font-size-meta);
    margin-top: 6px;
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }
  .dialog-actions button {
    font-size: var(--font-size-meta);
    padding: 0 14px;
    min-height: var(--control-md);
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: var(--surface-app);
    color: var(--text-primary);
    cursor: pointer;
  }
  .dialog-actions button.primary {
    background: var(--accent);
    color: var(--text-on-accent);
    border: none;
  }
</style>
