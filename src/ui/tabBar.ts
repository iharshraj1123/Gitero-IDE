import { EditorTab, editorState } from '../state/editorState';
import { getFileIconSvg } from './icons';
import { preferencesService } from '../services/preferences';
import { lspClient } from '../services/lsp/lspClient';

export class TabBarComponent {
  private container: HTMLElement;
  private onConflictClick?: (tab: EditorTab) => void;

  constructor(container: HTMLElement, options?: { onConflictClick?: (tab: EditorTab) => void }) {
    this.container = container;
    this.onConflictClick = options?.onConflictClick;
    this.setupWheelScroll();

    editorState.onChange((tabs, activeTab) => {
      this.render(tabs, activeTab);
    });

    lspClient.onDiagnostics(() => {
      this.render(editorState.getTabs(), editorState.getActiveTab());
    });

    preferencesService.subscribe('workbench.iconTheme', () => {
      this.render(editorState.getTabs(), editorState.getActiveTab());
    });

    preferencesService.subscribe('workbench.customIconPackage', () => {
      this.render(editorState.getTabs(), editorState.getActiveTab());
    });
  }

  private setupWheelScroll() {
    this.container.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        this.container.scrollLeft += e.deltaY;
      }
    });
  }

  render(tabs: EditorTab[], activeTab: EditorTab | null) {
    this.container.innerHTML = '';

    for (const tab of tabs) {
      const tabEl = document.createElement('div');
      const isActive = activeTab && activeTab.id === tab.id;
      const diagSummary = lspClient.getFileDiagnosticSummary(tab.path);
      const diagCls = diagSummary.errors > 0 ? 'tab-has-error' : (diagSummary.warnings > 0 ? 'tab-has-warning' : '');
      const isConflict = !!tab.hasExternalConflict;
      const isDeleted = !!tab.isDeletedOnDisk;
      const conflictCls = isConflict ? 'tab-has-conflict' : (isDeleted ? 'tab-deleted-on-disk' : '');
      tabEl.className = `editor-tab ${isActive ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''} ${diagCls} ${conflictCls}`.trim();

      let tooltip = tab.path;
      if (isConflict) tooltip += ' (Conflict: modified on disk externally)';
      else if (isDeleted) tooltip += ' (Deleted on disk - save to restore)';
      tabEl.title = tooltip;

      const icon = document.createElement('span');
      icon.className = 'tab-icon';
      if (tab.viewMode === 'git-graph') {
        icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3794ff" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>`;
      } else {
        icon.innerHTML = getFileIconSvg(tab.name, false);
      }

      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = tab.name;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close';
      closeBtn.setAttribute('aria-label', `Close ${tab.name}`);

      const conflictIndicatorSvg = `<span class="conflict-indicator" title="Conflict: modified externally"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#d29922" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>`;

      if (isConflict) {
        closeBtn.innerHTML = conflictIndicatorSvg;
      } else if (tab.isDirty) {
        closeBtn.innerHTML = '<span class="dirty-indicator">●</span>';
      } else {
        closeBtn.innerHTML = '<span class="close-x">×</span>';
      }

      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editorState.closeTab(tab.id);
      });

      // Show close-x on hover even when dirty or conflicted
      tabEl.addEventListener('mouseenter', () => {
        if (tab.isDirty || tab.hasExternalConflict) {
          closeBtn.innerHTML = '<span class="close-x">×</span>';
        }
      });
      tabEl.addEventListener('mouseleave', () => {
        if (tab.hasExternalConflict) {
          closeBtn.innerHTML = conflictIndicatorSvg;
        } else if (tab.isDirty) {
          closeBtn.innerHTML = '<span class="dirty-indicator">●</span>';
        }
      });

      tabEl.addEventListener('click', () => {
        editorState.selectTab(tab.id);
        if (tab.hasExternalConflict && this.onConflictClick) {
          this.onConflictClick(tab);
        }
      });

      // Middle click to close
      tabEl.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          editorState.closeTab(tab.id);
        }
      });

      tabEl.appendChild(icon);
      tabEl.appendChild(title);
      tabEl.appendChild(closeBtn);

      this.container.appendChild(tabEl);
    }

    const newTabBtn = document.createElement('button');
    newTabBtn.className = 'tab-new-btn';
    newTabBtn.title = 'New Untitled File (Ctrl+N)';
    newTabBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    newTabBtn.addEventListener('click', () => {
      editorState.openUntitledFile();
    });
    this.container.appendChild(newTabBtn);

    if (tabs.length > 0) {
      const closeAllBtn = document.createElement('button');
      closeAllBtn.className = 'tab-close-all-btn';
      closeAllBtn.title = 'Close All Tabs (Ctrl+K Ctrl+W)';
      closeAllBtn.setAttribute('aria-label', 'Close All Tabs');
      closeAllBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="15" height="15" rx="2"/><path d="M6 2h13a2 2 0 0 1 2 2v13"/><path d="m6.5 10.5 6 6m0-6-6 6"/></svg>`;
      closeAllBtn.addEventListener('click', () => {
        editorState.closeAllTabs();
      });
      this.container.appendChild(closeAllBtn);
    }
  }
}
