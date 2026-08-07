import { convertFileSrc } from '@tauri-apps/api/core';

export interface Appearance {
  /** 字体族（留空 = 默认 Maple Mono） */
  fontFamily: string;
  /** 全局字号 px */
  fontSize: number;
  /** 背景色（十六进制） */
  bgColor: string;
  /** 背景图片绝对路径（留空 = 无） */
  bgImage: string;
  /** 背景图淡化：容器透明度 0.2-1（越小图越清楚），仅 bgImage 非空时生效 */
  bgOpacity: number;
}

export interface Settings {
  showHidden: boolean;
  showNodeModules: boolean;
  appearance: Appearance;
}

const DEFAULTS: Settings = {
  showHidden: false,
  showNodeModules: false,
  appearance: {
    fontFamily: '',
    fontSize: 16,
    bgColor: '#1e1e1e',
    bgImage: '',
    bgOpacity: 0.85,
  },
};

const STORAGE_KEY = 'gitpad-settings';

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return {
      showHidden: parsed.showHidden ?? DEFAULTS.showHidden,
      showNodeModules: parsed.showNodeModules ?? DEFAULTS.showNodeModules,
      appearance: {
        fontFamily: parsed.appearance?.fontFamily ?? '',
        fontSize: parsed.appearance?.fontSize ?? 16,
        bgColor: parsed.appearance?.bgColor ?? '#1e1e1e',
        bgImage: parsed.appearance?.bgImage ?? '',
        bgOpacity: parsed.appearance?.bgOpacity ?? 0.85,
      },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const settings = $state<Settings>(load());

$effect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
});

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(30, 30, 30, ${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** 把外观设置应用到 CSS 变量与 body（$effect 自动随设置变化调用） */
export function applyAppearance(): void {
  const a = settings.appearance;
  const root = document.documentElement.style;
  const family = a.fontFamily.trim() || "'Maple Mono NF', 'Maple Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
  root.setProperty('--ui-font-family', family);
  root.setProperty('--font-mono', family);
  root.setProperty('--ui-font-size', `${a.fontSize}px`);
  root.setProperty('--bg', a.bgColor);
  const hasImage = a.bgImage.trim() !== '';
  const alpha = hasImage ? Math.min(1, Math.max(0.2, a.bgOpacity)) : 1;
  root.setProperty('--bg-alpha', hexToRgba(a.bgColor, alpha));
  document.body.style.backgroundImage = hasImage ? `url(${convertFileSrc(a.bgImage)})` : 'none';
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundPosition = 'center';
  document.body.style.backgroundAttachment = 'fixed';
}
