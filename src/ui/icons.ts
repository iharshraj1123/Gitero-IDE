import { preferencesService, IconTheme } from '../services/preferences';
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  FileJson,
  FileSpreadsheet,
  FileArchive,
  Image,
  Film,
  Music,
  Terminal,
  Database,
  Settings,
  Lock,
  GitBranch,
  Code2,
  Hash,
  Key
} from 'lucide';

// ---------------------------------------------------------------------------
// Lucide SVG rendering helper
// ---------------------------------------------------------------------------

function renderLucideNode(iconNode: any, stroke = 'currentColor', strokeWidth = 1.75, width = 16, height = 16): string {
  const children = iconNode.map(([tag, attrs]: [string, Record<string, string>]) => {
    const attrStr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag} ${attrStr}></${tag}>`;
  }).join('');
  return `<svg class="icon lucide-icon" width="${width}" height="${height}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;
}

// ---------------------------------------------------------------------------
// Folder chevron (expand / collapse indicator)
// ---------------------------------------------------------------------------

export function getFolderChevronSvg(isOpen: boolean): string {
  return isOpen
    ? `<svg class="chevron-icon chevron-down" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`
    : `<svg class="chevron-icon chevron-right" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
}

// ---------------------------------------------------------------------------
// Lucide Folders (used in badges and lucide themes)
// ---------------------------------------------------------------------------

export function getLucideFolderSvg(isOpen: boolean, color = '#dcb67a'): string {
  return isOpen
    ? renderLucideNode(FolderOpen, color, 1.75)
    : renderLucideNode(Folder, color, 1.75);
}

// ---------------------------------------------------------------------------
// Package 1: BADGES (Compact badges + clean Lucide folders & non-code files)
// ---------------------------------------------------------------------------

const BADGE_MAP: Record<string, { text: string; bg: string; fg: string }> = {
  ts:    { text: 'TS',   bg: '#3178c6', fg: '#fff' },
  mts:   { text: 'TS',   bg: '#3178c6', fg: '#fff' },
  cts:   { text: 'TS',   bg: '#3178c6', fg: '#fff' },
  tsx:   { text: 'TSX',  bg: '#61dafb', fg: '#000' },
  js:    { text: 'JS',   bg: '#f7df1e', fg: '#000' },
  mjs:   { text: 'JS',   bg: '#f7df1e', fg: '#000' },
  cjs:   { text: 'JS',   bg: '#f7df1e', fg: '#000' },
  jsx:   { text: 'JSX',  bg: '#61dafb', fg: '#000' },
  html:  { text: '<>',   bg: '#e34f26', fg: '#fff' },
  htm:   { text: '<>',   bg: '#e34f26', fg: '#fff' },
  css:   { text: '#',    bg: '#1572b6', fg: '#fff' },
  scss:  { text: 'SCSS', bg: '#cc6699', fg: '#fff' },
  sass:  { text: 'SASS', bg: '#cc6699', fg: '#fff' },
  less:  { text: 'LESS', bg: '#294f80', fg: '#fff' },
  json:  { text: '{}',   bg: '#cb9800', fg: '#fff' },
  jsonc: { text: '{}',   bg: '#cb9800', fg: '#fff' },
  md:    { text: 'MD',   bg: '#083fa1', fg: '#fff' },
  markdown: { text: 'MD', bg: '#083fa1', fg: '#fff' },
  py:    { text: 'py',   bg: '#3776ab', fg: '#fff' },
  pyw:   { text: 'py',   bg: '#3776ab', fg: '#fff' },
  rs:    { text: 'rs',   bg: '#dea584', fg: '#000' },
  c:     { text: 'C',    bg: '#00599c', fg: '#fff' },
  h:     { text: 'H',    bg: '#00599c', fg: '#fff' },
  cpp:   { text: 'C++',  bg: '#00599c', fg: '#fff' },
  cc:    { text: 'C++',  bg: '#00599c', fg: '#fff' },
  hpp:   { text: 'H++',  bg: '#00599c', fg: '#fff' },
  go:    { text: 'GO',   bg: '#00acd7', fg: '#fff' },
  java:  { text: 'JAVA', bg: '#f89820', fg: '#fff' },
  php:   { text: 'PHP',  bg: '#8892be', fg: '#fff' },
  rb:    { text: 'RB',   bg: '#cc342d', fg: '#fff' },
  swift: { text: 'SWIFT', bg: '#f05138', fg: '#fff' },
  kt:    { text: 'KT',   bg: '#7f52ff', fg: '#fff' },
  kts:   { text: 'KT',   bg: '#7f52ff', fg: '#fff' },
  sh:    { text: '>_',   bg: '#4eaa25', fg: '#fff' },
  bash:  { text: '>_',   bg: '#4eaa25', fg: '#fff' },
  zsh:   { text: '>_',   bg: '#4eaa25', fg: '#fff' },
  fish:  { text: '>_',   bg: '#4eaa25', fg: '#fff' },
  ps1:   { text: 'PS',   bg: '#012456', fg: '#fff' },
  bat:   { text: 'BAT',  bg: '#c1f12e', fg: '#000' },
  cmd:   { text: 'CMD',  bg: '#c1f12e', fg: '#000' },
  sql:   { text: 'SQL',  bg: '#336791', fg: '#fff' },
  yaml:  { text: 'YML',  bg: '#cc1018', fg: '#fff' },
  yml:   { text: 'YML',  bg: '#cc1018', fg: '#fff' },
  toml:  { text: 'TOML', bg: '#9c4221', fg: '#fff' },
  xml:   { text: 'XML',  bg: '#e37933', fg: '#fff' },
  dockerfile: { text: 'DOC', bg: '#2496ed', fg: '#fff' },
  gitignore:  { text: 'GIT', bg: '#f05032', fg: '#fff' },
  env:   { text: 'ENV',  bg: '#ecd53f', fg: '#000' }
};

function renderBadge(text: string, bg: string, fg: string): string {
  return `<span class="icon-badge" style="background-color: ${bg}; color: ${fg};">${text}</span>`;
}

function getBadgesIcon(fileName: string, isDirectory: boolean, isOpen: boolean): string {
  if (isDirectory) {
    return getLucideFolderSvg(isOpen, '#dcb67a');
  }

  const nameLower = fileName.toLowerCase();

  // Named file badges
  if (nameLower === 'dockerfile' || nameLower === 'docker-compose.yml') {
    return renderBadge('DOC', '#2496ed', '#fff');
  }
  if (nameLower === '.gitignore' || nameLower === '.gitattributes') {
    return renderBadge('GIT', '#f05032', '#fff');
  }
  if (nameLower.startsWith('.env')) {
    return renderBadge('ENV', '#ecd53f', '#000');
  }
  if (nameLower === 'license' || nameLower === 'license.md') {
    return renderLucideNode(Lock, '#bf616a');
  }
  if (nameLower.includes('lock')) {
    return renderLucideNode(Lock, '#bf616a');
  }

  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() ?? '' : '';

  // Language code badge
  const badge = BADGE_MAP[ext];
  if (badge) {
    return renderBadge(badge.text, badge.bg, badge.fg);
  }

  // Media & non-code vector icons
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'svg'].includes(ext)) {
    return renderLucideNode(Image, '#b48ead');
  }
  if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext)) {
    return renderLucideNode(Film, '#a3be8c');
  }
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) {
    return renderLucideNode(Music, '#88c0d0');
  }
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
    return renderLucideNode(FileArchive, '#ebcb8b');
  }
  if (['csv', 'xlsx', 'xls'].includes(ext)) {
    return renderLucideNode(FileSpreadsheet, '#207245');
  }
  if (['txt', 'log', 'rtf'].includes(ext)) {
    return renderLucideNode(FileText, '#8b949e');
  }

  // Default clean vector file icon
  return renderLucideNode(File, 'var(--fg-muted, #8b949e)');
}

// ---------------------------------------------------------------------------
// Package 2: LUCIDE ICONS (Pure real vector Lucide icons with subtle color accents)
// ---------------------------------------------------------------------------

const LUCIDE_COLOR_MAP: Record<string, { icon: any; color: string }> = {
  ts:    { icon: FileCode, color: '#3178c6' },
  mts:   { icon: FileCode, color: '#3178c6' },
  tsx:   { icon: Code2,    color: '#61dafb' },
  js:    { icon: FileCode, color: '#f7df1e' },
  mjs:   { icon: FileCode, color: '#f7df1e' },
  jsx:   { icon: Code2,    color: '#61dafb' },
  html:  { icon: Code2,    color: '#e34f26' },
  htm:   { icon: Code2,    color: '#e34f26' },
  css:   { icon: Hash,     color: '#1572b6' },
  scss:  { icon: Hash,     color: '#cc6699' },
  sass:  { icon: Hash,     color: '#cc6699' },
  json:  { icon: FileJson, color: '#cb9800' },
  jsonc: { icon: FileJson, color: '#cb9800' },
  md:    { icon: FileText, color: '#58a6ff' },
  markdown: { icon: FileText, color: '#58a6ff' },
  py:    { icon: FileCode, color: '#3776ab' },
  rs:    { icon: FileCode, color: '#dea584' },
  c:     { icon: FileCode, color: '#00599c' },
  cpp:   { icon: FileCode, color: '#00599c' },
  go:    { icon: FileCode, color: '#00acd7' },
  java:  { icon: FileCode, color: '#f89820' },
  php:   { icon: FileCode, color: '#8892be' },
  rb:    { icon: FileCode, color: '#cc342d' },
  swift: { icon: FileCode, color: '#f05138' },
  kt:    { icon: FileCode, color: '#7f52ff' },
  sh:    { icon: Terminal, color: '#4eaa25' },
  bash:  { icon: Terminal, color: '#4eaa25' },
  zsh:   { icon: Terminal, color: '#4eaa25' },
  bat:   { icon: Terminal, color: '#85e89d' },
  cmd:   { icon: Terminal, color: '#85e89d' },
  ps1:   { icon: Terminal, color: '#79b8ff' },
  sql:   { icon: Database, color: '#336791' },
  yaml:  { icon: FileText, color: '#cc1018' },
  yml:   { icon: FileText, color: '#cc1018' },
  toml:  { icon: Settings, color: '#9c4221' },
  xml:   { icon: Code2,    color: '#e37933' },
  png:   { icon: Image,    color: '#b48ead' },
  jpg:   { icon: Image,    color: '#b48ead' },
  jpeg:  { icon: Image,    color: '#b48ead' },
  gif:   { icon: Image,    color: '#b48ead' },
  webp:  { icon: Image,    color: '#b48ead' },
  svg:   { icon: Image,    color: '#ff9900' },
  ico:   { icon: Image,    color: '#b48ead' },
  mp4:   { icon: Film,     color: '#a3be8c' },
  webm:  { icon: Film,     color: '#a3be8c' },
  mkv:   { icon: Film,     color: '#a3be8c' },
  mp3:   { icon: Music,    color: '#88c0d0' },
  wav:   { icon: Music,    color: '#88c0d0' },
  zip:   { icon: FileArchive, color: '#ebcb8b' },
  tar:   { icon: FileArchive, color: '#ebcb8b' },
  gz:    { icon: FileArchive, color: '#ebcb8b' },
  lock:  { icon: Lock,     color: '#bf616a' }
};

function getLucideIcon(fileName: string, isDirectory: boolean, isOpen: boolean): string {
  if (isDirectory) {
    return getLucideFolderSvg(isOpen, '#dcb67a');
  }

  const nameLower = fileName.toLowerCase();
  if (nameLower.startsWith('.git')) {
    return renderLucideNode(GitBranch, '#f05032');
  }
  if (nameLower.startsWith('.env')) {
    return renderLucideNode(Key, '#ecd53f');
  }
  if (nameLower.includes('config') || nameLower.endsWith('rc') || nameLower.startsWith('.editorconfig')) {
    return renderLucideNode(Settings, '#79b8ff');
  }
  if (nameLower === 'license' || nameLower === 'license.md' || nameLower.includes('lock')) {
    return renderLucideNode(Lock, '#bf616a');
  }

  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() ?? '' : '';
  const item = LUCIDE_COLOR_MAP[ext];
  if (item) {
    return renderLucideNode(item.icon, item.color);
  }

  return renderLucideNode(File, 'var(--fg-muted, #8b949e)');
}

// ---------------------------------------------------------------------------
// Package 3: MATERIAL SVGs (Colored glyphs)
// ---------------------------------------------------------------------------

function folderSvg(color: string): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3.172a1.5 1.5 0 0 1 1.06.44l.828.828A1.5 1.5 0 0 0 9.121 3.75H13A1.5 1.5 0 0 1 14.5 5.25v7.25A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5v-9z" fill="${color}"/></svg>`;
}

function folderOpenSvg(color: string): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.172a1.5 1.5 0 0 1 1.06.44l.829.828A1.5 1.5 0 0 0 8.62 3.75H13.5A1.5 1.5 0 0 1 15 5.25v1H1V3.5z" fill="${color}" opacity="0.8"/><path d="M1 6.25h14L13.25 13H2.75L1 6.25z" fill="${color}"/></svg>`;
}

