import FileText from 'lucide-svelte/icons/file-text';
import FileCode from 'lucide-svelte/icons/file-code';
import FileJson from 'lucide-svelte/icons/file-json';
import Table from 'lucide-svelte/icons/table';
import ImageIcon from 'lucide-svelte/icons/image';
import FileType from 'lucide-svelte/icons/file-type';
import FileArchive from 'lucide-svelte/icons/file-archive';
import Settings from 'lucide-svelte/icons/settings';
import File from 'lucide-svelte/icons/file';
import Folder from 'lucide-svelte/icons/folder';
import FolderOpen from 'lucide-svelte/icons/folder-open';
import Database from 'lucide-svelte/icons/database';

export function getFileIcon(filename: string, isDir = false, isExpanded = false) {
  if (isDir) {
    return isExpanded ? FolderOpen : Folder;
  }

  const lower = filename.toLowerCase();

  // Special config/dotfiles
  if (
    lower.startsWith('.git') ||
    lower.endsWith('.lock') ||
    lower.includes('config') ||
    lower.startsWith('.env') ||
    lower.includes('rc')
  ) {
    return Settings;
  }

  const ext = lower.split('.').pop() ?? '';

  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'svelte':
    case 'vue':
    case 'rs':
    case 'go':
    case 'py':
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
    case 'java':
    case 'php':
    case 'sh':
    case 'zsh':
    case 'bash':
    case 'css':
    case 'scss':
    case 'html':
      return FileCode;

    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'xml':
      return FileJson;

    case 'sql':
    case 'sqlite':
    case 'db':
      return Database;

    case 'csv':
    case 'tsv':
      return Table;

    case 'md':
    case 'markdown':
    case 'txt':
    case 'log':
    case 'rst':
      return FileText;

    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'ico':
    case 'bmp':
      return ImageIcon;

    case 'pdf':
      return FileType;

    case 'zip':
    case 'tar':
    case 'gz':
    case '7z':
    case 'rar':
      return FileArchive;

    default:
      return File;
  }
}
