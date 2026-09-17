/**
 * LSP Types & JSON-RPC 2.0 Interface Definitions
 * Implements core Language Server Protocol types for Gitero IDE
 */

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface Position {
  /** 0-indexed line number */
  line: number;
  /** 0-indexed character offset within the line */
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Location {
  uri: string;
  range: Range;
}

export interface TextDocumentIdentifier {
  uri: string;
}

export interface VersionedTextDocumentIdentifier extends TextDocumentIdentifier {
  version: number;
}

export interface TextDocumentItem {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export interface TextDocumentContentChangeEvent {
  range?: Range;
  rangeLength?: number;
  text: string;
}

export enum CompletionItemKind {
  Text = 1,
  Method = 2,
  Function = 3,
  Constructor = 4,
  Field = 5,
  Variable = 6,
  Class = 7,
  Interface = 8,
  Module = 9,
  Property = 10,
  Unit = 11,
  Value = 12,
  Enum = 13,
  Keyword = 14,
  Snippet = 15,
  Color = 16,
  File = 17,
  Reference = 18,
  Folder = 19,
  EnumMember = 20,
  Constant = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25
}

export interface MarkupContent {
  kind: 'plaintext' | 'markdown';
  value: string;
}

export interface CompletionItem {
  label: string;
  kind?: CompletionItemKind;
  detail?: string;
  documentation?: string | MarkupContent;
  sortText?: string;
  filterText?: string;
  insertText?: string;
  insertTextFormat?: number; // 1 = PlainText, 2 = Snippet
  textEdit?: {
    range: Range;
    newText: string;
  };
}

export interface CompletionList {
  isIncomplete: boolean;
  items: CompletionItem[];
}

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4
}

export interface Diagnostic {
  range: Range;
  severity?: DiagnosticSeverity;
  code?: number | string;
  source?: string;
  message: string;
}

export interface PublishDiagnosticsParams {
  uri: string;
  version?: number;
  diagnostics: Diagnostic[];
}

export interface Hover {
  contents: string | MarkupContent | Array<string | MarkupContent>;
  range?: Range;
}

export interface ServerConfig {
  id: string;
  name: string;
  languages: string[];
  defaultCommand: string;
  defaultArgs: string[];
  installGuide: string;
  commandAliases?: string[];
}

export type LspServerStatus = 'stopped' | 'starting' | 'ready' | 'error';

export interface LspStatusEvent {
  languageId: string;
  status: LspServerStatus;
  serverName?: string;
  error?: string;
}