const MATERIAL_FOLDER_COLORS: Record<string, string> = {
  src: '#81a1c1', source: '#81a1c1', dist: '#ebcb8b', build: '#ebcb8b',
  public: '#88c0d0', assets: '#88c0d0', components: '#8fbcbb', pages: '#8fbcbb',
  utils: '#a3be8c', services: '#d08770', tests: '#a3be8c', test: '#a3be8c',
  '.git': '#bf616a', '.github': '#6e40c9', node_modules: '#4c566a'
};

function getMaterialIcon(fileName: string, isDirectory: boolean, isOpen: boolean): string {
  if (isDirectory) {
    const color = MATERIAL_FOLDER_COLORS[fileName.toLowerCase()] || '#d7ba7d';
    return isOpen ? folderOpenSvg(color) : folderSvg(color);
  }

  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() ?? '' : '';

  if (['ts', 'mts', 'cts'].includes(ext)) {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="2" fill="#3178c6"/><path d="M3 8.5h10M8 3.5V13" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><path d="M5.5 5.5H11" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }
  if (['js', 'mjs', 'cjs'].includes(ext)) {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="2" fill="#f7df1e"/><path d="M4.5 11.5c0 1.5 2.5 2 3.5.5" stroke="#000" stroke-width="1.3" stroke-linecap="round"/><path d="M9.5 5v5.5c0 1.8 3 2 3-.5V9" stroke="#000" stroke-width="1.3" stroke-linecap="round"/></svg>`;
  }
  if (['tsx', 'jsx'].includes(ext)) {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="2" fill="#20232a"/><ellipse cx="8" cy="8" rx="5.5" ry="2.2" stroke="#61dafb" stroke-width="1.1"/><ellipse cx="8" cy="8" rx="5.5" ry="2.2" stroke="#61dafb" stroke-width="1.1" transform="rotate(60 8 8)"/><circle cx="8" cy="8" r="1.2" fill="#61dafb"/></svg>`;
  }
  if (['html', 'htm'].includes(ext)) {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="2" fill="#e34f26"/><path d="M3 2.5l1.3 9.5L8 13.5l3.7-1.5L13 2.5H3z" fill="#ef6428"/><path d="M8 11.8l2.3-.7.7-4.6H8v1.8h1.8l-.2 1.4L8 10.1V11.8z" fill="#fff"/></svg>`;
  }
  if (['css', 'less'].includes(ext)) {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="2" fill="#1572b6"/><path d="M3 2.5l1.3 9.5L8 13.5l3.7-1.5L13 2.5H3z" fill="#33a9dc"/><path d="M8 11.5l2.3-.7.4-2.8H8v-2h2.9l.3-2H8V2.5H4.5L5.2 9l2.8.8V11.5z" fill="#fff"/></svg>`;
  }
  if (['json', 'jsonc'].includes(ext)) {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="2" fill="#cb9800"/><path d="M5 4.5c-1 0-1.5.6-1.5 1.2v1c0 .6-.5 1-1 1 .5 0 1 .4 1 1v1c0 .6.5 1.2 1.5 1.2" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/><path d="M11 4.5c1 0 1.5.6 1.5 1.2v1c0 .6.5 1 1 1-.5 0-1 .4-1 1v1c0 .6-.5 1.2-1.5 1.2" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/></svg>`;
  }
  if (['md', 'markdown'].includes(ext)) {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="2" fill="#083fa1"/><path d="M2.5 5.5v5h1.5V8l1.5 2 1.5-2v2.5H8.5v-5H7L5.5 8 4 5.5H2.5zM10 8.5l1.5-1.5V10.5H13V7l-1.5-1.5L10 7v-.5H8.5V10.5H10V8.5z" fill="#fff"/></svg>`;
  }
  if (['py', 'pyw'].includes(ext)) {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="2" fill="#3776ab"/><path d="M8 2c-1.5 0-3 .4-3 2v1.5h3v.5H4c-1.2 0-2 .8-2 2.5 0 1.5 1 2.5 2.5 2.5H5.5v-1.5c0-1.5.8-2 2.5-2h3c1.2 0 2-.7 2-2V4c0-1.5-1.5-2-5-2z" fill="#ffd343"/><path d="M8 14c1.5 0 3-.4 3-2v-1.5H8V10h4c1.2 0 2-.8 2-2.5 0-1.5-1-2.5-2.5-2.5H10.5V6.5c0 1.5-.8 2-2.5 2h-3c-1.2 0-2 .7-2 2V12c0 1.5 1.5 2 5 2z" fill="#fff"/></svg>`;
  }
  if (['rs'].includes(ext)) {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="2" fill="#b7410e"/><circle cx="8" cy="8" r="4.5" stroke="#fff" stroke-width="1.2"/><circle cx="8" cy="8" r="1.8" fill="#fff"/></svg>`;
  }

  return renderLucideNode(File, 'var(--fg-muted, #8b949e)');
}

