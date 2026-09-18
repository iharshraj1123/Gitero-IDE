/**
 * CodeMirror 6 LSP & Intelligence Extension
 * Integrates LSP autocompletion, real-time diagnostics, hover tooltips, and go-to-definition.
 */

import { Extension } from '@codemirror/state';
import { EditorView, hoverTooltip, keymap } from '@codemirror/view';
import { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { setDiagnostics, Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { lspClient, pathToUri, uriToPath } from '../services/lsp/lspClient';
import { CompletionItem, CompletionItemKind, Diagnostic, DiagnosticSeverity, Location } from '../services/lsp/lspTypes';
import { createLocalCompletionSource } from './localCompletion';
import { createSnippetCompletionSource } from './snippets';
import { marked } from 'marked';

// Map LSP CompletionItemKind to CodeMirror completion type strings
function mapCompletionKind(kind?: CompletionItemKind): string {
  switch (kind) {
    case CompletionItemKind.Method:
      return 'method';
    case CompletionItemKind.Function:
    case CompletionItemKind.Constructor:
      return 'function';
    case CompletionItemKind.Field:
    case CompletionItemKind.Property:
      return 'property';
    case CompletionItemKind.Variable:
      return 'variable';
    case CompletionItemKind.Class:
    case CompletionItemKind.Interface:
    case CompletionItemKind.Struct:
      return 'class';
    case CompletionItemKind.Module:
      return 'namespace';
    case CompletionItemKind.Keyword:
      return 'keyword';
    case CompletionItemKind.Snippet:
      return 'snippet';
    case CompletionItemKind.Constant:
      return 'constant';
    case CompletionItemKind.Enum:
    case CompletionItemKind.EnumMember:
      return 'enum';
    case CompletionItemKind.TypeParameter:
      return 'type';
    default:
      return 'text';
  }
}

/**
 * Creates the composite autocompletion source querying LSP first, falling back to local tokens & snippets.
 */
export function createCompositeCompletionSource(
  getFilePath: () => string | null,
  getLanguageId: () => string,
  flushDocChanges?: () => void
) {
  const localSource = createLocalCompletionSource(getLanguageId);
  const snippetSource = createSnippetCompletionSource(getLanguageId);

  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const filePath = getFilePath();
    const languageId = getLanguageId();

    const word = context.matchBefore(/[a-zA-Z_$][a-zA-Z0-9_$]*/);
    const triggerChar = context.matchBefore(/[.:>]/);

    if (!word && !triggerChar && !context.explicit) {
      return null;
    }

    // Try LSP completions if file is active
    if (filePath && languageId) {
      // Synchronously flush any pending document changes so the LSP server AST is 100% in sync
      if (flushDocChanges) {
        flushDocChanges();
      }

      const lineObj = context.state.doc.lineAt(context.pos);
      const line = lineObj.number - 1;
      const character = context.pos - lineObj.from;

      try {
        const { items: lspItems, isIncomplete } = await lspClient.requestCompletion(filePath, languageId, line, character);
        if (lspItems && lspItems.length > 0) {
          const mapped: Completion[] = lspItems.map((item) => {
            const cmItem: Completion = {
              label: item.label,
              type: mapCompletionKind(item.kind),
              detail: item.detail,
              boost: item.kind === CompletionItemKind.Method || item.kind === CompletionItemKind.Function ? 40 : 20
            };

            // Format documentation preview
            if (item.documentation) {
              const docText = typeof item.documentation === 'string'
                ? item.documentation
                : item.documentation.value;
              cmItem.info = () => {
                const dom = document.createElement('div');
                dom.className = 'cm-completion-doc';
                try {
                  dom.innerHTML = marked.parse(docText) as string;
                } catch {
                  dom.textContent = docText;
                }
                return dom;
              };
            }

            if (item.insertText) {
              cmItem.apply = item.insertText;
            }

            return cmItem;
          });

          // Merge with snippets
          const snippetRes = snippetSource(context);
          if (snippetRes && snippetRes.options) {
            mapped.push(...snippetRes.options);
          }

          return {
            from: word ? word.from : context.pos,
            options: mapped,
            validFor: isIncomplete ? undefined : /^[\w$]*$/,
            filter: true
          };
        }
      } catch (err) {
        console.debug('[LSP Completion Error]', err);
      }
    }

    // Fallback to local completions + snippets
    const localRes = localSource(context);
    const snipRes = snippetSource(context);

    const mergedOptions: Completion[] = [];
    if (localRes?.options) mergedOptions.push(...localRes.options);
    if (snipRes?.options) mergedOptions.push(...snipRes.options);

    if (mergedOptions.length === 0) return null;

    return {
      from: localRes?.from ?? (word ? word.from : context.pos),
      options: mergedOptions,
      validFor: /^[\w$]*$/,
      filter: true
    };
  };
}

/**
 * Creates hover tooltip inspector querying LSP for type signatures and docs.
 */
export function createLspHoverExtension(
  getFilePath: () => string | null,
  getLanguageId: () => string,
  flushDocChanges?: () => void
): Extension {
  return hoverTooltip(async (view: EditorView, pos: number) => {
    const filePath = getFilePath();
    const languageId = getLanguageId();
    if (!filePath || !languageId) return null;

    if (flushDocChanges) {
      flushDocChanges();
    }

    const lineObj = view.state.doc.lineAt(pos);
    const line = lineObj.number - 1;
    const character = pos - lineObj.from;

    try {
      const hover = await lspClient.requestHover(filePath, languageId, line, character);
      if (!hover || !hover.contents) return null;

      let contentStr = '';
      if (typeof hover.contents === 'string') {
        contentStr = hover.contents;
      } else if (Array.isArray(hover.contents)) {
        contentStr = hover.contents.map((c) => (typeof c === 'string' ? c : c.value)).join('\n\n');
      } else if ('value' in hover.contents) {
        contentStr = hover.contents.value;
      }

      if (!contentStr.trim()) return null;

      let from = pos;
      let to = pos;
      if (hover.range) {
        const startLine = view.state.doc.line(Math.min(view.state.doc.lines, hover.range.start.line + 1));
        const endLine = view.state.doc.line(Math.min(view.state.doc.lines, hover.range.end.line + 1));
        from = Math.min(view.state.doc.length, startLine.from + hover.range.start.character);
        to = Math.min(view.state.doc.length, endLine.from + hover.range.end.character);
      } else {
        const word = view.state.wordAt(pos);
        if (word) {
          from = word.from;
          to = word.to;
        }
      }

      return {
        pos: from,
        end: to,
        above: true,
        create() {
          const dom = document.createElement('div');
          dom.className = 'cm-lsp-hover-tooltip';
          try {
            dom.innerHTML = marked.parse(contentStr) as string;
          } catch {
            dom.textContent = contentStr;
          }
          return { dom };
        }
      };
    } catch {
      return null;
    }
  });
}

/**
 * Dispatches diagnostics to CodeMirror EditorView from LSP.
 */
export function updateViewDiagnostics(view: EditorView, filePath: string, diagnostics: Diagnostic[]) {
  const currentDoc = view.state.doc;
  const cmDiagnostics: CmDiagnostic[] = [];

  for (const diag of diagnostics) {
    try {
      const startLineNum = Math.min(currentDoc.lines, diag.range.start.line + 1);
      const endLineNum = Math.min(currentDoc.lines, diag.range.end.line + 1);

      const startLine = currentDoc.line(startLineNum);
      const endLine = currentDoc.line(endLineNum);

      const from = Math.min(currentDoc.length, startLine.from + diag.range.start.character);
      const to = Math.min(currentDoc.length, endLine.from + diag.range.end.character);

      let severity: 'error' | 'warning' | 'info' | 'hint' = 'error';
      if (diag.severity === DiagnosticSeverity.Warning) severity = 'warning';
      else if (diag.severity === DiagnosticSeverity.Information) severity = 'info';
      else if (diag.severity === DiagnosticSeverity.Hint) severity = 'hint';

      cmDiagnostics.push({
        from,
        to: Math.max(from + 1, to),
        severity,
        message: diag.message,
        source: diag.source || 'LSP'
      });
    } catch (err) {
      console.warn('[LSP Diagnostics Error]', err);
    }
  }

  view.dispatch(setDiagnostics(view.state, cmDiagnostics));
}

export type NavigateToLocationHandler = (filePath: string, line: number, col: number) => void;

/**
 * Creates Go to Definition keymap and navigation handlers.
 */
export function createLspDefinitionExtension(
  getFilePath: () => string | null,
  getLanguageId: () => string,
  onNavigate: NavigateToLocationHandler,
  flushDocChanges?: () => void
): Extension {
  const triggerDefinition = async (view: EditorView): Promise<boolean> => {
    const filePath = getFilePath();
    const languageId = getLanguageId();
    if (!filePath || !languageId) return false;

    if (flushDocChanges) {
      flushDocChanges();
    }

    const head = view.state.selection.main.head;
    const lineObj = view.state.doc.lineAt(head);
    const line = lineObj.number - 1;
    const character = head - lineObj.from;

    try {
      const result = await lspClient.requestDefinition(filePath, languageId, line, character);
      if (!result) return false;

      const loc: Location = Array.isArray(result) ? result[0] : result;
      if (!loc || !loc.uri) return false;

      const targetPath = uriToPath(loc.uri);
      const targetLine = loc.range.start.line + 1;
      const targetCol = loc.range.start.character + 1;

      onNavigate(targetPath, targetLine, targetCol);
      return true;
    } catch (err) {
      console.warn('[Go to Definition Error]', err);
      return false;
    }
  };

  return [
    keymap.of([
      {
        key: 'F12',
        run: (view) => {
          triggerDefinition(view);
          return true;
        }
      }
    ]),
    EditorView.domEventHandlers({
      click: (evt, view) => {
        if (evt.ctrlKey || evt.metaKey) {
          const pos = view.posAtCoords({ x: evt.clientX, y: evt.clientY });
          if (pos !== null) {
            view.dispatch({ selection: { anchor: pos } });
            triggerDefinition(view);
            evt.preventDefault();
          }
        }
      }
    })
  ];
}
