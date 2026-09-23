/**
 * Code Actions & Quick Fixes Extension for CodeMirror 6
 * Queries LSP server for compiler/lint fixes and refactorings on Alt+Enter / Ctrl+Shift+.
 */

import { Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { lspClient, uriToPath } from '../services/lsp/lspClient';
import { CodeAction, Diagnostic, Range } from '../services/lsp/lspTypes';
import { notificationService } from '../services/notification';

let activePopover: HTMLElement | null = null;

function removeActivePopover() {
  if (activePopover && activePopover.parentElement) {
    activePopover.parentElement.removeChild(activePopover);
    activePopover = null;
  }
}

export function createCodeActionsExtension(
  getFilePath: () => string | null,
  getLanguageId: () => string,
  flushDocChanges?: () => void
): Extension {
  const triggerCodeActions = async (view: EditorView): Promise<boolean> => {
    removeActivePopover();

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

    const range: Range = {
      start: { line, character },
      end: { line, character }
    };

    // Gather diagnostics for the current line
    const allDiags = lspClient.getDiagnostics(filePath);
    const lineDiags = allDiags.filter((d) => d.range.start.line <= line && d.range.end.line >= line);

    try {
      const actions = await lspClient.requestCodeActions(filePath, languageId, range, lineDiags);
      if (!actions || actions.length === 0) {
        notificationService.info('Quick Fix', 'No code actions or quick fixes available at cursor position.', undefined, 2500);
        return false;
      }

      showCodeActionsPopover(view, actions, filePath);
      return true;
    } catch (err) {
      console.warn('[Code Actions Error]', err);
      return false;
    }
  };

  return [
    keymap.of([
      {
        key: 'Alt-Enter',
        run: (view) => {
          triggerCodeActions(view);
          return true;
        }
      },
      {
        key: 'Ctrl-Shift-.',
        run: (view) => {
          triggerCodeActions(view);
          return true;
        }
      }
    ]),
    EditorView.domEventHandlers({
      click: () => {
        removeActivePopover();
        return false;
      }
    })
  ];
}

function showCodeActionsPopover(view: EditorView, actions: CodeAction[], filePath: string) {
  removeActivePopover();

  const coords = view.coordsAtPos(view.state.selection.main.head);
  if (!coords) return;

  const popover = document.createElement('div');
  popover.className = 'cm-code-actions-popover';
  popover.style.position = 'fixed';
  popover.style.left = `${coords.left}px`;
  popover.style.top = `${coords.bottom + 6}px`;
  popover.style.zIndex = '99999';

  popover.innerHTML = `
    <div class="cm-code-actions-header">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      <span>Quick Fix & Code Actions</span>
    </div>
    <div class="cm-code-actions-list" role="menu"></div>
  `;

  const listEl = popover.querySelector('.cm-code-actions-list') as HTMLElement;
  let selectedIdx = 0;

  actions.forEach((act, idx) => {
    const item = document.createElement('div');
    item.className = idx === 0 ? 'cm-code-action-item active' : 'cm-code-action-item';
    item.setAttribute('role', 'menuitem');
    item.innerHTML = `
      <span class="cm-code-action-icon">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </span>
      <span class="cm-code-action-title">${act.title}</span>
      ${act.isPreferred ? '<span class="cm-code-action-preferred">Preferred</span>' : ''}
    `;

    item.addEventListener('click', async () => {
      await executeCodeAction(view, act);
      removeActivePopover();
    });

    listEl.appendChild(item);
  });

  const handleKeyDown = async (e: KeyboardEvent) => {
    const items = listEl.querySelectorAll('.cm-code-action-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[selectedIdx]?.classList.remove('active');
      selectedIdx = (selectedIdx + 1) % items.length;
      items[selectedIdx]?.classList.add('active');
      (items[selectedIdx] as HTMLElement)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[selectedIdx]?.classList.remove('active');
      selectedIdx = (selectedIdx - 1 + items.length) % items.length;
      items[selectedIdx]?.classList.add('active');
      (items[selectedIdx] as HTMLElement)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      document.removeEventListener('keydown', handleKeyDown);
      removeActivePopover();
      await executeCodeAction(view, actions[selectedIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      document.removeEventListener('keydown', handleKeyDown);
      removeActivePopover();
      view.focus();
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  document.body.appendChild(popover);
  activePopover = popover;
}

async function executeCodeAction(view: EditorView, action: CodeAction) {
  if (action.edit) {
    await lspClient.applyWorkspaceEdit(action.edit);
    notificationService.success('Quick Fix Applied', action.title, undefined, 2500);
    view.focus();
  } else if (action.command) {
    notificationService.info('Action Executed', action.title, undefined, 2500);
  }
}
