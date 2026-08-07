<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';

  import FileTree from '$lib/components/FileTree.svelte';
  import EditorPane from '$lib/components/EditorPane.svelte';
  import GitPanel from '$lib/components/GitPanel.svelte';
  import WelcomeView from '$lib/components/WelcomeView.svelte';
  import { openWorkspace, workspace } from '$lib/state.svelte';

  let loadError = $state<string | null>(null);
  let selectedFile = $state<string | null>(null);

  let workspacePath = $derived(page.url.searchParams.get('path'));

  onMount(() => {
    if (workspacePath) {
      void openWorkspace(workspacePath).catch((e) => {
        loadError = typeof e === 'string' ? e : JSON.stringify(e);
      });
    }
  });
</script>

{#if workspacePath}
  <div class="app">
    <aside class="sidebar">
      {#if loadError}
        <div class="load-error">{loadError}</div>
      {:else}
        <FileTree root={workspace.root} onFileClick={(p) => (selectedFile = p)} />
      {/if}
    </aside>
    <main class="editor"><EditorPane filePath={selectedFile} /></main>
    <aside class="git"><GitPanel /></aside>
  </div>
{:else}
  <WelcomeView />
{/if}

<style>
  .app {
    display: grid;
    grid-template-columns: 240px 1fr 280px;
    height: 100vh;
    overflow: hidden;
  }
  .sidebar {
    border-right: 1px solid var(--border);
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .editor {
    min-width: 0;
    overflow: hidden;
  }
  .git {
    min-width: 0;
  }
  .load-error {
    padding: 12px;
    color: var(--danger);
    font-size: 12px;
    word-break: break-all;
  }
</style>
