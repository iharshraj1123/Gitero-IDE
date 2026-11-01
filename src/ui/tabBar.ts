import { EditorTab, editorState } from '../state/editorState';
import { getFileIconSvg } from './icons';
import { preferencesService } from '../services/preferences';
import { lspClient } from '../services/lsp/lspClient';

export class TabBarComponent {
  private container: HTMLElement;
  private onConflictClick?: (tab: EditorTab) => void;
  private draggedTabId: string | null = null;
  private autoScrollInterval: number | null = null;

  constructor(container: HTMLElement, options?: { onConflictClick?: (tab: EditorTab) => void }) {
    this.container = container;
    this.onConflictClick = options?.onConflictClick;
    this.setupWheelScroll();
    this.setupContainerDragOver();

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
      if (e.deltaY !== 0 || e.deltaX !== 0) {
        e.preventDefault();
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        this.container.scrollBy({ left: delta, behavior: 'auto' });
      }
    }, { passive: false });
  }

  private setupContainerDragOver() {
    this.container.addEventListener('dragover', (e) => {
      if (!this.draggedTabId) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }

      // Edge auto-scrolling when dragging near left or right boundaries
      const rect = this.container.getBoundingClientRect();
      const edgeThreshold = 48;
      const mouseX = e.clientX;

      if (mouseX < rect.left + edgeThreshold) {
        const factor = Math.max(1, (rect.left + edgeThreshold - mouseX) / 8);
        this.startAutoScroll(-factor * 6);
      } else if (mouseX > rect.right - edgeThreshold) {
        const factor = Math.max(1, (mouseX - (rect.right - edgeThreshold)) / 8);
        this.startAutoScroll(factor * 6);
      } else {
        this.stopAutoScroll();
      }
    });

    this.container.addEventListener('dragleave', (e) => {
      // If leaving container entirely
      const rect = this.container.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        this.stopAutoScroll();
      }
    });

    this.container.addEventListener('drop', (e) => {
      this.stopAutoScroll();
      this.clearAllDropIndicators();
    });
  }

  private startAutoScroll(speed: number) {
    if (this.autoScrollInterval !== null) {
      clearInterval(this.autoScrollInterval);
    }
    this.autoScrollInterval = window.setInterval(() => {
      this.container.scrollLeft += speed;
    }, 16);
  }

  private stopAutoScroll() {
    if (this.autoScrollInterval !== null) {
      clearInterval(this.autoScrollInterval);
      this.autoScrollInterval = null;
    }
  }

  private clearAllDropIndicators() {
    const tabs = this.container.querySelectorAll('.editor-tab');
    tabs.forEach(t => {
      t.classList.remove('drop-target-before', 'drop-target-after', 'tab-dragging');
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
      tabEl.draggable = true;
      tabEl.dataset.tabId = tab.id;

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

      // Drag & Drop event handlers for mouse reordering
      tabEl.addEventListener('dragstart', (e) => {
        this.draggedTabId = tab.id;
        tabEl.classList.add('tab-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', tab.id);
        }
      });

      tabEl.addEventListener('dragend', () => {
        this.draggedTabId = null;
        this.stopAutoScroll();
        this.clearAllDropIndicators();
      });

      tabEl.addEventListener('dragover', (e) => {
        if (!this.draggedTabId || this.draggedTabId === tab.id) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }

        const rect = tabEl.getBoundingClientRect();
        const midPoint = rect.left + rect.width / 2;
        const isAfter = e.clientX > midPoint;

        tabEl.classList.toggle('drop-target-before', !isAfter);
        tabEl.classList.toggle('drop-target-after', isAfter);
      });

      tabEl.addEventListener('dragleave', (e) => {
        // Only clear if actually leaving tabEl
        const related = e.relatedTarget as Node | null;
        if (!related || !tabEl.contains(related)) {
          tabEl.classList.remove('drop-target-before', 'drop-target-after');
        }
      });

      tabEl.addEventListener('drop', (e) => {
        if (!this.draggedTabId || this.draggedTabId === tab.id) return;
        e.preventDefault();
        e.stopPropagation();

        const rect = tabEl.getBoundingClientRect();
        const midPoint = rect.left + rect.width / 2;
        const isAfter = e.clientX > midPoint;

        const sourceId = this.draggedTabId;
        this.draggedTabId = null;
        this.stopAutoScroll();
        this.clearAllDropIndicators();

        editorState.moveTabById(sourceId, tab.id, isAfter);
      });

      tabEl.appendChild(icon);
      tabEl.appendChild(title);
      tabEl.appendChild(closeBtn);

      this.container.appendChild(tabEl);
    }

    // Scroll active tab smoothly into view if partially hidden
    const activeEl = this.container.querySelector('.editor-tab.active') as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
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
