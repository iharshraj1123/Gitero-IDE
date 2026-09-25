import { Extension } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { cpp } from '@codemirror/lang-cpp';
import { go } from '@codemirror/lang-go';
import { java } from '@codemirror/lang-java';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { php } from '@codemirror/lang-php';

export interface LanguageInfo {
  name: string;
  languageId?: string;
  extension: () => Extension;
}

export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg']);

export const BINARY_EXTENSIONS = new Set([
  'exe', 'dll', 'so', 'dylib', 'bin', 'obj', 'o', 'node',
  'zip', 'tar', 'gz', 'tgz', '7z', 'rar', 'bz2', 'xz',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'mp3', 'mp4', 'wav', 'ogg', 'mov', 'avi', 'mkv', 'webm',
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  'iso', 'dmg', 'class', 'pyc', 'pyd'
]);

export function isImageFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(ext);
}

export function isBinaryFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return BINARY_EXTENSIONS.has(ext);
}

export function isJsoncFile(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, '/').toLowerCase();
  const fileName = norm.split('/').pop() || '';
  const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : '';

  if (ext === 'jsonc' || ext === 'json5' || ext === 'babelrc' || ext === 'eslintrc' || ext === 'prettierrc' || ext === 'swcrc' || ext === 'hintrc') {
    return true;
  }

  // TSConfig and JSConfig family
  if (fileName === 'tsconfig.json' || fileName.startsWith('tsconfig.') || fileName.endsWith('.tsconfig.json')) {
    return true;
  }
  if (fileName === 'jsconfig.json' || fileName.startsWith('jsconfig.') || fileName.endsWith('.jsconfig.json')) {
    return true;
  }

  // VS Code and DevContainer configurations
  if (norm.includes('/.vscode/') || norm.includes('/.devcontainer/')) {
    return fileName.endsWith('.json');
  }

  // Known developer config files that permit comments
  if (
    fileName === 'neutralino.config.json' ||
    fileName === 'tauri.conf.json' ||
    fileName === 'turbo.json' ||
    fileName === 'deno.json' ||
    fileName === 'deno.jsonc' ||
    fileName === 'launch.json' ||
    fileName === 'tasks.json' ||
    fileName === 'settings.json' ||
    fileName === 'extensions.json' ||
    fileName === 'keybindings.json' ||
    fileName === 'devcontainer.json'
  ) {
    return true;
  }

  return false;
}

