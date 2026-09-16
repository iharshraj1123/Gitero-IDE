import { EditorTab, editorState } from '../state/editorState';
import { getFileIconSvg } from './icons';
import { preferencesService } from '../services/preferences';

export class TabBarComponent {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.setupWheelScroll();

    editorState.onChange((tabs, activeTab) => {
      this.render(tabs, activeTab);
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
      tabEl.className = `editor-tab ${isActive ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`;
      tabEl.title = tab.path;

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
      closeBtn.innerHTML = tab.isDirty ? '<span class="dirty-indicator">●</span>' : '<span class="close-x">×</span>';

      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editorState.closeTab(tab.id);
      });

      // Show close-x on hover even when dirty
      tabEl.addEventListener('mouseenter', () => {
        if (tab.isDirty) {
          closeBtn.innerHTML = '<span class="close-x">×</span>';
        }
      });
      tabEl.addEventListener('mouseleave', () => {
        if (tab.isDirty) {
          closeBtn.innerHTML = '<span class="dirty-indicator">●</span>';
        }
      });

      tabEl.addEventListener('click', () => {
        editorState.selectTab(tab.id);
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
  }
}
