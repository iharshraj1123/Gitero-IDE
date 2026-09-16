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

export interface LanguageInfo {
  name: string;
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

  switch (ext) {
    case 'ts':
    case 'mts':
    case 'cts':
      return { name: 'TypeScript', extension: () => javascript({ typescript: true }) };
    case 'tsx':
      return { name: 'React TSX', extension: () => javascript({ jsx: true, typescript: true }) };
    case 'js':
    case 'mjs':
    case 'cjs':
    case 'es6':
    case 'pac':
      return { name: 'JavaScript', extension: () => javascript() };
    case 'jsx':
      return { name: 'React JSX', extension: () => javascript({ jsx: true }) };
    case 'html':
    case 'htm':
    case 'xhtml':
      return { name: 'HTML', extension: () => html() };
    case 'css':
    case 'scss':
    case 'less':
    case 'sass':
      return { name: 'CSS', extension: () => css() };
    case 'py':
    case 'pyw':
    case 'pyi':
      return { name: 'Python', extension: () => python() };
    case 'rs':
      return { name: 'Rust', extension: () => rust() };
    case 'c':
    case 'h':
    case 'cpp':
    case 'hpp':
    case 'cc':
    case 'cxx':
    case 'ino':
      return { name: 'C / C++', extension: () => cpp() };
    case 'go':
      return { name: 'Go', extension: () => go() };
    case 'java':
    case 'jav':
      return { name: 'Java', extension: () => java() };
    case 'json':
    case 'jsonc':
    case 'json5':
    case 'babelrc':
    case 'eslintrc':
    case 'prettierrc':
      return { name: 'JSON', extension: () => json() };
    case 'md':
    case 'markdown':
    case 'mdown':
    case 'mkd':
      return { name: 'Markdown', extension: () => markdown() };
    case 'yaml':
    case 'yml':
      return { name: 'YAML', extension: () => yaml() };
    case 'sql':
    case 'pgsql':
    case 'mysql':
    case 'sqlite':
      return { name: 'SQL', extension: () => sql() };
    case 'xml':
    case 'svg':
    case 'plist':
    case 'xaml':
    case 'rss':
    case 'atom':
      return { name: 'XML', extension: () => xml() };
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'ps1':
    case 'bat':
    case 'cmd':
      return { name: 'Shell Script', extension: () => [] };
    case 'toml':
    case 'ini':
    case 'properties':
    case 'conf':
      return { name: 'Configuration', extension: () => [] };
    default:
      return { name: 'Plain Text', extension: () => [] };
  }
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { name: 'TypeScript', extension: () => javascript({ typescript: true }) },
  { name: 'React TSX', extension: () => javascript({ jsx: true, typescript: true }) },
  { name: 'JavaScript', extension: () => javascript() },
  { name: 'React JSX', extension: () => javascript({ jsx: true }) },
  { name: 'Python', extension: () => python() },
  { name: 'Rust', extension: () => rust() },
  { name: 'C / C++', extension: () => cpp() },
  { name: 'HTML', extension: () => html() },
  { name: 'CSS', extension: () => css() },
  { name: 'JSON', extension: () => json() },
  { name: 'Markdown', extension: () => markdown() },
  { name: 'Go', extension: () => go() },
  { name: 'Java', extension: () => java() },
  { name: 'YAML', extension: () => yaml() },
  { name: 'SQL', extension: () => sql() },
  { name: 'XML', extension: () => xml() },
  { name: 'Plain Text', extension: () => [] }
];

export function getLanguageByName(name: string): LanguageInfo {
  return SUPPORTED_LANGUAGES.find(l => l.name.toLowerCase() === name.toLowerCase()) || {
    name: 'Plain Text',
    extension: () => []
  };
}

