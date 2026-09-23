/**
 * Signature Help / Parameter Hints Extension for CodeMirror 6
 * Displays active function signatures, parameter highlighting, and documentation
 * when typing '(' or ',' or triggering via shortcut (Ctrl+Shift+Space).
 */

import { Extension, StateField, StateEffect } from '@codemirror/state';
import { EditorView, Tooltip, showTooltip, keymap } from '@codemirror/view';
import { lspClient } from '../services/lsp/lspClient';
import { SignatureHelp, SignatureInformation, ParameterInformation } from '../services/lsp/lspTypes';
import { preferencesService } from '../services/preferences';
import { marked } from 'marked';

// Effect to set or clear signature help tooltip
const setSignatureHelpEffect = StateEffect.define<Tooltip | null>();

const signatureHelpField = StateField.define<Tooltip | null>({
  create() {
    return null;
  },
  update(tooltip, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSignatureHelpEffect)) {
        return effect.value;
      }
    }
    // If doc changed or cursor moved significantly, keep until refreshed or clear if empty
    return tooltip;
  },
  provide: (f) => showTooltip.computeN([f], (state) => {
    const val = state.field(f);
    return val ? [val] : [];
  })
});

function formatMarkdownOrText(doc: string | { value: string } | undefined): string {
  if (!doc) return '';
  const text = typeof doc === 'string' ? doc : doc.value;
  try {
    return marked.parse(text) as string;
  } catch {
    return text;
  }
}

function createSignatureDOM(help: SignatureHelp): HTMLElement {
  const dom = document.createElement('div');
  dom.className = 'cm-signature-help-tooltip';

  const activeSigIdx = help.activeSignature ?? 0;
  const signature: SignatureInformation | undefined = help.signatures[activeSigIdx];

  if (!signature) {
    dom.textContent = 'No signature details available';
    return dom;
  }

  const activeParamIdx = signature.activeParameter ?? help.activeParameter ?? 0;
  const parameters = signature.parameters || [];
  const activeParam: ParameterInformation | undefined = parameters[activeParamIdx];

  // Header: Signature count (if multiple overloads)
  const header = document.createElement('div');
  header.className = 'cm-sig-header';

  if (help.signatures.length > 1) {
    const counter = document.createElement('span');
    counter.className = 'cm-sig-counter';
    counter.textContent = `${activeSigIdx + 1} of ${help.signatures.length}`;
    header.appendChild(counter);
  }

  // Signature Label with active parameter highlighted
  const labelEl = document.createElement('div');
  labelEl.className = 'cm-sig-label';

  let renderedLabel = false;
  if (activeParam && typeof activeParam.label === 'string') {
    const idx = signature.label.indexOf(activeParam.label);
    if (idx !== -1) {
      const before = signature.label.slice(0, idx);
      const paramText = activeParam.label;
      const after = signature.label.slice(idx + paramText.length);

      const beforeSpan = document.createElement('span');
      beforeSpan.textContent = before;
      const activeSpan = document.createElement('span');
      activeSpan.className = 'cm-sig-param-active';
      activeSpan.textContent = paramText;
      const afterSpan = document.createElement('span');
      afterSpan.textContent = after;

      labelEl.appendChild(beforeSpan);
      labelEl.appendChild(activeSpan);
      labelEl.appendChild(afterSpan);
      renderedLabel = true;
    }
  } else if (activeParam && Array.isArray(activeParam.label) && activeParam.label.length === 2) {
    const [start, end] = activeParam.label;
    const before = signature.label.slice(0, start);
    const paramText = signature.label.slice(start, end);
    const after = signature.label.slice(end);

    const beforeSpan = document.createElement('span');
    beforeSpan.textContent = before;
    const activeSpan = document.createElement('span');
    activeSpan.className = 'cm-sig-param-active';
    activeSpan.textContent = paramText;
    const afterSpan = document.createElement('span');
    afterSpan.textContent = after;

    labelEl.appendChild(beforeSpan);
    labelEl.appendChild(activeSpan);
    labelEl.appendChild(afterSpan);
    renderedLabel = true;
  }

  if (!renderedLabel) {
    labelEl.textContent = signature.label;
  }
  header.appendChild(labelEl);
  dom.appendChild(header);

  // Parameter documentation
  if (activeParam?.documentation) {
    const paramDoc = document.createElement('div');
    paramDoc.className = 'cm-sig-param-doc';
    paramDoc.innerHTML = formatMarkdownOrText(activeParam.documentation);
    dom.appendChild(paramDoc);
  } else if (signature.documentation) {
    const sigDoc = document.createElement('div');
    sigDoc.className = 'cm-sig-doc';
    sigDoc.innerHTML = formatMarkdownOrText(signature.documentation);
    dom.appendChild(sigDoc);
  }

  return dom;
}

