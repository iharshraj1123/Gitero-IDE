/**
 * Local Fast In-Editor Completion Engine
 * Scans the active document and language keywords for instant, zero-dependency autocompletions.
 */

import { Completion, CompletionContext, CompletionResult, snippet } from '@codemirror/autocomplete';

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
  template?: string;
}

const RUNTIME_MEMBERS: Record<string, Record<string, MemberDef[]>> = {
  javascript: {
    console: [
      { label: 'log', type: 'method', detail: '(...data: any[]): void', template: 'log(${1:data})' },
      { label: 'error', type: 'method', detail: '(...data: any[]): void', template: 'error(${1:err})' },
      { label: 'warn', type: 'method', detail: '(...data: any[]): void', template: 'warn(${1:warning})' },
      { label: 'info', type: 'method', detail: '(...data: any[]): void', template: 'info(${1:data})' },
      { label: 'table', type: 'method', detail: '(tabularData?: any): void', template: 'table(${1:data})' },
      { label: 'clear', type: 'method', detail: '(): void', template: 'clear()' },
      { label: 'time', type: 'method', detail: '(label?: string): void', template: "time('${1:timer}')" },
      { label: 'timeEnd', type: 'method', detail: '(label?: string): void', template: "timeEnd('${1:timer}')" },
      { label: 'dir', type: 'method', detail: '(item?: any): void', template: 'dir(${1:item})' },
      { label: 'assert', type: 'method', detail: '(condition?: boolean, ...data: any[]): void', template: 'assert(${1:condition}, ${2:data})' },
      { label: 'count', type: 'method', detail: '(label?: string): void', template: "count('${1:label}')" },
      { label: 'trace', type: 'method', detail: '(...data: any[]): void', template: 'trace()' }
    ],
    document: [
      { label: 'getElementById', type: 'method', detail: '(elementId: string): HTMLElement | null', template: "getElementById('${1:id}')" },
      { label: 'querySelector', type: 'method', detail: '(selectors: string): Element | null', template: "querySelector('${1:selector}')" },
      { label: 'querySelectorAll', type: 'method', detail: '(selectors: string): NodeListOf<Element>', template: "querySelectorAll('${1:selector}')" },
      { label: 'createElement', type: 'method', detail: '(tagName: string): HTMLElement', template: "createElement('${1:div}')" },
      { label: 'addEventListener', type: 'method', detail: '(type: string, listener: EventListener): void', template: "addEventListener('${1:click}', (${2:event}) => {\n\t${0}\n})" },
      { label: 'removeEventListener', type: 'method', detail: '(type: string, listener: EventListener): void', template: "removeEventListener('${1:click}', ${2:listener})" },
      { label: 'body', type: 'property', detail: 'HTMLBodyElement' },
      { label: 'head', type: 'property', detail: 'HTMLHeadElement' },
      { label: 'title', type: 'property', detail: 'string' },
      { label: 'cookie', type: 'property', detail: 'string' },
      { label: 'location', type: 'property', detail: 'Location' }
    ],
    element: [
      { label: 'addEventListener', type: 'method', detail: '(type: string, listener: EventListener): void', template: "addEventListener('${1:click}', (${2:event}) => {\n\t${0}\n})" },
      { label: 'removeEventListener', type: 'method', detail: '(type: string, listener: EventListener): void', template: "removeEventListener('${1:click}', ${2:listener})" },
      { label: 'querySelector', type: 'method', detail: '(selectors: string): Element | null', template: "querySelector('${1:selector}')" },
      { label: 'querySelectorAll', type: 'method', detail: '(selectors: string): NodeListOf<Element>', template: "querySelectorAll('${1:selector}')" },
      { label: 'setAttribute', type: 'method', detail: '(qualifiedName: string, value: string): void', template: "setAttribute('${1:name}', '${2:value}')" },
      { label: 'getAttribute', type: 'method', detail: '(qualifiedName: string): string | null', template: "getAttribute('${1:name}')" },
      { label: 'removeAttribute', type: 'method', detail: '(qualifiedName: string): void', template: "removeAttribute('${1:name}')" },
      { label: 'hasAttribute', type: 'method', detail: '(qualifiedName: string): boolean', template: "hasAttribute('${1:name}')" },
      { label: 'appendChild', type: 'method', detail: '<T extends Node>(node: T): T', template: 'appendChild(${1:child})' },
      { label: 'removeChild', type: 'method', detail: '<T extends Node>(child: T): T', template: 'removeChild(${1:child})' },
      { label: 'replaceChild', type: 'method', detail: '<T extends Node>(node: Node, child: T): T', template: 'replaceChild(${1:newChild}, ${2:oldChild})' },
      { label: 'closest', type: 'method', detail: '(selectors: string): Element | null', template: "closest('${1:selector}')" },
      { label: 'matches', type: 'method', detail: '(selectors: string): boolean', template: "matches('${1:selector}')" },
      { label: 'focus', type: 'method', detail: '(): void', template: 'focus()' },
      { label: 'blur', type: 'method', detail: '(): void', template: 'blur()' },
      { label: 'click', type: 'method', detail: '(): void', template: 'click()' },
      { label: 'classList', type: 'property', detail: 'DOMTokenList' },
      { label: 'innerHTML', type: 'property', detail: 'string' },
      { label: 'innerText', type: 'property', detail: 'string' },
      { label: 'textContent', type: 'property', detail: 'string' },
      { label: 'style', type: 'property', detail: 'CSSStyleDeclaration' },
      { label: 'id', type: 'property', detail: 'string' },
      { label: 'className', type: 'property', detail: 'string' },
      { label: 'parentElement', type: 'property', detail: 'HTMLElement | null' },
      { label: 'children', type: 'property', detail: 'HTMLCollection' },
      { label: 'value', type: 'property', detail: 'string' },
      { label: 'disabled', type: 'property', detail: 'boolean' }
    ],
    window: [
      { label: 'addEventListener', type: 'method', detail: '(type: string, listener: EventListener): void', template: "addEventListener('${1:click}', (${2:event}) => {\n\t${0}\n})" },
      { label: 'removeEventListener', type: 'method', detail: '(type: string, listener: EventListener): void', template: "removeEventListener('${1:click}', ${2:listener})" },
      { label: 'fetch', type: 'method', detail: '(input: RequestInfo, init?: RequestInit): Promise<Response>', template: "fetch('${1:url}')" },
      { label: 'setTimeout', type: 'method', detail: '(handler: Function, timeout?: number): number', template: "setTimeout(() => {\n\t${0}\n}, ${1:1000});" },
      { label: 'clearTimeout', type: 'method', detail: '(id: number): void', template: 'clearTimeout(${1:id})' },
      { label: 'setInterval', type: 'method', detail: '(handler: Function, timeout?: number): number', template: "setInterval(() => {\n\t${0}\n}, ${1:1000});" },
      { label: 'clearInterval', type: 'method', detail: '(id: number): void', template: 'clearInterval(${1:id})' },
      { label: 'localStorage', type: 'property', detail: 'Storage' },
      { label: 'sessionStorage', type: 'property', detail: 'Storage' },
      { label: 'location', type: 'property', detail: 'Location' },
      { label: 'alert', type: 'method', detail: '(message?: any): void', template: "alert('${1:message}')" },
      { label: 'confirm', type: 'method', detail: '(message?: string): boolean', template: "confirm('${1:message}')" },
      { label: 'prompt', type: 'method', detail: '(message?: string): string | null', template: "prompt('${1:message}')" }
    ],
    json: [
      { label: 'stringify', type: 'method', detail: '(value: any, replacer?: any, space?: any): string', template: 'stringify(${1:value}, null, 2)' },
      { label: 'parse', type: 'method', detail: '(text: string, reviver?: any): any', template: 'parse(${1:text})' }
    ],
    math: [
      { label: 'floor', type: 'method', detail: '(x: number): number', template: 'floor(${1:x})' },
      { label: 'ceil', type: 'method', detail: '(x: number): number', template: 'ceil(${1:x})' },
      { label: 'round', type: 'method', detail: '(x: number): number', template: 'round(${1:x})' },
      { label: 'abs', type: 'method', detail: '(x: number): number', template: 'abs(${1:x})' },
      { label: 'min', type: 'method', detail: '(...values: number[]): number', template: 'min(${1:a}, ${2:b})' },
      { label: 'max', type: 'method', detail: '(...values: number[]): number', template: 'max(${1:a}, ${2:b})' },
      { label: 'random', type: 'method', detail: '(): number', template: 'random()' },
      { label: 'sqrt', type: 'method', detail: '(x: number): number', template: 'sqrt(${1:x})' },
      { label: 'pow', type: 'method', detail: '(x: number, y: number): number', template: 'pow(${1:base}, ${2:exp})' },
      { label: 'PI', type: 'property', detail: 'number' }
    ],
    object: [
      { label: 'keys', type: 'method', detail: '(o: object): string[]', template: 'keys(${1:object})' },
      { label: 'values', type: 'method', detail: '(o: object): any[]', template: 'values(${1:object})' },
      { label: 'entries', type: 'method', detail: '(o: object): [string, any][]', template: 'entries(${1:object})' },
      { label: 'assign', type: 'method', detail: '(target: object, ...sources: any[]): any', template: 'assign(${1:target}, ${2:source})' },
      { label: 'freeze', type: 'method', detail: '<T>(a: T): Readonly<T>', template: 'freeze(${1:object})' },
      { label: 'fromEntries', type: 'method', detail: '(entries: Iterable<readonly any[]>): any', template: 'fromEntries(${1:entries})' },
      { label: 'hasOwn', type: 'method', detail: '(o: object, v: PropertyKey): boolean', template: 'hasOwn(${1:object}, ${2:key})' }
    ],
    promise: [
      { label: 'resolve', type: 'method', detail: '<T>(value: T): Promise<T>', template: 'resolve(${1:value})' },
      { label: 'reject', type: 'method', detail: '(reason?: any): Promise<never>', template: 'reject(${1:reason})' },
      { label: 'all', type: 'method', detail: '<T>(values: Iterable<T>): Promise<T[]>', template: 'all([${1:promises}])' },
      { label: 'allSettled', type: 'method', detail: '(values: Iterable<any>): Promise<any[]>', template: 'allSettled([${1:promises}])' },
      { label: 'race', type: 'method', detail: '<T>(values: Iterable<T>): Promise<T>', template: 'race([${1:promises}])' }
    ],
    array: [
      { label: 'isArray', type: 'method', detail: '(arg: any): boolean', template: 'isArray(${1:arg})' },
      { label: 'from', type: 'method', detail: '(arrayLike: any): any[]', template: 'from(${1:arrayLike})' },
      { label: 'of', type: 'method', detail: '(...items: any[]): any[]', template: 'of(${1:items})' }
    ],
    array_instance: [
      { label: 'map', type: 'method', detail: '(callback: (item: T) => U): U[]', template: 'map((${1:item}) => ${0})' },
      { label: 'filter', type: 'method', detail: '(predicate: (item: T) => boolean): T[]', template: 'filter((${1:item}) => ${0})' },
      { label: 'forEach', type: 'method', detail: '(callback: (item: T) => void): void', template: 'forEach((${1:item}) => {\n\t${0}\n})' },
      { label: 'reduce', type: 'method', detail: '(callback: (acc: U, curr: T) => U, initial: U): U', template: 'reduce((${1:acc}, ${2:curr}) => {\n\t${0}\n}, ${3:initialValue})' },
      { label: 'find', type: 'method', detail: '(predicate: (item: T) => boolean): T | undefined', template: 'find((${1:item}) => ${0})' },
      { label: 'findIndex', type: 'method', detail: '(predicate: (item: T) => boolean): number', template: 'findIndex((${1:item}) => ${0})' },
      { label: 'some', type: 'method', detail: '(predicate: (item: T) => boolean): boolean', template: 'some((${1:item}) => ${0})' },
      { label: 'every', type: 'method', detail: '(predicate: (item: T) => boolean): boolean', template: 'every((${1:item}) => ${0})' },
      { label: 'flatMap', type: 'method', detail: '(callback: (item: T) => U[]): U[]', template: 'flatMap((${1:item}) => ${0})' },
      { label: 'includes', type: 'method', detail: '(searchElement: T): boolean', template: 'includes(${1:searchElement})' },
      { label: 'indexOf', type: 'method', detail: '(searchElement: T): number', template: 'indexOf(${1:searchElement})' },
      { label: 'slice', type: 'method', detail: '(start?: number, end?: number): T[]', template: 'slice(${1:start}, ${2:end})' },
      { label: 'splice', type: 'method', detail: '(start: number, deleteCount?: number): T[]', template: 'splice(${1:start}, ${2:deleteCount})' },
      { label: 'push', type: 'method', detail: '(...items: T[]): number', template: 'push(${1:item})' },
      { label: 'pop', type: 'method', detail: '(): T | undefined', template: 'pop()' },
      { label: 'shift', type: 'method', detail: '(): T | undefined', template: 'shift()' },
      { label: 'unshift', type: 'method', detail: '(...items: T[]): number', template: 'unshift(${1:item})' },
      { label: 'join', type: 'method', detail: '(separator?: string): string', template: "join('${1:,}')" },
      { label: 'sort', type: 'method', detail: '(compareFn?: (a: T, b: T) => number): this', template: 'sort((${1:a}, ${2:b}) => ${0})' },
      { label: 'length', type: 'property', detail: 'number' }
    ],
    string_instance: [
      { label: 'split', type: 'method', detail: '(separator: string | RegExp): string[]', template: "split('${1:,}')" },
      { label: 'replace', type: 'method', detail: '(searchValue: string | RegExp, replaceValue: string): string', template: "replace('${1:search}', '${2:replace}')" },
      { label: 'replaceAll', type: 'method', detail: '(searchValue: string | RegExp, replaceValue: string): string', template: "replaceAll('${1:search}', '${2:replace}')" },
      { label: 'trim', type: 'method', detail: '(): string', template: 'trim()' },
      { label: 'toLowerCase', type: 'method', detail: '(): string', template: 'toLowerCase()' },
      { label: 'toUpperCase', type: 'method', detail: '(): string', template: 'toUpperCase()' },
      { label: 'includes', type: 'method', detail: '(searchString: string): boolean', template: "includes('${1:search}')" },
      { label: 'startsWith', type: 'method', detail: '(searchString: string): boolean', template: "startsWith('${1:search}')" },
      { label: 'endsWith', type: 'method', detail: '(searchString: string): boolean', template: "endsWith('${1:search}')" },
      { label: 'substring', type: 'method', detail: '(start: number, end?: number): string', template: 'substring(${1:start}, ${2:end})' },
      { label: 'charAt', type: 'method', detail: '(pos: number): string', template: 'charAt(${1:index})' },
      { label: 'length', type: 'property', detail: 'number' }
    ]
  },
  python: {
    os: [
      { label: 'path', type: 'property', detail: 'os.path module' },
      { label: 'listdir', type: 'method', detail: '(path=".") -> list[str]', template: "listdir('${1:.}')" },
      { label: 'getcwd', type: 'method', detail: '() -> str', template: 'getcwd()' },
      { label: 'mkdir', type: 'method', detail: '(path, mode=0o777) -> None', template: "mkdir('${1:path}')" },
      { label: 'remove', type: 'method', detail: '(path) -> None', template: "remove('${1:path}')" },
      { label: 'environ', type: 'property', detail: 'os._Environ[str, str]' }
    ],
    sys: [
      { label: 'argv', type: 'property', detail: 'list[str]' },
      { label: 'exit', type: 'method', detail: '(status=None) -> None', template: 'exit(${1:0})' },
      { label: 'path', type: 'property', detail: 'list[str]' },
      { label: 'stdout', type: 'property', detail: 'TextIO' },
      { label: 'stderr', type: 'property', detail: 'TextIO' }
    ],
    json: [
      { label: 'loads', type: 'method', detail: '(s, ...) -> Any', template: 'loads(${1:s})' },
      { label: 'dumps', type: 'method', detail: '(obj, indent=None, ...) -> str', template: 'dumps(${1:obj}, indent=2)' },
      { label: 'load', type: 'method', detail: '(fp, ...) -> Any', template: 'load(${1:fp})' },
      { label: 'dump', type: 'method', detail: '(obj, fp, ...) -> None', template: 'dump(${1:obj}, ${2:fp}, indent=2)' }
    ],
    math: [
      { label: 'floor', type: 'method', detail: '(x) -> int', template: 'floor(${1:x})' },
      { label: 'ceil', type: 'method', detail: '(x) -> int', template: 'ceil(${1:x})' },
      { label: 'sqrt', type: 'method', detail: '(x) -> float', template: 'sqrt(${1:x})' },
      { label: 'pi', type: 'property', detail: 'float' }
    ]
  },
  go: {
    fmt: [
      { label: 'Println', type: 'method', detail: '(a ...any) (n int, err error)', template: 'Println(${1:a})' },
      { label: 'Printf', type: 'method', detail: '(format string, a ...any) (n int, err error)', template: 'Printf("${1:%v\\n}", ${2:a})' },
      { label: 'Sprintf', type: 'method', detail: '(format string, a ...any) string', template: 'Sprintf("${1:%v}", ${2:a})' },
      { label: 'Errorf', type: 'method', detail: '(format string, a ...any) error', template: 'Errorf("${1:failed: %w}", ${2:err})' }
    ],
    strings: [
      { label: 'Contains', type: 'method', detail: '(s, substr string) bool', template: 'Contains(${1:s}, "${2:substr}")' },
      { label: 'Split', type: 'method', detail: '(s, sep string) []string', template: 'Split(${1:s}, "${2:,}")' },
      { label: 'Join', type: 'method', detail: '(elems []string, sep string) string', template: 'Join(${1:elems}, "${2:,}")' },
      { label: 'ReplaceAll', type: 'method', detail: '(s, old, new string) string', template: 'ReplaceAll(${1:s}, "${2:old}", "${3:new}")' },
      { label: 'ToLower', type: 'method', detail: '(s string) string', template: 'ToLower(${1:s})' },
      { label: 'ToUpper', type: 'method', detail: '(s string) string', template: 'ToUpper(${1:s})' }
    ],
    os: [
      { label: 'Open', type: 'method', detail: '(name string) (*File, error)', template: 'Open("${1:path}")' },
      { label: 'Create', type: 'method', detail: '(name string) (*File, error)', template: 'Create("${1:path}")' },
      { label: 'ReadFile', type: 'method', detail: '(name string) ([]byte, error)', template: 'ReadFile("${1:path}")' },
      { label: 'WriteFile', type: 'method', detail: '(name string, data []byte, perm FileMode) error', template: 'WriteFile("${1:path}", ${2:data}, 0644)' },
      { label: 'Exit', type: 'method', detail: '(code int)', template: 'Exit(${1:0})' }
    ],
    http: [
      { label: 'Get', type: 'method', detail: '(url string) (resp *Response, err error)', template: 'Get("${1:url}")' },
      { label: 'Post', type: 'method', detail: '(url, contentType string, body io.Reader) (resp *Response, err error)', template: 'Post("${1:url}", "${2:application/json}", ${3:body})' },
      { label: 'HandleFunc', type: 'method', detail: '(pattern string, handler func(ResponseWriter, *Request))', template: 'HandleFunc("${1:/path}", func(w http.ResponseWriter, r *http.Request) {\n\t${0}\n})' },
      { label: 'ListenAndServe', type: 'method', detail: '(addr string, handler Handler) error', template: 'ListenAndServe("${1::8080}", ${2:nil})' }
    ]
  },
  rust: {
    vec: [
      { label: 'new', type: 'method', detail: '() -> Vec<T>', template: 'new()' },
      { label: 'with_capacity', type: 'method', detail: '(capacity: usize) -> Vec<T>', template: 'with_capacity(${1:capacity})' }
    ],
    String: [
      { label: 'from', type: 'method', detail: '(s: &str) -> String', template: 'from("${1:text}")' },
      { label: 'new', type: 'method', detail: '() -> String', template: 'new()' }
    ]
  }
};

