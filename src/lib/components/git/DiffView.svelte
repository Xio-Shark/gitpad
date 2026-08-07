<script lang="ts">
  import type { DiffFile } from '$lib/git';

  interface HunkSelection {
    selected: boolean[];
    onToggle: (i: number) => void;
  }

  let props = $props<{
    files: DiffFile[];
    readonly?: boolean;
    selection?: HunkSelection;
  }>();

  function fileLineClass(f: DiffFile): string {
    if (f.is_new) return 'badge-new';
    if (f.is_deleted) return 'badge-del';
    return 'badge-mod';
  }

  function badgeText(f: DiffFile): string {
    if (f.is_new) return 'A';
    if (f.is_deleted) return 'D';
    return 'M';
  }
</script>

<div class="diff-view">
  {#each props.files as file (file.path)}
    <div class="file-block">
      <div class="file-header">
        <span class="badge {fileLineClass(file)}">{badgeText(file)}</span>
        <span class="file-path" title={file.path}>{file.path}</span>
      </div>
      {#if file.is_binary}
        <div class="binary-note">二进制文件（不显示 diff）</div>
      {:else if file.hunks.length === 0}
        <div class="empty-note">无内容差异</div>
      {:else}
        {#each file.hunks as hunk, i (hunk.header)}
          <div class="hunk-block">
            <div class="hunk-header">
              {#if !props.readonly && props.selection}
                <label class="hunk-check">
                  <input
                    type="checkbox"
                    checked={props.selection.selected[i] ?? false}
                    onchange={() => props.selection!.onToggle(i)}
                  />
                </label>
              {/if}
              <span class="hunk-text">{hunk.header.trim()}</span>
            </div>
            <div class="hunk-lines">
              {#each hunk.lines as line, li (li)}
                {@const kind = line.kind === '+' ? 'add' : line.kind === '-' ? 'del' : 'ctx'}
                {@const ln = line.kind === '+' ? line.new_no : line.old_no}
                <div class="dline {kind}">
                  <span class="ln">{ln ?? ''}</span>
                  <span class="txt">{line.text}</span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {:else}
    <div class="empty-note">没有变更</div>
  {/each}
</div>

<style>
  .diff-view {
    font-family: var(--font-mono);
    font-size: var(--ui-font-size, 14px);
    line-height: 1.45;
    overflow: auto;
    max-height: 100%;
  }
  .file-block {
    margin-bottom: 10px;
  }
  .file-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px 4px 0 0;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .badge {
    font-size: 10px;
    padding: 0 5px;
    border-radius: 3px;
    font-weight: 600;
    flex-shrink: 0;
  }
  .badge-new {
    background: rgba(74, 174, 107, 0.25);
    color: #4aae6b;
  }
  .badge-del {
    background: rgba(248, 81, 73, 0.25);
    color: #f85149;
  }
  .badge-mod {
    background: rgba(210, 153, 34, 0.25);
    color: #d29922;
  }
  .file-path {
    font-size: 12px;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hunk-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    background: rgba(110, 118, 129, 0.1);
    border-bottom: 1px solid var(--border);
  }
  .hunk-text {
    color: var(--text-secondary);
    font-size: 11px;
  }
  .hunk-check {
    display: flex;
    align-items: center;
    cursor: pointer;
  }
  .hunk-lines {
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  .dline {
    display: flex;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .dline .ln {
    width: 34px;
    flex-shrink: 0;
    text-align: right;
    padding-right: 6px;
    color: var(--text-secondary);
    opacity: 0.6;
    user-select: none;
    font-size: 11px;
  }
  .dline .txt {
    flex: 1;
    padding-left: 4px;
  }
  .dline.add .txt {
    background: rgba(46, 160, 67, 0.18);
    color: #7ee787;
  }
  .dline.del .txt {
    background: rgba(248, 81, 73, 0.16);
    color: #ffa198;
  }
  .dline.ctx .txt {
    color: var(--text-secondary);
  }
  .binary-note,
  .empty-note {
    padding: 8px;
    color: var(--text-secondary);
    font-size: 12px;
    border: 1px solid var(--border);
    border-top: none;
  }
</style>