let activeDebounceTimer: any = null;

export function createSignatureHelpExtension(
  getFilePath: () => string | null,
  getLanguageId: () => string,
  flushDocChanges?: () => void
): Extension {
  const triggerSignatureHelp = async (view: EditorView, triggerChar?: string) => {
    if (preferencesService.get('lsp.signatureHelp.enabled') === false) {
      view.dispatch({ effects: setSignatureHelpEffect.of(null) });
      return;
    }

    const filePath = getFilePath();
    const languageId = getLanguageId();
    if (!filePath || !languageId) {
      view.dispatch({ effects: setSignatureHelpEffect.of(null) });
      return;
    }

    if (flushDocChanges) {
      flushDocChanges();
    }

    const head = view.state.selection.main.head;
    const lineObj = view.state.doc.lineAt(head);
    const line = lineObj.number - 1;
    const character = head - lineObj.from;

    try {
      const help = await lspClient.requestSignatureHelp(filePath, languageId, line, character, triggerChar);
      if (!help || !help.signatures || help.signatures.length === 0) {
        view.dispatch({ effects: setSignatureHelpEffect.of(null) });
        return;
      }

      const tooltip: Tooltip = {
        pos: head,
        above: true,
        strictSide: true,
        create() {
          return { dom: createSignatureDOM(help) };
        }
      };

      view.dispatch({ effects: setSignatureHelpEffect.of(tooltip) });
    } catch {
      view.dispatch({ effects: setSignatureHelpEffect.of(null) });
    }
  };

  return [
    signatureHelpField,
    EditorView.domEventHandlers({
      keydown: (evt, view) => {
        if (evt.key === 'Escape') {
          if (view.state.field(signatureHelpField, false)) {
            view.dispatch({ effects: setSignatureHelpEffect.of(null) });
            return true;
          }
        }
        return false;
      }
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        // Inspect inserted text
        let insertedChar = '';
        update.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
          insertedChar += inserted.toString();
        });

        if (insertedChar.includes('(') || insertedChar.includes(',')) {
          clearTimeout(activeDebounceTimer);
          activeDebounceTimer = setTimeout(() => {
            triggerSignatureHelp(update.view, insertedChar.includes('(') ? '(' : ',');
          }, 100);
        } else if (insertedChar.includes(')')) {
          update.view.dispatch({ effects: setSignatureHelpEffect.of(null) });
        } else if (update.view.state.field(signatureHelpField, false)) {
          // Re-query signature help to track argument position
          clearTimeout(activeDebounceTimer);
          activeDebounceTimer = setTimeout(() => {
            triggerSignatureHelp(update.view);
          }, 150);
        }
      } else if (update.selectionSet && update.view.state.field(signatureHelpField, false)) {
        clearTimeout(activeDebounceTimer);
        activeDebounceTimer = setTimeout(() => {
          triggerSignatureHelp(update.view);
        }, 150);
      }
    }),
    keymap.of([
      {
        key: 'Ctrl-Shift-Space',
        run: (view) => {
          triggerSignatureHelp(view);
          return true;
        }
      }
    ])
  ];
}