// ---------------------------------------------------------------------------
// Package 4: CUSTOM USER PACKAGE
// ---------------------------------------------------------------------------

function getCustomIcon(fileName: string, isDirectory: boolean, isOpen: boolean): string {
  try {
    const raw = preferencesService.get('workbench.customIconPackage');
    if (raw) {
      const pkg = JSON.parse(raw);
      if (isDirectory) {
        if (isOpen && pkg.folderOpen) return pkg.folderOpen;
        if (!isOpen && pkg.folder) return pkg.folder;
      }
      const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() ?? '' : '';
      if (pkg.extensions && pkg.extensions[ext]) {
        const item = pkg.extensions[ext];
        if (typeof item === 'string') return item;
        if (item.type === 'badge') return renderBadge(item.text, item.bg, item.fg);
        if (item.svg) return item.svg;
      }
    }
  } catch {
    // fallback
  }

  // Fallback to Badges theme
  return getBadgesIcon(fileName, isDirectory, isOpen);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getFileIconSvg(
  fileName: string,
  isDirectory: boolean,
  isOpen: boolean = false,
  overrideTheme?: IconTheme
): string {
  const activeTheme = overrideTheme || preferencesService.get('workbench.iconTheme') || 'badges';

  switch (activeTheme) {
    case 'lucide':
      return getLucideIcon(fileName, isDirectory, isOpen);
    case 'material':
      return getMaterialIcon(fileName, isDirectory, isOpen);
    case 'custom':
      return getCustomIcon(fileName, isDirectory, isOpen);
    case 'badges':
    default:
      return getBadgesIcon(fileName, isDirectory, isOpen);
  }
}

export function renderIconPreview(theme: IconTheme): string {
  const sampleFiles = [
    { name: 'src', isDir: true, isOpen: false },
    { name: 'index.ts', isDir: false, isOpen: false },
    { name: 'app.jsx', isDir: false, isOpen: false },
    { name: 'index.html', isDir: false, isOpen: false },
    { name: 'style.css', isDir: false, isOpen: false },
    { name: 'data.json', isDir: false, isOpen: false },
    { name: 'README.md', isDir: false, isOpen: false },
    { name: 'script.py', isDir: false, isOpen: false },
    { name: 'image.png', isDir: false, isOpen: false }
  ];

  return `<div class="icon-preview-row">
    ${sampleFiles.map(f => `
      <div class="icon-preview-item" title="${f.name}">
        <span class="tree-icon">${getFileIconSvg(f.name, f.isDir, f.isOpen, theme)}</span>
        <span class="icon-preview-label">${f.name}</span>
      </div>
    `).join('')}
  </div>`;
}
