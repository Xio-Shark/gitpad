<script lang="ts">
  import type { DiffFile } from '$lib/git';
  import { buildSplitRows, enrichUnifiedLines, calculateDiffStats } from '$lib/utils/diff-compute';

  interface HunkSelection {
    selected: boolean[];
    onToggle: (i: number) => void;
  }

  let props = $props<{
    files: DiffFile[];
    readonly?: boolean;
    selection?: HunkSelection;
    viewMode?: 'split' | 'unified';
  }>();

  const mode = $derived(props.viewMode ?? 'unified');

  function fileLineClass(f: DiffFile): string {
    if (f.is_new) return 'badge-new';
    if (f.is_deleted) return 'badge-del';
    return 'badge-mod';
  }

  function badgeText(f: DiffFile): string {
    if (f.is_new) return '新增';
    if (f.is_deleted) return '删除';
    return '修改';
  }
</script>

<div class="diff-view">
  {#each props.files as file (file.path)}
    {@const stats = calculateDiffStats(file.hunks)}
    <div class="file-block">
      <div class="file-header">
        <span class="badge {fileLineClass(file)}">{badgeText(file)}</span>
        <span class="file-path" title={file.path}>{file.path}</span>
        <div class="file-stats">
          {#if stats.additions > 0}
            <span class="stat-add">+{stats.additions}</span>
          {/if}
          {#if stats.deletions > 0}
            <span class="stat-del">-{stats.deletions}</span>
          {/if}
        </div>
      </div>

      {#if file.is_binary}
        <div class="empty-note">二进制文件（暂不支持展示内容差异）</div>
      {:else if file.hunks.length === 0}
        <div class="empty-note">文件无内容差异</div>
      {:else}
        {#each file.hunks as hunk, hunkIdx (hunk.header)}
          <div class="hunk-block">
            <div class="hunk-header">
              {#if !props.readonly && props.selection}
                <label class="hunk-check" title="勾选以暂存/撤销此区块">
                  <input
                    type="checkbox"
                    checked={props.selection.selected[hunkIdx] ?? false}
                    onchange={() => props.selection!.onToggle(hunkIdx)}
                  />
                  <span>区块 #{hunkIdx + 1}</span>
                </label>
              {/if}
              <span class="hunk-text">{hunk.header.trim()}</span>
            </div>

            {#if mode === 'split'}
              {@const splitRows = buildSplitRows(hunk.lines)}
              <div class="split-table selectable-text diff-content">
                {#each splitRows as row, rIdx (rIdx)}
                  <div class="split-row">
                    <!-- Left side (Old) -->
                    <div class="split-cell left {row.left.kind}">
                      <span class="ln">{row.left.lineNo ?? ''}</span>
                      <span class="txt">
                        {#if row.left.segments}
                          {#each row.left.segments as seg, sIdx (sIdx)}
                            <span class:word-diff={seg.changed}>{seg.text}</span>
                          {/each}
                        {:else}
                          {row.left.text}
                        {/if}
                      </span>
                    </div>
                    <!-- Right side (New) -->
                    <div class="split-cell right {row.right.kind}">
                      <span class="ln">{row.right.lineNo ?? ''}</span>
                      <span class="txt">
                        {#if row.right.segments}
                          {#each row.right.segments as seg, sIdx (sIdx)}
                            <span class:word-diff={seg.changed}>{seg.text}</span>
                          {/each}
                        {:else}
                          {row.right.text}
                        {/if}
                      </span>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              {@const unifiedLines = enrichUnifiedLines(hunk.lines)}
              <div class="hunk-lines selectable-text diff-content">
                {#each unifiedLines as item, li (li)}
                  {@const line = item.line}
                  {@const kind = line.kind === '+' ? 'add' : line.kind === '-' ? 'del' : 'ctx'}
                  <div class="dline {kind}">
                    <span class="ln old-ln">{line.old_no ?? ''}</span>
                    <span class="ln new-ln">{line.new_no ?? ''}</span>
                    <span class="sign">{line.kind === '+' ? '+' : line.kind === '-' ? '-' : ' '}</span>
                    <span class="txt">
                      {#if item.segments}
                        {#each item.segments as seg, sIdx (sIdx)}
                          <span class:word-diff={seg.changed}>{seg.text}</span>
                        {/each}
                      {:else}
                        {line.text}
                      {/if}
                    </span>
                  </div>
                {/each}
              </div>
            {/if}
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
    font-size: 12px;
    line-height: 1.5;
    overflow: auto;
    max-height: 100%;
    flex: 1;
    background: var(--surface-app);
  }
  .file-block {
    margin: 8px 10px 16px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-popover);
    overflow: hidden;
    background: var(--surface-panel);
  }
  .file-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--surface-elevated);
    border-bottom: 1px solid var(--border-subtle);
    position: sticky;
    top: 0;
    z-index: 2;
  }
  .badge {
    font-size: 10.5px;
    padding: 1px 6px;
    border-radius: 3px;
    font-weight: 600;
    flex-shrink: 0;
    font-family: var(--font-ui);
  }
  .badge-new {
    background: color-mix(in srgb, var(--success) 16%, transparent);
    color: var(--success);
    border: 1px solid color-mix(in srgb, var(--success) 30%, transparent);
  }
  .badge-del {
    background: color-mix(in srgb, var(--danger) 16%, transparent);
    color: var(--danger);
    border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  }
  .badge-mod {
    background: color-mix(in srgb, var(--warning) 16%, transparent);
    color: var(--warning);
    border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent);
  }
  .file-path {
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-ui);
  }
  .file-stats {
    margin-left: auto;
    display: flex;
    gap: 6px;
    font-size: 11px;
    font-family: var(--font-code);
  }
  .stat-add {
    color: var(--success);
  }
  .stat-del {
    color: var(--danger);
  }
  .hunk-block {
    border-bottom: 1px solid var(--border-subtle);
  }
  .hunk-block:last-child {
    border-bottom: none;
  }
  .hunk-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 10px;
    background: color-mix(in srgb, var(--surface-app) 60%, transparent);
    border-bottom: 1px solid var(--border-subtle);
    font-size: 11px;
  }
  .hunk-check {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 11px;
    font-family: var(--font-ui);
  }
  .hunk-text {
    color: var(--text-secondary);
    font-family: var(--font-code);
    opacity: 0.8;
  }
  .hunk-lines {
    display: flex;
    flex-direction: column;
  }
  .dline {
    display: flex;
    align-items: baseline;
    min-height: 20px;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .dline .ln {
    width: 32px;
    flex-shrink: 0;
    text-align: right;
    padding-right: 6px;
    color: var(--text-secondary);
    opacity: 0.45;
    user-select: none;
    font-size: 11px;
  }
  .dline .sign {
    width: 14px;
    flex-shrink: 0;
    text-align: center;
    color: var(--text-secondary);
    user-select: none;
    opacity: 0.6;
    font-size: 11px;
  }
  .dline .txt {
    flex: 1;
    padding-left: 2px;
    color: var(--text-primary);
  }
  .dline.add {
    background: var(--diff-add-bg);
  }
  .dline.add .txt {
    color: var(--diff-add-text);
  }
  .dline.add .sign {
    color: var(--diff-add-text);
    opacity: 0.9;
  }
  .dline.del {
    background: var(--diff-del-bg);
  }
  .dline.del .txt {
    color: var(--diff-del-text);
  }
  .dline.del .sign {
    color: var(--diff-del-text);
    opacity: 0.9;
  }
  .dline.ctx .txt {
    color: var(--text-secondary);
  }
  .word-diff {
    border-radius: 2px;
    padding: 0 1px;
  }
  .dline.add .word-diff,
  .split-cell.add .word-diff {
    background: var(--diff-add-word);
    text-decoration: none;
  }
  .dline.del .word-diff,
  .split-cell.del .word-diff {
    background: var(--diff-del-word);
  }

  /* Split side-by-side view */
  .split-table {
    display: flex;
    flex-direction: column;
  }
  .split-row {
    display: flex;
    min-height: 20px;
  }
  .split-cell {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .split-cell.left {
    border-right: 1px solid var(--border-subtle);
  }
  .split-cell .ln {
    width: 32px;
    flex-shrink: 0;
    text-align: right;
    padding-right: 6px;
    color: var(--text-secondary);
    opacity: 0.45;
    user-select: none;
    font-size: 11px;
  }
  .split-cell .txt {
    flex: 1;
    padding-left: 4px;
    color: var(--text-primary);
  }
  .split-cell.del {
    background: var(--diff-del-bg);
  }
  .split-cell.del .txt {
    color: var(--diff-del-text);
  }
  .split-cell.add {
    background: var(--diff-add-bg);
  }
  .split-cell.add .txt {
    color: var(--diff-add-text);
  }
  .split-cell.empty {
    background: color-mix(in srgb, var(--surface-app) 30%, transparent);
    user-select: none;
  }
  .split-cell.ctx .txt {
    color: var(--text-secondary);
  }

  .empty-note {
    padding: 16px 12px;
    color: var(--text-secondary);
    font-size: 12px;
    text-align: center;
    font-family: var(--font-ui);
  }
</style>