RUNTIME_MEMBERS.typescript = RUNTIME_MEMBERS.javascript;
RUNTIME_MEMBERS.javascriptreact = RUNTIME_MEMBERS.javascript;
RUNTIME_MEMBERS.typescriptreact = RUNTIME_MEMBERS.javascript;

const RUNTIME_GLOBALS: Record<string, { label: string; type: 'variable' | 'class' | 'function'; detail: string; template?: string }[]> = {
  javascript: [
    { label: 'console', type: 'variable', detail: 'Console' },
    { label: 'document', type: 'variable', detail: 'Document' },
    { label: 'window', type: 'variable', detail: 'Window' },
    { label: 'Math', type: 'variable', detail: 'Math' },
    { label: 'JSON', type: 'variable', detail: 'JSON' },
    { label: 'Promise', type: 'class', detail: 'Promise<T>', template: 'new Promise((${1:resolve}, ${2:reject}) => {\n\t${0}\n})' },
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
    { label: 'setTimeout', type: 'function', detail: '(handler: Function, timeout?: number): number', template: "setTimeout(() => {\n\t${0}\n}, ${1:1000});" },
    { label: 'setInterval', type: 'function', detail: '(handler: Function, timeout?: number): number', template: "setInterval(() => {\n\t${0}\n}, ${1:1000});" },
    { label: 'setImmediate', type: 'function', detail: '(handler: Function): number', template: "setImmediate(() => {\n\t${0}\n});" },
    { label: 'clearTimeout', type: 'function', detail: '(id: number): void', template: "clearTimeout(${1:id})" },
    { label: 'clearInterval', type: 'function', detail: '(id: number): void', template: "clearInterval(${1:id})" },
    { label: 'requestAnimationFrame', type: 'function', detail: '(callback: FrameRequestCallback): number', template: "requestAnimationFrame((${1:timestamp}) => {\n\t${0}\n});" },
    { label: 'cancelAnimationFrame', type: 'function', detail: '(handle: number): void', template: "cancelAnimationFrame(${1:id})" },
    { label: 'queueMicrotask', type: 'function', detail: '(callback: VoidFunction): void', template: "queueMicrotask(() => {\n\t${0}\n});" },
    { label: 'addEventListener', type: 'function', detail: '(type: string, listener: EventListener): void', template: "addEventListener('${1:click}', (${2:event}) => {\n\t${0}\n});" },
    { label: 'removeEventListener', type: 'function', detail: '(type: string, listener: EventListener): void', template: "removeEventListener('${1:click}', ${2:listener});" },
    { label: 'fetch', type: 'function', detail: '(input: RequestInfo, init?: RequestInit): Promise<Response>', template: "fetch('${1:url}')" },
    { label: 'localStorage', type: 'variable', detail: 'Storage' },
    { label: 'sessionStorage', type: 'variable', detail: 'Storage' },
    { label: 'globalThis', type: 'variable', detail: 'globalThis' }
  ],
  python: [
    { label: 'print', type: 'function', detail: '(*values, sep=" ", end="\\n", flush=False)', template: "print(${1:object})" },
    { label: 'len', type: 'function', detail: '(obj) -> int', template: "len(${1:obj})" },
    { label: 'range', type: 'function', detail: '(stop) or (start, stop[, step])', template: "range(${1:stop})" },
    { label: 'open', type: 'function', detail: '(file, mode="r", encoding=None)', template: "open('${1:file}', '${2:r}', encoding='utf-8')" },
    { label: 'str', type: 'class', detail: 'str(object="") -> str', template: "str(${1:object})" },
    { label: 'int', type: 'class', detail: 'int(x=0) -> int', template: "int(${1:x})" },
    { label: 'float', type: 'class', detail: 'float(x=0.0) -> float', template: "float(${1:x})" },
    { label: 'list', type: 'class', detail: 'list(iterable=()) -> list', template: "list(${1:iterable})" },
    { label: 'dict', type: 'class', detail: 'dict(**kwargs) -> dict', template: "dict(${1:kwargs})" },
    { label: 'set', type: 'class', detail: 'set(iterable=()) -> set', template: "set(${1:iterable})" },
    { label: 'tuple', type: 'class', detail: 'tuple(iterable=()) -> tuple', template: "tuple(${1:iterable})" },
    { label: 'type', type: 'function', detail: 'type(object) -> type', template: "type(${1:object})" },
    { label: 'isinstance', type: 'function', detail: '(object, classinfo) -> bool', template: "isinstance(${1:object}, ${2:classinfo})" },
    { label: 'enumerate', type: 'function', detail: '(iterable, start=0)', template: "enumerate(${1:iterable})" },
    { label: 'zip', type: 'function', detail: '(*iterables)', template: "zip(${1:iterables})" }
  ],
  go: [
    { label: 'make', type: 'function', detail: 'make(t Type, size ...IntegerType) Type', template: "make(${1:type}, ${2:size})" },
    { label: 'append', type: 'function', detail: 'append(slice []Type, elems ...Type) []Type', template: "append(${1:slice}, ${2:elem})" },
    { label: 'len', type: 'function', detail: 'len(v Type) int', template: "len(${1:v})" },
    { label: 'panic', type: 'function', detail: 'panic(v any)', template: "panic(${1:err})" },
    { label: 'recover', type: 'function', detail: 'recover() any', template: "recover()" }
  ]
};

