/**
 * Symbol Rename Inline Popover Extension for CodeMirror 6
 * Triggers on F2 to provide cross-file symbol renaming via LSP textDocument/rename.
 */

import { Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { lspClient } from '../services/lsp/lspClient';
import { notificationService } from '../services/notification';

let activeRenameWidget: HTMLElement | null = null;

function removeRenameWidget() {
  if (activeRenameWidget && activeRenameWidget.parentElement) {
    activeRenameWidget.parentElement.removeChild(activeRenameWidget);
    activeRenameWidget = null;
  }
}

export function createRenameExtension(
  getFilePath: () => string | null,
  getLanguageId: () => string,
  flushDocChanges?: () => void
): Extension {
  const triggerRename = async (view: EditorView): Promise<boolean> => {
    removeRenameWidget();

    const filePath = getFilePath();
    const languageId = getLanguageId();
    if (!filePath || !languageId) return false;

    const head = view.state.selection.main.head;
    const word = view.state.wordAt(head);
    if (!word) {
      notificationService.warn('Rename', 'No symbol at cursor position to rename.');
      return false;
    }

    const oldName = view.state.doc.sliceString(word.from, word.to);
    const coords = view.coordsAtPos(word.from);
    if (!coords) return false;

    if (flushDocChanges) {
      flushDocChanges();
    }

    const lineObj = view.state.doc.lineAt(head);
    const line = lineObj.number - 1;
    const character = head - lineObj.from;

    showRenameInput(view, coords, oldName, async (newName) => {
      if (!newName || newName === oldName) return;

      try {
        const edit = await lspClient.requestRename(filePath, languageId, line, character, newName);
        if (!edit) {
          notificationService.warn('Rename Failed', `Could not rename symbol '${oldName}'.`);
          return;
        }

        const success = await lspClient.applyWorkspaceEdit(edit);
        if (success) {
          notificationService.success('Symbol Renamed', `Renamed '${oldName}' to '${newName}'.`, undefined, 3000);
          view.focus();
        }
      } catch (err: any) {
        notificationService.error('Rename Error', err?.message || String(err));
      }
    });

    return true;
  };

  return [
    keymap.of([
      {
        key: 'F2',
        run: (view) => {
          triggerRename(view);
          return true;
        }
      }
    ])
  ];
}

function showRenameInput(
  view: EditorView,
  coords: { left: number; top: number; bottom: number },
  initialValue: string,
  onCommit: (val: string) => Promise<void>
) {
  removeRenameWidget();

  const container = document.createElement('div');
  container.className = 'cm-rename-popover';
  container.style.position = 'fixed';
  container.style.left = `${coords.left}px`;
  container.style.top = `${coords.bottom + 4}px`;
  container.style.zIndex = '99999';

  container.innerHTML = `
    <div class="cm-rename-box">
      <span class="cm-rename-label">Rename Symbol</span>
      <input type="text" class="cm-rename-input" spellcheck="false" autocomplete="off" />
    </div>
  `;

  const input = container.querySelector('.cm-rename-input') as HTMLInputElement;
  input.value = initialValue;

  const handleKeyDown = async (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const val = input.value.trim();
      removeRenameWidget();
      await onCommit(val);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      removeRenameWidget();
      view.focus();
    }
  };

  input.addEventListener('keydown', handleKeyDown);

  const handleOutsideClick = (e: MouseEvent) => {
    if (!container.contains(e.target as Node)) {
      removeRenameWidget();
      document.removeEventListener('mousedown', handleOutsideClick);
    }
  };

  setTimeout(() => {
    document.addEventListener('mousedown', handleOutsideClick);
  }, 50);

  document.body.appendChild(container);
  activeRenameWidget = container;
  input.focus();
  input.select();
}
