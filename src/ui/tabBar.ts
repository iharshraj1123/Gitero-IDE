import { EditorTab, editorState } from '../state/editorState';
import { getFileIconSvg } from './icons';

export class TabBarComponent {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.setupWheelScroll();

    editorState.onChange((tabs, activeTab) => {
      this.render(tabs, activeTab);
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

    if (tabs.length === 0) {
      return;
    }

    for (const tab of tabs) {
      const tabEl = document.createElement('div');
      const isActive = activeTab && activeTab.id === tab.id;
      tabEl.className = `editor-tab ${isActive ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`;
      tabEl.title = tab.path;

      const icon = document.createElement('span');
      icon.className = 'tab-icon';
      icon.innerHTML = getFileIconSvg(tab.name, false);

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
  }
}