RUNTIME_GLOBALS.typescript = RUNTIME_GLOBALS.javascript;
RUNTIME_GLOBALS.javascriptreact = RUNTIME_GLOBALS.javascript;
RUNTIME_GLOBALS.typescriptreact = RUNTIME_GLOBALS.javascript;

const DOM_EVENT_COMPLETIONS = [
  // Mouse & Pointer
  { label: 'click', detail: 'MouseEvent', info: 'Fires when a pointing device button is pressed and released on a single element.' },
  { label: 'dblclick', detail: 'MouseEvent', info: 'Fires when a pointing device button is clicked twice on a single element.' },
  { label: 'mousedown', detail: 'MouseEvent', info: 'Fires when a pointing device button is pressed on an element.' },
  { label: 'mouseup', detail: 'MouseEvent', info: 'Fires when a pointing device button is released over an element.' },
  { label: 'mousemove', detail: 'MouseEvent', info: 'Fires when a pointing device is moved while over an element.' },
  { label: 'mouseenter', detail: 'MouseEvent', info: 'Fires when a pointing device is moved onto the element that has the listener.' },
  { label: 'mouseleave', detail: 'MouseEvent', info: 'Fires when a pointing device is moved off the element that has the listener.' },
  { label: 'mouseover', detail: 'MouseEvent', info: 'Fires when a pointing device is moved onto an element or one of its children.' },
  { label: 'mouseout', detail: 'MouseEvent', info: 'Fires when a pointing device is moved off an element or one of its children.' },
  { label: 'contextmenu', detail: 'MouseEvent', info: 'Fires when the user attempts to open a context menu (usually right-click).' },
  { label: 'wheel', detail: 'WheelEvent', info: 'Fires when the user rotates a wheel button on a pointing device.' },
  { label: 'pointerdown', detail: 'PointerEvent', info: 'Fires when a pointer becomes active.' },
  { label: 'pointerup', detail: 'PointerEvent', info: 'Fires when a pointer is no longer active.' },
  { label: 'pointermove', detail: 'PointerEvent', info: 'Fires when a pointer changes coordinates.' },
  { label: 'pointerenter', detail: 'PointerEvent', info: 'Fires when a pointer enters an element.' },
  { label: 'pointerleave', detail: 'PointerEvent', info: 'Fires when a pointer leaves an element.' },

  // Keyboard
  { label: 'keydown', detail: 'KeyboardEvent', info: 'Fires when a key is pressed down.' },
  { label: 'keyup', detail: 'KeyboardEvent', info: 'Fires when a key is released.' },
  { label: 'keypress', detail: 'KeyboardEvent', info: 'Fires when a key that produces a character value is pressed.' },

  // Form
  { label: 'submit', detail: 'SubmitEvent', info: 'Fires when a form is submitted.' },
  { label: 'input', detail: 'InputEvent', info: 'Fires synchronously when the value of an input element changes.' },
  { label: 'change', detail: 'Event', info: 'Fires when an alteration to the element value is committed by the user.' },
  { label: 'focus', detail: 'FocusEvent', info: 'Fires when an element has received focus (does not bubble).' },
  { label: 'blur', detail: 'FocusEvent', info: 'Fires when an element has lost focus (does not bubble).' },
  { label: 'focusin', detail: 'FocusEvent', info: 'Fires when an element is about to receive focus (bubbles).' },
  { label: 'focusout', detail: 'FocusEvent', info: 'Fires when an element is about to lose focus (bubbles).' },
  { label: 'reset', detail: 'Event', info: 'Fires when a form is reset.' },
  { label: 'invalid', detail: 'Event', info: 'Fires when a submittable element does not satisfy its constraints.' },

  // Document & Window Lifecycle
  { label: 'DOMContentLoaded', detail: 'Event', info: 'Fires when initial HTML is completely parsed, without waiting for stylesheets/images.' },
  { label: 'load', detail: 'Event', info: 'Fires when the whole page and all dependent resources have loaded.' },
  { label: 'unload', detail: 'Event', info: 'Fires when the document is being unloaded.' },
  { label: 'beforeunload', detail: 'BeforeUnloadEvent', info: 'Fires when window/document is about to be unloaded.' },
  { label: 'resize', detail: 'UIEvent', info: 'Fires when document view has been resized.' },
  { label: 'scroll', detail: 'Event', info: 'Fires when document view or element has been scrolled.' },
  { label: 'error', detail: 'ErrorEvent', info: 'Fires when a resource failed to load or an error occurred.' },
  { label: 'hashchange', detail: 'HashChangeEvent', info: 'Fires when fragment identifier of URL has changed.' },
  { label: 'popstate', detail: 'PopStateEvent', info: 'Fires when active history entry changes.' },

  // Drag & Drop
  { label: 'drag', detail: 'DragEvent', info: 'Fires periodically as an element is dragged.' },
  { label: 'dragstart', detail: 'DragEvent', info: 'Fires when dragging starts.' },
  { label: 'dragend', detail: 'DragEvent', info: 'Fires when dragging ends.' },
  { label: 'dragover', detail: 'DragEvent', info: 'Fires when element is dragged over a drop target.' },
  { label: 'dragenter', detail: 'DragEvent', info: 'Fires when dragged element enters a drop target.' },
  { label: 'dragleave', detail: 'DragEvent', info: 'Fires when dragged element leaves a drop target.' },
  { label: 'drop', detail: 'DragEvent', info: 'Fires when element is dropped on a valid drop target.' },

  // Clipboard
  { label: 'copy', detail: 'ClipboardEvent', info: 'Fires when user initiates a copy action.' },
  { label: 'cut', detail: 'ClipboardEvent', info: 'Fires when user initiates a cut action.' },
  { label: 'paste', detail: 'ClipboardEvent', info: 'Fires when user initiates a paste action.' },

  // Animation & Transition
  { label: 'animationstart', detail: 'AnimationEvent', info: 'Fires when CSS animation starts.' },
  { label: 'animationend', detail: 'AnimationEvent', info: 'Fires when CSS animation completes.' },
  { label: 'animationiteration', detail: 'AnimationEvent', info: 'Fires when CSS animation iteration ends.' },
  { label: 'transitionstart', detail: 'TransitionEvent', info: 'Fires when CSS transition starts.' },
  { label: 'transitionend', detail: 'TransitionEvent', info: 'Fires when CSS transition ends.' },

  // Media
  { label: 'play', detail: 'Event', info: 'Fires when media playback is initiated.' },
  { label: 'pause', detail: 'Event', info: 'Fires when media playback is paused.' },
  { label: 'ended', detail: 'Event', info: 'Fires when media playback has finished.' },
  { label: 'timeupdate', detail: 'Event', info: 'Fires when currentTime attribute has updated.' },
  { label: 'volumechange', detail: 'Event', info: 'Fires when volume changes.' },
  { label: 'canplay', detail: 'Event', info: 'Fires when media can play.' },

  // Network & Storage
  { label: 'online', detail: 'Event', info: 'Fires when browser gains network connectivity.' },
  { label: 'offline', detail: 'Event', info: 'Fires when browser loses network connectivity.' },
  { label: 'storage', detail: 'StorageEvent', info: 'Fires when storage is modified from another window.' }
];

