<script lang="ts">
  import { fade } from 'svelte/transition';
  import { Switch, Slider } from 'bits-ui';
  import Sun from 'lucide-svelte/icons/sun';
  import Moon from 'lucide-svelte/icons/moon';
  import Laptop from 'lucide-svelte/icons/laptop';
  import Palette from 'lucide-svelte/icons/palette';
  import FolderTree from 'lucide-svelte/icons/folder-tree';
  import RotateCcw from 'lucide-svelte/icons/rotate-ccw';
  import X from 'lucide-svelte/icons/x';
  import Image from 'lucide-svelte/icons/image';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import {
    settings,
    applyAppearance,
    setContentBgColor,
    setTheme,
    resolvedTheme,
  } from '$lib/settings.svelte';
  import { pickImage } from '$lib/api';
  import { isSafeContentBackground } from '$lib/utils/contrast';
  import type { ThemePreference } from '$lib/utils/settings-migrate';

  let props = $props<{ onClose: () => void }>();

  const UI_FONT_PRESETS = [
    { label: '系统默认', value: '' },
    { label: 'Inter (推荐)', value: "'Inter', sans-serif" },
    { label: 'PingFang SC', value: "'PingFang SC', sans-serif" },
    { label: 'SF Pro', value: "-apple-system, BlinkMacSystemFont, sans-serif" },
  ];

  const EDITOR_FONT_PRESETS = [
    { label: 'Maple Mono (默认)', value: '' },
    { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
    { label: 'Geist Mono', value: "'Geist Mono', monospace" },
    { label: 'Fira Code', value: "'Fira Code', monospace" },
    { label: 'Menlo', value: "Menlo, monospace" },
    { label: 'Source Code Pro', value: "'Source Code Pro', monospace" },
  ];

  const THEME_OPTIONS = [
    { id: 'dark' as ThemePreference, label: '深色', icon: Moon },
    { id: 'light' as ThemePreference, label: '浅色', icon: Sun },
    { id: 'system' as ThemePreference, label: '跟随系统', icon: Laptop },
  ];

  const SECTIONS = [
    { id: 'appearance', label: '外观与排版', icon: Palette },
    { id: 'files', label: '文件树', icon: FolderTree },
  ] as const;

  let activeSection = $state<'appearance' | 'files'>('appearance');
  let bgError = $state<string | null>(null);
  let busy = $state(false);
  let imgError = $state<string | null>(null);

  $effect(() => {
    applyAppearance();
  });

  async function chooseImage() {
    busy = true;
    imgError = null;
    try {
      const path = await pickImage();
      if (path) settings.appearance.bgImage = path;
    } catch (e) {
      imgError = typeof e === 'string' ? e : String(e);
    } finally {
      busy = false;
    }
  }

  function removeImage() {
    settings.appearance.bgImage = '';
  }

  function changeUiFontSize(delta: number) {
    settings.appearance.uiFontSize = Math.min(20, Math.max(11, settings.appearance.uiFontSize + delta));
  }

  function changeEditorFontSize(delta: number) {
    settings.appearance.editorFontSize = Math.min(
      36,
      Math.max(10, settings.appearance.editorFontSize + delta)
    );
  }

  function onBgInput(raw: string) {
    bgError = null;
    const theme = resolvedTheme();
    if (!isSafeContentBackground(raw, theme)) {
      bgError = '对比度不足（须保证文字清晰易读）';
      return;
    }
    if (!setContentBgColor(raw)) {
      bgError = '无效的颜色格式';
    }
  }

  function resetBgColor() {
    bgError = null;
    const def = resolvedTheme() === 'dark' ? '#1e1e1e' : '#ffffff';
    setContentBgColor(def);
  }

  function imgName(path: string): string {
    return path.split('/').pop() ?? path;
  }

  const previewCodeFont = $derived(
    settings.appearance.editorFontFamily.trim() ||
      "'Maple Mono NF', 'Maple Mono', ui-monospace, Menlo, monospace"
  );
</script>

<div class="settings-page" transition:fade={{ duration: 120 }}>
  <!-- 顶栏导航 -->
  <header class="settings-head nav-surface">
    <div class="head-left">
      <h2 class="title">设置</h2>
      <span class="head-hint">按 Esc 或 ⌘W 快速返回</span>
    </div>
    <button
      class="close-btn"
      aria-label="关闭设置"
      title="关闭 (Esc / ⌘W)"
      onclick={() => props.onClose()}
    >
      <X size={15} strokeWidth={1.5} />
    </button>
  </header>

  <div class="settings-body">
    <!-- 左侧分类 -->
    <nav class="sidebar nav-surface" aria-label="设置分类">
      {#each SECTIONS as s (s.id)}
        <button
          class="nav-tab"
          class:active={activeSection === s.id}
          aria-current={activeSection === s.id ? 'true' : undefined}
          onclick={() => (activeSection = s.id)}
        >
          <s.icon size={15} strokeWidth={1.5} class="nav-icon" />
          <span>{s.label}</span>
        </button>
      {/each}
    </nav>

    <!-- 右侧内容面板 -->
    <main class="content-scroll">
      <div class="settings-container">
        {#key activeSection}
          {#if activeSection === 'appearance'}
            <div class="section-flow" transition:fade={{ duration: 100 }}>
              <!-- 模块：主题模式 -->
              <section class="group">
                <h3 class="group-title">主题模式</h3>
                <div class="card">
                  <div class="card-row">
                    <div class="row-info">
                      <span class="row-label">界面主题</span>
                      <span class="row-desc">选择明亮、深色或随 macOS 系统自动切换</span>
                    </div>
                    <div class="segmented-control" role="radiogroup" aria-label="界面主题">
                      {#each THEME_OPTIONS as t (t.id)}
                        <button
                          class="segment"
                          class:active={settings.appearance.theme === t.id}
                          role="radio"
                          aria-checked={settings.appearance.theme === t.id}
                          onclick={() => setTheme(t.id)}
                        >
                          <t.icon size={13} strokeWidth={1.5} />
                          <span>{t.label}</span>
                        </button>
                      {/each}
                    </div>
                  </div>
                </div>
              </section>

              <!-- 模块：排版与字体 -->
              <section class="group">
                <h3 class="group-title">排版与字体</h3>
                <div class="card">
                  <!-- 界面字体 -->
                  <div class="card-row card-row-col">
                    <div class="row-info">
                      <span class="row-label">界面字体</span>
                      <span class="row-desc">用于应用菜单、标签栏与文件树（留空使用系统字体）</span>
                    </div>
                    <div class="font-control-stack">
                      <input
                        class="text-input"
                        placeholder="自定义字体族，如 'PingFang SC', Inter, sans-serif"
                        value={settings.appearance.uiFontFamily}
                        oninput={(e) =>
                          (settings.appearance.uiFontFamily = (e.currentTarget as HTMLInputElement).value)}
                      />
                      <div class="preset-pills" role="group" aria-label="界面字体预设">
                        {#each UI_FONT_PRESETS as p (p.value)}
                          <button
                            class="pill"
                            class:active={settings.appearance.uiFontFamily === p.value}
                            onclick={() => (settings.appearance.uiFontFamily = p.value)}
                          >
                            {p.label}
                          </button>
                        {/each}
                      </div>
                    </div>
                  </div>

                  <!-- 界面字号 -->
                  <div class="card-row">
                    <div class="row-info">
                      <span class="row-label">界面字号</span>
                      <span class="row-desc">整体界面缩放尺寸（11px ~ 20px）</span>
                    </div>
                    <div class="stepper-slider">
                      <Slider.Root
                        class="sp-slider"
                        type="single"
                        value={settings.appearance.uiFontSize}
                        onValueChange={(v) => (settings.appearance.uiFontSize = v)}
                        min={11}
                        max={20}
                        step={1}
                        aria-label="界面字号"
                      >
                        <span class="sp-slider-track">
                          <Slider.Range class="sp-slider-range" />
                        </span>
                        <Slider.Thumb index={0} class="sp-slider-thumb" />
                      </Slider.Root>
                      <div class="size-badge">
                        <button class="step-btn" title="缩小" onclick={() => changeUiFontSize(-1)}>−</button>
                        <span class="size-num">{settings.appearance.uiFontSize}px</span>
                        <button class="step-btn" title="放大" onclick={() => changeUiFontSize(1)}>+</button>
                      </div>
                    </div>
                  </div>

                  <!-- 代码字体 -->
                  <div class="card-row card-row-col">
                    <div class="row-info">
                      <span class="row-label">编辑器字体</span>
                      <span class="row-desc">编辑区、Markdown 与 Git Diff 视图所用等宽字体</span>
                    </div>
                    <div class="font-control-stack">
                      <input
                        class="text-input mono-input"
                        placeholder="自定义等宽字体，如 'JetBrains Mono', 'Fira Code', Menlo"
                        value={settings.appearance.editorFontFamily}
                        oninput={(e) =>
                          (settings.appearance.editorFontFamily = (e.currentTarget as HTMLInputElement).value)}
                      />
                      <div class="preset-pills" role="group" aria-label="代码字体预设">
                        {#each EDITOR_FONT_PRESETS as p (p.value)}
                          <button
                            class="pill"
                            class:active={settings.appearance.editorFontFamily === p.value}
                            onclick={() => (settings.appearance.editorFontFamily = p.value)}
                          >
                            {p.label}
                          </button>
                        {/each}
                      </div>
                    </div>
                  </div>

                  <!-- 代码字号 -->
                  <div class="card-row">
                    <div class="row-info">
                      <span class="row-label">代码字号</span>
                      <span class="row-desc">编辑器代码及行号文本大小（10px ~ 36px）</span>
                    </div>
                    <div class="stepper-slider">
                      <Slider.Root
                        class="sp-slider"
                        type="single"
                        value={settings.appearance.editorFontSize}
                        onValueChange={(v) => (settings.appearance.editorFontSize = v)}
                        min={10}
                        max={36}
                        step={1}
                        aria-label="代码字号"
                      >
                        <span class="sp-slider-track">
                          <Slider.Range class="sp-slider-range" />
                        </span>
                        <Slider.Thumb index={0} class="sp-slider-thumb" />
                      </Slider.Root>
                      <div class="size-badge">
                        <button class="step-btn" title="缩小" onclick={() => changeEditorFontSize(-1)}>−</button>
                        <span class="size-num">{settings.appearance.editorFontSize}px</span>
                        <button class="step-btn" title="放大" onclick={() => changeEditorFontSize(1)}>+</button>
                      </div>
                    </div>
                  </div>

                  <!-- 实时代码样本预览 -->
                  <div class="sample-box">
                    <div class="sample-title">实时排版预览</div>
                    <div
                      class="sample-strip"
                      style="font-family: {previewCodeFont}; font-size: {settings.appearance.editorFontSize}px;"
                    >
                      <span class="token-kw">function</span> <span class="token-fn">initWorkspace</span>(<span class="token-arg">id</span>: <span class="token-type">string</span>) &#123; <span class="token-str">"GitPad"</span>; <span class="token-comm">// 0123456789 &lt;=&gt; === !==</span> &#125;
                    </div>
                  </div>
                </div>
              </section>

              <!-- 模块：编辑区画布与背景 -->
              <section class="group">
                <h3 class="group-title">编辑区画布</h3>
                <div class="card">
                  <!-- 背景颜色 -->
                  <div class="card-row">
                    <div class="row-info">
                      <span class="row-label">画布背景色</span>
                      <span class="row-desc">中栏编辑区底色，须与字体保持清晰对比度</span>
                    </div>
                    <div class="color-stack">
                      <div class="color-picker-unit">
                        <div
                          class="color-preview"
                          style="background-color: {settings.appearance.contentBgColor}"
                        >
                          <input
                            type="color"
                            class="native-color-picker"
                            value={settings.appearance.contentBgColor}
                            oninput={(e) => onBgInput((e.currentTarget as HTMLInputElement).value)}
                            title="选择颜色"
                          />
                        </div>
                        <input
                          class="hex-input"
                          value={settings.appearance.contentBgColor}
                          onchange={(e) => onBgInput((e.currentTarget as HTMLInputElement).value)}
                        />
                        <button
                          class="icon-action-btn"
                          title="重置为当前主题默认背景"
                          onclick={resetBgColor}
                        >
                          <RotateCcw size={13} strokeWidth={1.5} />
                        </button>
                      </div>
                      {#if bgError}
                        <span class="error-msg">{bgError}</span>
                      {/if}
                    </div>
                  </div>

                  <!-- 背景图片 -->
                  <div class="card-row card-row-col">
                    <div class="row-info">
                      <span class="row-label">背景壁纸</span>
                      <span class="row-desc">选择自定义图片作为窗口背景并调节透明度</span>
                    </div>
                    <div class="wallpaper-stack">
                      <div class="wallpaper-actions">
                        <button
                          class="btn-secondary"
                          onclick={() => void chooseImage()}
                          disabled={busy}
                        >
                          <Image size={14} strokeWidth={1.5} />
                          <span>{busy ? '加载中…' : settings.appearance.bgImage ? '更换图片' : '选择图片'}</span>
                        </button>
                        {#if settings.appearance.bgImage}
                          <span class="file-name" title={settings.appearance.bgImage}>
                            {imgName(settings.appearance.bgImage)}
                          </span>
                          <button
                            class="icon-action-btn danger"
                            title="清除背景图片"
                            onclick={removeImage}
                          >
                            <Trash2 size={13} strokeWidth={1.5} />
                          </button>
                        {/if}
                      </div>

                      {#if settings.appearance.bgImage}
                        <div class="wallpaper-opacity">
                          <span class="opacity-label">不透明度</span>
                          <Slider.Root
                            class="sp-slider"
                            type="single"
                            value={settings.appearance.bgOpacity}
                            onValueChange={(v) => (settings.appearance.bgOpacity = v)}
                            min={0.2}
                            max={1}
                            step={0.05}
                            aria-label="背景不透明度"
                          >
                            <span class="sp-slider-track">
                              <Slider.Range class="sp-slider-range" />
                            </span>
                            <Slider.Thumb index={0} class="sp-slider-thumb" />
                          </Slider.Root>
                          <span class="opacity-val">{Math.round(settings.appearance.bgOpacity * 100)}%</span>
                        </div>
                      {/if}
                      {#if imgError}
                        <span class="error-msg">{imgError}</span>
                      {/if}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          {:else}
            <!-- 模块：文件树配置 -->
            <div class="section-flow" transition:fade={{ duration: 100 }}>
              <section class="group">
                <h3 class="group-title">文件树显示</h3>
                <div class="card">
                  <div class="card-row">
                    <div class="row-info">
                      <span class="row-label" id="lbl-hidden">显示隐藏文件</span>
                      <span class="row-desc">在文件树中展示以「.」开头的点文件（如 .gitignore）</span>
                    </div>
                    <Switch.Root
                      class="sp-switch"
                      checked={settings.showHidden}
                      onCheckedChange={(c) => (settings.showHidden = c)}
                      aria-labelledby="lbl-hidden"
                    >
                      <Switch.Thumb class="sp-switch-thumb" />
                    </Switch.Root>
                  </div>

                  <div class="card-row">
                    <div class="row-info">
                      <span class="row-label" id="lbl-nm">显示 node_modules</span>
                      <span class="row-desc">在文件树中展开并显示项目依赖目录</span>
                    </div>
                    <Switch.Root
                      class="sp-switch"
                      checked={settings.showNodeModules}
                      onCheckedChange={(c) => (settings.showNodeModules = c)}
                      aria-labelledby="lbl-nm"
                    >
                      <Switch.Thumb class="sp-switch-thumb" />
                    </Switch.Root>
                  </div>
                </div>
              </section>
            </div>
          {/if}
        {/key}
      </div>
    </main>
  </div>
</div>

<style>
  .settings-page {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--surface-app);
    color: var(--text-primary);
    user-select: none;
  }

  /* 顶栏 */
  .settings-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-app);
    flex-shrink: 0;
  }
  .head-left {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .title {
    font-size: 15px;
    font-weight: 600;
    margin: 0;
    letter-spacing: -0.2px;
  }
  .head-hint {
    font-size: 11px;
    color: var(--text-secondary);
  }
  .close-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: var(--surface-panel);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .close-btn:hover {
    color: var(--text-primary);
    background: var(--surface-hover);
    border-color: var(--border-strong);
  }

  /* 主体双栏 */
  .settings-body {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  /* 侧栏导航 */
  .sidebar {
    width: 170px;
    flex-shrink: 0;
    border-right: 1px solid var(--border-subtle);
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    background: var(--surface-app);
  }
  .nav-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    font-size: 13px;
    border-radius: var(--radius-control);
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
  }
  .nav-tab:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }
  .nav-tab.active {
    background: var(--surface-panel);
    color: var(--text-primary);
    font-weight: 500;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  /* 内容区 */
  .content-scroll {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: 24px 32px 48px;
  }
  .settings-container {
    max-width: 640px;
  }
  .section-flow {
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  /* 分组与卡片 */
  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .group-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--text-secondary);
    margin: 0 0 2px 4px;
  }
  .card {
    background: var(--surface-panel);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    overflow: hidden;
  }
  .card-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 13px 16px;
    border-bottom: 1px solid var(--border-subtle);
    gap: 20px;
  }
  .card-row:last-child {
    border-bottom: none;
  }
  .card-row-col {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .row-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .row-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
  }
  .row-desc {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  /* macOS 分段控件 (Segmented Control) */
  .segmented-control {
    display: inline-flex;
    align-items: center;
    background: var(--surface-app);
    border: 1px solid var(--border-subtle);
    border-radius: 7px;
    padding: 2px;
    gap: 2px;
  }
  .segment {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    font-size: 12px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .segment:hover {
    color: var(--text-primary);
  }
  .segment.active {
    background: var(--surface-panel);
    color: var(--text-primary);
    font-weight: 500;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }

  /* 自由字体定制堆栈 */
  .font-control-stack {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .text-input {
    width: 100%;
    padding: 7px 10px;
    font-size: 13px;
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: var(--surface-app);
    color: var(--text-primary);
    outline: none;
    transition: border-color var(--transition-fast);
  }
  .text-input:focus {
    border-color: var(--focus-ring);
  }
  .mono-input {
    font-family: var(--font-code);
    font-size: 12px;
  }
  .preset-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .pill {
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--border-subtle);
    background: var(--surface-app);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .pill:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }
  .pill.active {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
    border-color: var(--accent);
    font-weight: 500;
  }

  /* 滑块与数值徽标一体化 */
  .stepper-slider {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 220px;
  }
  :global(.sp-slider) {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    height: 18px;
    touch-action: none;
    cursor: pointer;
  }
  :global(.sp-slider-track) {
    position: relative;
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--border-subtle);
  }
  :global(.sp-slider-range) {
    position: absolute;
    height: 100%;
    border-radius: 2px;
    background: var(--accent);
  }
  :global(.sp-slider-thumb) {
    display: block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    cursor: grab;
    transition: transform var(--transition-fast);
  }
  :global(.sp-slider-thumb:hover) {
    transform: scale(1.15);
  }
  .size-badge {
    display: inline-flex;
    align-items: center;
    background: var(--surface-app);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-control);
    padding: 1px;
  }
  .step-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    width: 20px;
    height: 22px;
    font-size: 13px;
    cursor: pointer;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .step-btn:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }
  .size-num {
    font-family: var(--font-code);
    font-size: 11px;
    font-weight: 500;
    min-width: 36px;
    text-align: center;
    color: var(--text-primary);
  }

  /* 极简实时代码排版预览 */
  .sample-box {
    padding: 10px 16px 14px;
    background: color-mix(in srgb, var(--surface-app) 70%, transparent);
    border-top: 1px solid var(--border-subtle);
  }
  .sample-title {
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 6px;
    letter-spacing: 0.2px;
  }
  .sample-strip {
    padding: 8px 12px;
    border-radius: var(--radius-control);
    background: var(--surface-app);
    border: 1px solid var(--border-subtle);
    white-space: nowrap;
    overflow-x: auto;
    line-height: 1.5;
  }
  .token-kw { color: #f43f5e; font-weight: 500; }
  .token-fn { color: #38bdf8; }
  .token-arg { color: #fbbf24; }
  .token-type { color: #34d399; }
  .token-str { color: #a78bfa; }
  .token-comm { color: var(--text-secondary); opacity: 0.7; }

  /* 颜色控件 */
  .color-stack {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .color-picker-unit {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .color-preview {
    position: relative;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid var(--border-subtle);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    cursor: pointer;
  }
  .native-color-picker {
    position: absolute;
    inset: -6px;
    opacity: 0;
    cursor: pointer;
    width: 36px;
    height: 36px;
  }
  .hex-input {
    width: 84px;
    padding: 5px 8px;
    font-family: var(--font-code);
    font-size: 12px;
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: var(--surface-app);
    color: var(--text-primary);
    text-transform: uppercase;
  }
  .icon-action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: var(--surface-app);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .icon-action-btn:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }
  .icon-action-btn.danger:hover {
    color: var(--danger);
    border-color: var(--danger);
  }
  .error-msg {
    font-size: 11px;
    color: var(--danger);
  }

  /* 壁纸控制 */
  .wallpaper-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .wallpaper-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    font-size: 12px;
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: var(--surface-app);
    color: var(--text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .btn-secondary:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--border-strong);
  }
  .file-name {
    font-size: 12px;
    color: var(--text-secondary);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .wallpaper-opacity {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 4px;
  }
  .opacity-label {
    font-size: 12px;
    color: var(--text-secondary);
    min-width: 50px;
  }
  .opacity-val {
    font-family: var(--font-code);
    font-size: 11px;
    color: var(--text-secondary);
    min-width: 36px;
    text-align: right;
  }

  /* Bits UI Switch */
  :global(.sp-switch) {
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: var(--border-strong);
    position: relative;
    cursor: pointer;
    border: none;
    transition: background var(--transition-fast);
    padding: 2px;
  }
  :global(.sp-switch[data-state='checked']) {
    background: var(--accent);
  }
  :global(.sp-switch-thumb) {
    display: block;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    transition: transform var(--transition-fast);
    transform: translateX(0);
  }
  :global(.sp-switch[data-state='checked'] .sp-switch-thumb) {
    transform: translateX(16px);
  }
</style>
