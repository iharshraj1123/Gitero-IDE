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

interface MemberDef {
  label: string;
  type: 'method' | 'property';
  detail?: string;
}

const RUNTIME_MEMBERS: Record<string, Record<string, MemberDef[]>> = {
  javascript: {
    console: [
      { label: 'log', type: 'method', detail: '(...data: any[]): void' },
      { label: 'error', type: 'method', detail: '(...data: any[]): void' },
      { label: 'warn', type: 'method', detail: '(...data: any[]): void' },
      { label: 'info', type: 'method', detail: '(...data: any[]): void' },
      { label: 'table', type: 'method', detail: '(tabularData?: any): void' },
      { label: 'clear', type: 'method', detail: '(): void' },
      { label: 'time', type: 'method', detail: '(label?: string): void' },
      { label: 'timeEnd', type: 'method', detail: '(label?: string): void' },
      { label: 'dir', type: 'method', detail: '(item?: any): void' },
      { label: 'assert', type: 'method', detail: '(condition?: boolean, ...data: any[]): void' },
      { label: 'count', type: 'method', detail: '(label?: string): void' },
      { label: 'trace', type: 'method', detail: '(...data: any[]): void' }
    ],
    document: [
      { label: 'getElementById', type: 'method', detail: '(elementId: string): HTMLElement | null' },
      { label: 'querySelector', type: 'method', detail: '(selectors: string): Element | null' },
      { label: 'querySelectorAll', type: 'method', detail: '(selectors: string): NodeListOf<Element>' },
      { label: 'createElement', type: 'method', detail: '(tagName: string): HTMLElement' },
      { label: 'addEventListener', type: 'method', detail: '(type: string, listener: EventListener): void' },
      { label: 'removeEventListener', type: 'method', detail: '(type: string, listener: EventListener): void' },
      { label: 'body', type: 'property', detail: 'HTMLBodyElement' },
      { label: 'head', type: 'property', detail: 'HTMLHeadElement' },
      { label: 'title', type: 'property', detail: 'string' },
      { label: 'cookie', type: 'property', detail: 'string' },
      { label: 'location', type: 'property', detail: 'Location' }
    ],
    window: [
      { label: 'addEventListener', type: 'method', detail: '(type: string, listener: EventListener): void' },
      { label: 'removeEventListener', type: 'method', detail: '(type: string, listener: EventListener): void' },
      { label: 'fetch', type: 'method', detail: '(input: RequestInfo, init?: RequestInit): Promise<Response>' },
      { label: 'setTimeout', type: 'method', detail: '(handler: Function, timeout?: number): number' },
      { label: 'clearTimeout', type: 'method', detail: '(id: number): void' },
      { label: 'setInterval', type: 'method', detail: '(handler: Function, timeout?: number): number' },
      { label: 'clearInterval', type: 'method', detail: '(id: number): void' },
      { label: 'localStorage', type: 'property', detail: 'Storage' },
      { label: 'sessionStorage', type: 'property', detail: 'Storage' },
      { label: 'location', type: 'property', detail: 'Location' },
      { label: 'alert', type: 'method', detail: '(message?: any): void' },
      { label: 'confirm', type: 'method', detail: '(message?: string): boolean' },
      { label: 'prompt', type: 'method', detail: '(message?: string): string | null' }
    ],
    json: [
      { label: 'stringify', type: 'method', detail: '(value: any, replacer?: any, space?: any): string' },
      { label: 'parse', type: 'method', detail: '(text: string, reviver?: any): any' }
    ],
    math: [
      { label: 'floor', type: 'method', detail: '(x: number): number' },
      { label: 'ceil', type: 'method', detail: '(x: number): number' },
      { label: 'round', type: 'method', detail: '(x: number): number' },
      { label: 'abs', type: 'method', detail: '(x: number): number' },
      { label: 'min', type: 'method', detail: '(...values: number[]): number' },
      { label: 'max', type: 'method', detail: '(...values: number[]): number' },
      { label: 'random', type: 'method', detail: '(): number' },
      { label: 'sqrt', type: 'method', detail: '(x: number): number' },
      { label: 'pow', type: 'method', detail: '(x: number, y: number): number' },
      { label: 'PI', type: 'property', detail: 'number' }
    ],
    object: [
      { label: 'keys', type: 'method', detail: '(o: object): string[]' },
      { label: 'values', type: 'method', detail: '(o: object): any[]' },
      { label: 'entries', type: 'method', detail: '(o: object): [string, any][]' },
      { label: 'assign', type: 'method', detail: '(target: object, ...sources: any[]): any' },
      { label: 'freeze', type: 'method', detail: '<T>(a: T): Readonly<T>' },
      { label: 'fromEntries', type: 'method', detail: '(entries: Iterable<readonly any[]>): any' },
      { label: 'hasOwn', type: 'method', detail: '(o: object, v: PropertyKey): boolean' }
    ],
    promise: [
      { label: 'resolve', type: 'method', detail: '<T>(value: T): Promise<T>' },
      { label: 'reject', type: 'method', detail: '(reason?: any): Promise<never>' },
      { label: 'all', type: 'method', detail: '<T>(values: Iterable<T>): Promise<T[]>' },
      { label: 'allSettled', type: 'method', detail: '(values: Iterable<any>): Promise<any[]>' },
      { label: 'race', type: 'method', detail: '<T>(values: Iterable<T>): Promise<T>' }
    ],
    array: [
      { label: 'isArray', type: 'method', detail: '(arg: any): boolean' },
      { label: 'from', type: 'method', detail: '(arrayLike: any): any[]' },
      { label: 'of', type: 'method', detail: '(...items: any[]): any[]' }
    ]
  }
};

