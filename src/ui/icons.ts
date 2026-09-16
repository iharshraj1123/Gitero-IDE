import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  Search,
  GitBranch,
  Settings,
  X,
  Plus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Terminal,
  Sliders,
  Palette,
  Check,
  Code2,
  createIcons
} from 'lucide';

export function getFileIconSvg(fileName: string, isDirectory: boolean, isOpen: boolean = false): string {
  if (isDirectory) {
    return isOpen
      ? `<svg class="icon icon-folder" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>`
      : `<svg class="icon icon-folder" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
  }

  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // Specific file type colors and badges
  switch (ext) {
    case 'rs':
      return `<span class="icon-badge badge-rust">rs</span>`;
    case 'ts':
    case 'mts':
      return `<span class="icon-badge badge-ts">TS</span>`;
    case 'tsx':
      return `<span class="icon-badge badge-react">TSX</span>`;
    case 'jsx':
      return `<span class="icon-badge badge-react">JSX</span>`;
    case 'js':
    case 'mjs':
      return `<span class="icon-badge badge-js">JS</span>`;
    case 'py':
      return `<span class="icon-badge badge-py">py</span>`;
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
      return `<span class="icon-badge badge-c">C++</span>`;
    case 'html':
      return `<span class="icon-badge badge-html">&lt;&gt;</span>`;
    case 'css':
    case 'scss':
      return `<span class="icon-badge badge-css">#</span>`;
    case 'json':
      return `<span class="icon-badge badge-json">{}</span>`;
    case 'md':
      return `<span class="icon-badge badge-md">MD</span>`;
    default:
      return `<svg class="icon icon-file" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`;
  }
}
