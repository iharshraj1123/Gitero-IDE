/**
 * Find All References Peek Panel Extension for CodeMirror 6
 * Triggers on Shift+F12 to locate and navigate all usages across the workspace.
 */

import { Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { lspClient, uriToPath } from '../services/lsp/lspClient';
import { Location } from '../services/lsp/lspTypes';
import { fsService } from '../services/fs';
import { notificationService } from '../services/notification';
import { NavigateToLocationHandler } from './lspExtension';

let activeReferencesPanel: HTMLElement | null = null;

function removeReferencesPanel() {
  if (activeReferencesPanel && activeReferencesPanel.parentElement) {
    activeReferencesPanel.parentElement.removeChild(activeReferencesPanel);
    activeReferencesPanel = null;
  }
}

export function createReferencesExtension(
  getFilePath: () => string | null,
  getLanguageId: () => string,
  onNavigate: NavigateToLocationHandler,
  flushDocChanges?: () => void
): Extension {
  const triggerReferences = async (view: EditorView): Promise<boolean> => {
    removeReferencesPanel();

    const filePath = getFilePath();
    const languageId = getLanguageId();
    if (!filePath || !languageId) return false;

    const head = view.state.selection.main.head;
    const word = view.state.wordAt(head);
    const symbolName = word ? view.state.doc.sliceString(word.from, word.to) : 'Symbol';

    if (flushDocChanges) {
      flushDocChanges();
    }

    const lineObj = view.state.doc.lineAt(head);
    const line = lineObj.number - 1;
    const character = head - lineObj.from;

    try {
      const locations = await lspClient.requestReferences(filePath, languageId, line, character);
      if (!locations || locations.length === 0) {
        notificationService.info('References', `No references found for '${symbolName}'.`, undefined, 2500);
        return false;
      }

      await showReferencesPanel(view, symbolName, locations, onNavigate);
      return true;
    } catch (err: any) {
      notificationService.warn('References', err?.message || 'Could not locate references.');
      return false;
    }
  };

  return [
    keymap.of([
      {
        key: 'Shift-F12',
        run: (view) => {
          triggerReferences(view);
          return true;
        }
      }
    ])
  ];
}

interface GroupedLocation {
  filePath: string;
  locations: { loc: Location; previewText: string }[];
}

async function showReferencesPanel(
  view: EditorView,
  symbolName: string,
  locations: Location[],
  onNavigate: NavigateToLocationHandler
) {
  removeReferencesPanel();

  // Group locations by filePath and load snippet previews
  const groupsMap = new Map<string, { loc: Location; previewText: string }[]>();
  const fileContentCache = new Map<string, string[]>();

  for (const loc of locations) {
    const p = uriToPath(loc.uri);
    if (!fileContentCache.has(p)) {
      try {
        const text = await fsService.readFile(p);
        fileContentCache.set(p, text.split('\n'));
      } catch {
        fileContentCache.set(p, []);
      }
    }
    const lines = fileContentCache.get(p) || [];
    const lineText = lines[loc.range.start.line] ? lines[loc.range.start.line].trim() : '';

    const list = groupsMap.get(p) || [];
    list.push({ loc, previewText: lineText });
    groupsMap.set(p, list);
  }

  const panel = document.createElement('div');
  panel.className = 'cm-references-panel';

  panel.innerHTML = `
    <div class="cm-ref-header">
      <div class="cm-ref-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span>References for <strong>${symbolName}</strong></span>
        <span class="cm-ref-count">${locations.length} results</span>
      </div>
      <button class="cm-ref-close" aria-label="Close">×</button>
    </div>
    <div class="cm-ref-body"></div>
  `;

  panel.querySelector('.cm-ref-close')?.addEventListener('click', () => {
    removeReferencesPanel();
    view.focus();
  });

  const bodyEl = panel.querySelector('.cm-ref-body') as HTMLElement;

  for (const [filePath, locItems] of groupsMap.entries()) {
    const fileGroup = document.createElement('div');
    fileGroup.className = 'cm-ref-file-group';

    const shortName = filePath.split(/[\\/]/).pop() || filePath;
    fileGroup.innerHTML = `
      <div class="cm-ref-file-header">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
        </svg>
        <span class="cm-ref-file-name">${shortName}</span>
        <span class="cm-ref-file-path">${filePath}</span>
        <span class="cm-ref-file-badge">${locItems.length}</span>
      </div>
      <div class="cm-ref-items"></div>
    `;

    const itemsContainer = fileGroup.querySelector('.cm-ref-items') as HTMLElement;
    for (const item of locItems) {
      const lineNum = item.loc.range.start.line + 1;
      const colNum = item.loc.range.start.character + 1;

      const itemEl = document.createElement('div');
      itemEl.className = 'cm-ref-item';
      itemEl.innerHTML = `
        <span class="cm-ref-line-num">${lineNum}:</span>
        <span class="cm-ref-snippet">${escapeHtml(item.previewText || `Line ${lineNum}`)}</span>
      `;

      itemEl.addEventListener('click', () => {
        onNavigate(filePath, lineNum, colNum);
        removeReferencesPanel();
      });

      itemsContainer.appendChild(itemEl);
    }

    bodyEl.appendChild(fileGroup);
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      removeReferencesPanel();
      document.removeEventListener('keydown', handleKeyDown);
      view.focus();
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  document.body.appendChild(panel);
  activeReferencesPanel = panel;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