RUNTIME_MEMBERS.typescript = RUNTIME_MEMBERS.javascript;
RUNTIME_MEMBERS.javascriptreact = RUNTIME_MEMBERS.javascript;
RUNTIME_MEMBERS.typescriptreact = RUNTIME_MEMBERS.javascript;

const RUNTIME_GLOBALS: Record<string, { label: string; type: 'variable' | 'class' | 'function'; detail: string }[]> = {
  javascript: [
    { label: 'console', type: 'variable', detail: 'Console' },
    { label: 'document', type: 'variable', detail: 'Document' },
    { label: 'window', type: 'variable', detail: 'Window' },
    { label: 'Math', type: 'variable', detail: 'Math' },
    { label: 'JSON', type: 'variable', detail: 'JSON' },
    { label: 'Promise', type: 'class', detail: 'Promise<T>' },
    { label: 'Array', type: 'class', detail: 'Array<T>' },
    { label: 'Object', type: 'class', detail: 'Object' },
    { label: 'String', type: 'class', detail: 'String' },
    { label: 'Number', type: 'class', detail: 'Number' },
    { label: 'Boolean', type: 'class', detail: 'Boolean' },
    { label: 'Date', type: 'class', detail: 'Date' },
    { label: 'RegExp', type: 'class', detail: 'RegExp' },
    { label: 'Error', type: 'class', detail: 'Error' },
    { label: 'Map', type: 'class', detail: 'Map<K, V>' },
    { label: 'Set', type: 'class', detail: 'Set<T>' },
    { label: 'fetch', type: 'function', detail: '(input: RequestInfo, init?: RequestInit): Promise<Response>' },
    { label: 'setTimeout', type: 'function', detail: '(handler: Function, timeout?: number): number' },
    { label: 'clearTimeout', type: 'function', detail: '(id: number): void' },
    { label: 'setInterval', type: 'function', detail: '(handler: Function, timeout?: number): number' },
    { label: 'clearInterval', type: 'function', detail: '(id: number): void' },
    { label: 'localStorage', type: 'variable', detail: 'Storage' },
    { label: 'sessionStorage', type: 'variable', detail: 'Storage' },
    { label: 'globalThis', type: 'variable', detail: 'globalThis' }
  ],
  python: [
    { label: 'print', type: 'function', detail: '(*values, sep=" ", end="\\n", flush=False)' },
    { label: 'len', type: 'function', detail: '(obj) -> int' },
    { label: 'range', type: 'function', detail: '(stop) or (start, stop[, step])' },
    { label: 'str', type: 'class', detail: 'str(object="") -> str' },
    { label: 'int', type: 'class', detail: 'int(x=0) -> int' },
    { label: 'float', type: 'class', detail: 'float(x=0.0) -> float' },
    { label: 'list', type: 'class', detail: 'list(iterable=()) -> list' },
    { label: 'dict', type: 'class', detail: 'dict(**kwargs) -> dict' },
    { label: 'set', type: 'class', detail: 'set(iterable=()) -> set' },
    { label: 'tuple', type: 'class', detail: 'tuple(iterable=()) -> tuple' },
    { label: 'open', type: 'function', detail: '(file, mode="r", encoding=None)' },
    { label: 'type', type: 'function', detail: 'type(object) -> type' },
    { label: 'isinstance', type: 'function', detail: '(object, classinfo) -> bool' },
    { label: 'enumerate', type: 'function', detail: '(iterable, start=0)' },
    { label: 'zip', type: 'function', detail: '(*iterables)' }
  ]
};

