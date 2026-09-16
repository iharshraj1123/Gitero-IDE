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

export function detectLanguage(filePath: string): LanguageInfo {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'ts':
    case 'mts':
      return { name: 'TypeScript', extension: () => javascript({ typescript: true }) };
    case 'tsx':
      return { name: 'React TSX', extension: () => javascript({ jsx: true, typescript: true }) };
    case 'js':
    case 'mjs':
    case 'cjs':
      return { name: 'JavaScript', extension: () => javascript() };
    case 'jsx':
      return { name: 'React JSX', extension: () => javascript({ jsx: true }) };
    case 'html':
    case 'htm':
      return { name: 'HTML', extension: () => html() };
    case 'css':
    case 'scss':
    case 'less':
      return { name: 'CSS', extension: () => css() };
    case 'py':
    case 'pyw':
      return { name: 'Python', extension: () => python() };
    case 'rs':
      return { name: 'Rust', extension: () => rust() };
    case 'c':
    case 'h':
    case 'cpp':
    case 'hpp':
    case 'cc':
    case 'cxx':
      return { name: 'C / C++', extension: () => cpp() };
    case 'go':
      return { name: 'Go', extension: () => go() };
    case 'java':
      return { name: 'Java', extension: () => java() };
    case 'json':
      return { name: 'JSON', extension: () => json() };
    case 'md':
    case 'markdown':
      return { name: 'Markdown', extension: () => markdown() };
    case 'yaml':
    case 'yml':
      return { name: 'YAML', extension: () => yaml() };
    case 'sql':
      return { name: 'SQL', extension: () => sql() };
    case 'xml':
    case 'svg':
      return { name: 'XML', extension: () => xml() };
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

