<script lang="ts">
  import { onMount } from 'svelte';
  import { Toaster } from 'svelte-sonner';
  import './app.css';
  import { applyAppearance, settings } from '$lib/settings.svelte';

  let { children } = $props();

  onMount(() => {
    applyAppearance();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => {
      if (settings.appearance.theme === 'system') applyAppearance();
    };
    mq.addEventListener('change', onScheme);
    return () => mq.removeEventListener('change', onScheme);
  });
</script>

{@render children()}
<Toaster position="bottom-right" richColors={false} closeButton theme={settings.appearance.theme === 'light' ? 'light' : 'dark'} />