export function detectLanguage(filePath: string): LanguageInfo {
  const fileName = filePath.split(/[/\\]/).pop()?.toLowerCase() || '';
  const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : fileName;

  // Specific filename mappings
  if (fileName === 'dockerfile' || fileName === 'containerfile') {
    return { name: 'Dockerfile', extension: () => [] };
  }
  if (fileName === '.gitignore' || fileName === '.npmignore' || fileName === '.env') {
    return { name: 'Config', extension: () => [] };
  }

  if (isJsoncFile(filePath)) {
    return { name: 'JSON with Comments', languageId: 'jsonc', extension: () => json() };
  }

  switch (ext) {
    case 'ts':
    case 'mts':
    case 'cts':
      return { name: 'TypeScript', languageId: 'typescript', extension: () => javascript({ typescript: true }) };
    case 'tsx':
      return { name: 'React TSX', languageId: 'typescriptreact', extension: () => javascript({ jsx: true, typescript: true }) };
    case 'js':
    case 'mjs':
    case 'cjs':
    case 'es6':
    case 'pac':
      return { name: 'JavaScript', languageId: 'javascript', extension: () => javascript() };
    case 'jsx':
      return { name: 'React JSX', languageId: 'javascriptreact', extension: () => javascript({ jsx: true }) };
    case 'html':
    case 'htm':
    case 'xhtml':
      return { name: 'HTML', languageId: 'html', extension: () => html() };
    case 'css':
    case 'scss':
    case 'less':
    case 'sass':
      return { name: 'CSS', languageId: 'css', extension: () => css() };
    case 'py':
    case 'pyw':
    case 'pyi':
      return { name: 'Python', languageId: 'python', extension: () => python() };
    case 'rs':
      return { name: 'Rust', languageId: 'rust', extension: () => rust() };
    case 'c':
    case 'h':
      return { name: 'C / C++', languageId: 'c', extension: () => cpp() };
    case 'cpp':
    case 'hpp':
    case 'cc':
    case 'cxx':
    case 'ino':
      return { name: 'C / C++', languageId: 'cpp', extension: () => cpp() };
    case 'go':
      return { name: 'Go', languageId: 'go', extension: () => go() };
    case 'java':
    case 'jav':
      return { name: 'Java', languageId: 'java', extension: () => java() };
    case 'json':
      return { name: 'JSON', languageId: 'json', extension: () => json() };
    case 'jsonc':
    case 'json5':
    case 'babelrc':
    case 'eslintrc':
    case 'prettierrc':
    case 'swcrc':
      return { name: 'JSON with Comments', languageId: 'jsonc', extension: () => json() };
    case 'md':
    case 'markdown':
    case 'mdown':
    case 'mkd':
      return { name: 'Markdown', languageId: 'markdown', extension: () => markdown() };
    case 'yaml':
    case 'yml':
      return { name: 'YAML', languageId: 'yaml', extension: () => yaml() };
    case 'sql':
    case 'pgsql':
    case 'mysql':
    case 'sqlite':
      return { name: 'SQL', languageId: 'sql', extension: () => sql() };
    case 'xml':
    case 'svg':
    case 'plist':
    case 'xaml':
    case 'rss':
    case 'atom':
    case 'xsd':
    case 'xsl':
    case 'xslt':
      return { name: 'XML', languageId: 'xml', extension: () => xml() };
    case 'php':
    case 'phtml':
    case 'php3':
    case 'php4':
    case 'php5':
    case 'phps':
      return { name: 'PHP', languageId: 'php', extension: () => php() };
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'ps1':
    case 'bat':
    case 'cmd':
      return { name: 'Shell Script', languageId: 'shellscript', extension: () => [] };
    case 'toml':
    case 'ini':
    case 'properties':
    case 'conf':
      return { name: 'Configuration', languageId: 'ini', extension: () => [] };
    default:
      return { name: 'Plain Text', languageId: 'plaintext', extension: () => [] };
  }
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { name: 'TypeScript', languageId: 'typescript', extension: () => javascript({ typescript: true }) },
  { name: 'React TSX', languageId: 'typescriptreact', extension: () => javascript({ jsx: true, typescript: true }) },
  { name: 'JavaScript', languageId: 'javascript', extension: () => javascript() },
  { name: 'React JSX', languageId: 'javascriptreact', extension: () => javascript({ jsx: true }) },
  { name: 'Python', languageId: 'python', extension: () => python() },
  { name: 'Rust', languageId: 'rust', extension: () => rust() },
  { name: 'C / C++', languageId: 'cpp', extension: () => cpp() },
  { name: 'HTML', languageId: 'html', extension: () => html() },
  { name: 'CSS', languageId: 'css', extension: () => css() },
  { name: 'JSON', languageId: 'json', extension: () => json() },
  { name: 'JSON with Comments', languageId: 'jsonc', extension: () => json() },
  { name: 'Markdown', languageId: 'markdown', extension: () => markdown() },
  { name: 'Go', languageId: 'go', extension: () => go() },
  { name: 'Java', languageId: 'java', extension: () => java() },
  { name: 'YAML', languageId: 'yaml', extension: () => yaml() },
  { name: 'SQL', languageId: 'sql', extension: () => sql() },
  { name: 'XML', languageId: 'xml', extension: () => xml() },
  { name: 'PHP', languageId: 'php', extension: () => php() },
  { name: 'Plain Text', languageId: 'plaintext', extension: () => [] }
];

export function getLanguageByName(name: string): LanguageInfo {
  return SUPPORTED_LANGUAGES.find(l => l.name.toLowerCase() === name.toLowerCase()) || {
    name: 'Plain Text',
    extension: () => []
  };
}