const HTML_TAG_COMPLETIONS = [
  'div', 'span', 'p', 'a', 'button', 'input', 'form', 'textarea', 'select', 'option',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody',
  'tr', 'th', 'td', 'img', 'svg', 'canvas', 'video', 'audio', 'iframe', 'label',
  'header', 'nav', 'main', 'section', 'article', 'aside', 'footer', 'dialog', 'template'
];

const HTML_ATTR_COMPLETIONS = [
  'id', 'class', 'style', 'type', 'name', 'value', 'placeholder', 'src', 'href',
  'alt', 'title', 'disabled', 'checked', 'readonly', 'required', 'hidden',
  'target', 'rel', 'role', 'aria-label', 'aria-hidden', 'tabindex', 'autocomplete'
];

export function createLocalCompletionSource(getLanguageId?: () => string) {
  return (context: CompletionContext): CompletionResult | null => {
    const languageId = getLanguageId ? getLanguageId().toLowerCase() : '';

    // 0. Context-aware Argument Completions inside function calls
    if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(languageId)) {
      // Inside addEventListener / removeEventListener
      const eventArgMatch = context.matchBefore(/(?:addEventListener|removeEventListener|attachEvent)\s*\(\s*['"]([a-zA-Z0-9_-]*)$/);
      if (eventArgMatch) {
        const parts = eventArgMatch.text.split(/['"]/);
        const query = (parts[parts.length - 1] || '').toLowerCase();
        const from = context.pos - query.length;
        const options: Completion[] = DOM_EVENT_COMPLETIONS
          .filter((ev) => !query || ev.label.toLowerCase().startsWith(query))
          .map((ev) => ({
            label: ev.label,
            type: 'constant',
            detail: ev.detail,
            info: ev.info,
            boost: 95
          }));
        if (options.length > 0) {
          return { from, options, filter: true };
        }
      }

      // Inside addEventListener( without quotes yet
      const eventOpenMatch = context.matchBefore(/(?:addEventListener|removeEventListener|attachEvent)\s*\(\s*$/);
      if (eventOpenMatch) {
        const options: Completion[] = DOM_EVENT_COMPLETIONS.map((ev) => ({
          label: `'${ev.label}'`,
          apply: `'${ev.label}'`,
          type: 'constant',
          detail: ev.detail,
          info: ev.info,
          boost: 95
        }));
        return { from: context.pos, options, filter: true };
      }

      // Inside document.createElement('...')
      const createElementMatch = context.matchBefore(/createElement\s*\(\s*['"]([a-zA-Z0-9_-]*)$/);
      if (createElementMatch) {
        const parts = createElementMatch.text.split(/['"]/);
        const query = (parts[parts.length - 1] || '').toLowerCase();
        const from = context.pos - query.length;
        const options: Completion[] = HTML_TAG_COMPLETIONS
          .filter((tag) => !query || tag.toLowerCase().startsWith(query))
          .map((tag) => ({
            label: tag,
            type: 'type',
            detail: 'HTML Element',
            boost: 90
          }));
        if (options.length > 0) {
          return { from, options, filter: true };
        }
      }

      // Inside setAttribute / getAttribute
      const attrMatch = context.matchBefore(/(?:setAttribute|getAttribute|removeAttribute|hasAttribute)\s*\(\s*['"]([a-zA-Z0-9_-]*)$/);
      if (attrMatch) {
        const parts = attrMatch.text.split(/['"]/);
        const query = (parts[parts.length - 1] || '').toLowerCase();
        const from = context.pos - query.length;
        const options: Completion[] = HTML_ATTR_COMPLETIONS
          .filter((attr) => !query || attr.toLowerCase().startsWith(query))
          .map((attr) => ({
            label: attr,
            type: 'property',
            detail: 'HTML Attribute',
            boost: 90
          }));
        if (options.length > 0) {
          return { from, options, filter: true };
        }
      }
    }

    // 1. Check for member expression: e.g. "console." or "console.lo" or "document.get" or "element."
    const memberMatch = context.matchBefore(/([a-zA-Z_$][a-zA-Z0-9_$]*)\.([a-zA-Z_$][a-zA-Z0-9_$]*)?$/);
    if (memberMatch) {
      const parts = memberMatch.text.split('.');
      const rawObjName = parts[0].toLowerCase();
      const propPrefix = (parts[1] || '').toLowerCase();
      const langMembers = RUNTIME_MEMBERS[languageId];

      const DOM_ELEMENT_ALIASES = new Set([
        'element', 'el', 'btn', 'button', 'node', 'target', 'item', 'container', 'card', 'box', 'div', 'input', 'form'
      ]);
      const ARRAY_ALIASES = new Set([
        'items', 'list', 'elements', 'data', 'arr', 'array', 'rows', 'lines', 'users', 'posts', 'results', 'values'
      ]);
      const STRING_ALIASES = new Set([
        'str', 'text', 'name', 'msg', 'message', 'line', 'title', 'key', 'val', 'query', 'url', 'path'
      ]);

      let resolvedObjName = rawObjName;
      if (DOM_ELEMENT_ALIASES.has(rawObjName)) {
        resolvedObjName = 'element';
      } else if (ARRAY_ALIASES.has(rawObjName)) {
        resolvedObjName = 'array_instance';
      } else if (STRING_ALIASES.has(rawObjName)) {
        resolvedObjName = 'string_instance';
      }

      if (langMembers && langMembers[resolvedObjName]) {
        const memberOptions: Completion[] = [];
        for (const m of langMembers[resolvedObjName]) {
          if (!propPrefix || m.label.toLowerCase().startsWith(propPrefix)) {
            const cleanLabel = m.label.replace(/^\.+/, '');
            const cmItem: Completion = {
              label: cleanLabel,
              type: m.type,
              detail: m.detail,
              boost: 60
            };
            if (m.template) {
              const cleanTemplate = m.template.replace(/^\.+/, '');
              cmItem.apply = snippet(cleanTemplate);
            } else if (m.type === 'method') {
              cmItem.apply = snippet(`${cleanLabel}(\${1})\${0}`);
            }
            memberOptions.push(cmItem);
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
          const cmItem: Completion = {
            label: g.label,
            type: g.type,
            detail: g.detail,
            boost: g.label.toLowerCase() === query ? 50 : 35
          };
          if (g.template) {
            cmItem.apply = snippet(g.template);
          } else if (g.type === 'function') {
            cmItem.apply = snippet(`${g.label}(\${1})\${0}`);
          }
          options.push(cmItem);
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
