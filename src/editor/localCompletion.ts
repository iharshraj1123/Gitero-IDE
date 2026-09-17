/**
 * Local Fast In-Editor Completion Engine
 * Scans the active document and language keywords for instant, zero-dependency autocompletions.
 */

import { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';

const COMMON_KEYWORDS: Record<string, string[]> = {
  typescript: [
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
    'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import',
    'in', 'instanceof', 'interface', 'let', 'new', 'null', 'package', 'private', 'protected',
    'public', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void',
    'while', 'with', 'yield', 'async', 'await', 'type', 'declare', 'namespace', 'as', 'readonly'
  ],
  javascript: [
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
    'else', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in',
    'instanceof', 'let', 'new', 'null', 'return', 'super', 'switch', 'this', 'throw', 'true',
    'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'async', 'await'
  ],
  python: [
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
    'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import',
    'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while',
    'with', 'yield', 'self', 'cls'
  ],
  rust: [
    'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern',
    'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub',
    'ref', 'return', 'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe',
    'use', 'where', 'while'
  ],
  cpp: [
    'alignas', 'alignof', 'and', 'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const',
    'constexpr', 'continue', 'decltype', 'default', 'delete', 'do', 'double', 'dynamic_cast', 'else',
    'enum', 'explicit', 'export', 'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'inline',
    'int', 'long', 'mutable', 'namespace', 'new', 'noexcept', 'not', 'nullptr', 'operator', 'private',
    'protected', 'public', 'register', 'reinterpret_cast', 'return', 'short', 'signed', 'sizeof',
    'static', 'static_assert', 'static_cast', 'struct', 'switch', 'template', 'this', 'throw', 'true',
    'try', 'typedef', 'typeid', 'typename', 'union', 'unsigned', 'using', 'virtual', 'void', 'volatile',
    'while'
  ],
  go: [
    'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough', 'for',
    'func', 'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range', 'return', 'select',
    'struct', 'switch', 'type', 'var', 'nil', 'true', 'false'
  ],
  php: [
    '__halt_compiler', 'abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch', 'class',
    'clone', 'const', 'continue', 'declare', 'default', 'die', 'do', 'echo', 'else', 'elseif', 'empty',
    'enddeclare', 'endfor', 'endforeach', 'endif', 'endswitch', 'endwhile', 'eval', 'exit', 'extends',
    'final', 'finally', 'fn', 'for', 'foreach', 'function', 'global', 'goto', 'if', 'implements',
    'include', 'include_once', 'instanceof', 'insteadof', 'interface', 'isset', 'list', 'match',
    'namespace', 'new', 'or', 'print', 'private', 'protected', 'public', 'readonly', 'require',
    'require_once', 'return', 'static', 'switch', 'throw', 'trait', 'try', 'unset', 'use', 'var',
    'while', 'xor', 'yield'
  ]
};

// Aliases
COMMON_KEYWORDS.typescriptreact = COMMON_KEYWORDS.typescript;
COMMON_KEYWORDS.javascriptreact = COMMON_KEYWORDS.javascript;
COMMON_KEYWORDS.c = COMMON_KEYWORDS.cpp;

export function createLocalCompletionSource(getLanguageId?: () => string) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[a-zA-Z_$][a-zA-Z0-9_$]*/);
    if (!word && !context.explicit) return null;

    const prefix = word ? word.text : '';
    if (prefix.length === 0 && !context.explicit) return null;

    const query = prefix.toLowerCase();
    const docText = context.state.doc.toString();
    const languageId = getLanguageId ? getLanguageId().toLowerCase() : '';

    const seenLabels = new Set<string>();
    const options: Completion[] = [];

    // 1. Language Keywords
    const keywords = COMMON_KEYWORDS[languageId] || [];
    for (const kw of keywords) {
      if (!query || kw.toLowerCase().startsWith(query)) {
        if (!seenLabels.has(kw) && kw !== prefix) {
          seenLabels.add(kw);
          options.push({
            label: kw,
            type: 'keyword',
            boost: kw.toLowerCase() === query ? 20 : 5
          });
        }
      }
    }

    // 2. Buffer Identifier Scanning (Functions, Classes, Variables)
    // Match definitions first
    const defRegex = /(?:function|def|fn|func)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:class|struct|interface|trait|enum)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let|var|val)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let match: RegExpExecArray | null;

    while ((match = defRegex.exec(docText)) !== null) {
      const fnName = match[1];
      const typeName = match[2];
      const varName = match[3];

      if (fnName && (!query || fnName.toLowerCase().includes(query)) && fnName !== prefix && !seenLabels.has(fnName)) {
        seenLabels.add(fnName);
        options.push({
          label: fnName,
          type: 'function',
          detail: 'local function',
          boost: fnName.toLowerCase().startsWith(query) ? 30 : 10
        });
      } else if (typeName && (!query || typeName.toLowerCase().includes(query)) && typeName !== prefix && !seenLabels.has(typeName)) {
        seenLabels.add(typeName);
        options.push({
          label: typeName,
          type: 'class',
          detail: 'local type/class',
          boost: typeName.toLowerCase().startsWith(query) ? 30 : 10
        });
      } else if (varName && (!query || varName.toLowerCase().includes(query)) && varName !== prefix && !seenLabels.has(varName)) {
        seenLabels.add(varName);
        options.push({
          label: varName,
          type: 'variable',
          detail: 'local variable',
          boost: varName.toLowerCase().startsWith(query) ? 25 : 8
        });
      }
    }

    // 3. General Word Identifiers in Document
    const wordRegex = /\b[a-zA-Z_$][a-zA-Z0-9_$]{2,}\b/g;
    while ((match = wordRegex.exec(docText)) !== null) {
      const id = match[0];
      if (id !== prefix && !seenLabels.has(id)) {
        if (!query || id.toLowerCase().includes(query)) {
          seenLabels.add(id);
          options.push({
            label: id,
            type: 'text',
            boost: id.toLowerCase().startsWith(query) ? 10 : 1
          });
          if (options.length >= 60) break;
        }
      }
    }

    if (options.length === 0) return null;

    return {
      from: word ? word.from : context.pos,
      options,
      filter: false
    };
  };
}