RUNTIME_GLOBALS.typescript = RUNTIME_GLOBALS.javascript;
RUNTIME_GLOBALS.javascriptreact = RUNTIME_GLOBALS.javascript;
RUNTIME_GLOBALS.typescriptreact = RUNTIME_GLOBALS.javascript;

export function createLocalCompletionSource(getLanguageId?: () => string) {
  return (context: CompletionContext): CompletionResult | null => {
    const languageId = getLanguageId ? getLanguageId().toLowerCase() : '';

    // 1. Check for member expression: e.g. "console." or "console.lo" or "document.get"
    const memberMatch = context.matchBefore(/([a-zA-Z_$][a-zA-Z0-9_$]*)\.([a-zA-Z_$][a-zA-Z0-9_$]*)?$/);
    if (memberMatch) {
      const parts = memberMatch.text.split('.');
      const objName = parts[0].toLowerCase();
      const propPrefix = (parts[1] || '').toLowerCase();
      const langMembers = RUNTIME_MEMBERS[languageId];

      if (langMembers && langMembers[objName]) {
        const memberOptions: Completion[] = [];
        for (const m of langMembers[objName]) {
          if (!propPrefix || m.label.toLowerCase().startsWith(propPrefix)) {
            memberOptions.push({
              label: m.label,
              type: m.type,
              detail: m.detail,
              boost: 60
            });
          }
        }
        if (memberOptions.length > 0) {
          return {
            from: context.pos - (parts[1] || '').length,
            options: memberOptions,
            filter: true
          };
        }
      }
    }

    const word = context.matchBefore(/[a-zA-Z_$][a-zA-Z0-9_$]*/);
    if (!word && !context.explicit) return null;

    const prefix = word ? word.text : '';
    if (prefix.length === 0 && !context.explicit) return null;

    const query = prefix.toLowerCase();
    const docText = context.state.doc.toString();

    const seenLabels = new Set<string>();
    const options: Completion[] = [];

    // 2. Standard Runtime Globals (e.g. console, document, window, Math)
    const globals = RUNTIME_GLOBALS[languageId] || [];
    for (const g of globals) {
      if (!query || g.label.toLowerCase().startsWith(query)) {
        if (!seenLabels.has(g.label) && g.label !== prefix) {
          seenLabels.add(g.label);
          options.push({
            label: g.label,
            type: g.type,
            detail: g.detail,
            boost: g.label.toLowerCase() === query ? 45 : 35
          });
        }
      }
    }

    // 3. Language Keywords
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

    // 4. Buffer Identifier Scanning (Functions, Classes, Variables)
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

    // 5. General Word Identifiers in Document
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
