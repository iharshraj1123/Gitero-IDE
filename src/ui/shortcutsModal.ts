export interface ShortcutItem {
  command: string;
  keys: string[];
  category: string;
}

export class ShortcutsModalComponent {
  private container: HTMLElement;
  private isOpen: boolean = false;
  private searchInput!: HTMLInputElement;
  private listContainer!: HTMLElement;

  private shortcuts: ShortcutItem[] = [
    // General
    { command: 'Show Command Palette', keys: ['Ctrl', 'Shift', 'P'], category: 'General' },
    { command: 'Quick Open File', keys: ['Ctrl', 'P'], category: 'General' },
    { command: 'Toggle Primary Sidebar', keys: ['Ctrl', 'B'], category: 'General' },
    { command: 'Toggle Developer Tools', keys: ['F12', 'or', 'Ctrl', 'Shift', 'I'], category: 'General' },
    { command: 'Open Settings & Custom CSS', keys: ['Ctrl', ','], category: 'General' },
    { command: 'Keyboard Shortcuts Reference', keys: ['Ctrl', 'K', 'Ctrl', 'S'], category: 'General' },

    // File
    { command: 'New File', keys: ['Ctrl', 'N'], category: 'File' },
    { command: 'Open File', keys: ['Ctrl', 'O'], category: 'File' },
    { command: 'Save File', keys: ['Ctrl', 'S'], category: 'File' },
    { command: 'Save As...', keys: ['Ctrl', 'Shift', 'S'], category: 'File' },
    { command: 'Close Tab', keys: ['Ctrl', 'W'], category: 'File' },

    // Editing & Navigation
    { command: 'Go to Line/Column', keys: ['Ctrl', 'G'], category: 'Editing' },
    { command: 'Find in File', keys: ['Ctrl', 'F'], category: 'Editing' },
    { command: 'Replace in File', keys: ['Ctrl', 'H'], category: 'Editing' },
    { command: 'Toggle Word Wrap', keys: ['Alt', 'Z'], category: 'Editing' },
    { command: 'Undo', keys: ['Ctrl', 'Z'], category: 'Editing' },
    { command: 'Redo', keys: ['Ctrl', 'Y'], category: 'Editing' },
    { command: 'Select All', keys: ['Ctrl', 'A'], category: 'Editing' },
    { command: 'Cycle Cursor Style (Line / Block / Underline)', keys: ['Num 0', 'or', 'Alt+0'], category: 'Editing' },

    // Panels
    { command: 'Show Global Search in Files', keys: ['Ctrl', 'Shift', 'F'], category: 'Panels' },
    { command: 'Show Source Control (Git)', keys: ['Ctrl', 'Shift', 'G'], category: 'Panels' },
    { command: 'Toggle Integrated Terminal', keys: ['Ctrl', '`'], category: 'Panels' },

    // Git
    { command: 'Git: Switch Branch', keys: ['Ctrl', 'Shift', 'B'], category: 'Git' },
    { command: 'Git: Sync / Push Remote Changes', keys: ['Ctrl', 'Shift', 'U'], category: 'Git' },

    // Vim Mode
    { command: 'Vim: Enter Insert Mode', keys: ['i'], category: 'Vim' },
    { command: 'Vim: Return to Normal Mode', keys: ['Esc'], category: 'Vim' },
    { command: 'Vim: Visual Selection Mode', keys: ['v'], category: 'Vim' },
    { command: 'Vim: Save File', keys: [':w'], category: 'Vim' },
    { command: 'Vim: Close Active Tab', keys: [':q'], category: 'Vim' }
  ];

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'shortcuts-modal-overlay';
    this.container.style.display = 'none';
    this.build();
    document.body.appendChild(this.container);
  }

  private build() {
    this.container.innerHTML = `
      <div class="shortcuts-modal-dialog">
        <div class="shortcuts-modal-header">
          <div class="shortcuts-modal-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="12" x="3" y="6" rx="2"/><path d="M7 10h.01"/><path d="M12 10h.01"/><path d="M17 10h.01"/><path d="M7 14h.01"/><path d="M12 14h.01"/><path d="M17 14h.01"/></svg>
            <span>Keyboard Shortcuts</span>
          </div>
          <button class="shortcuts-modal-close" id="btn-shortcuts-close" title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div class="shortcuts-search-container">
          <input type="text" class="shortcuts-search-input" id="shortcuts-filter-input" placeholder="Type to search keybindings..." spellcheck="false" />
        </div>

        <div class="shortcuts-list-container" id="shortcuts-list-container"></div>
      </div>
    `;

    this.searchInput = this.container.querySelector('#shortcuts-filter-input') as HTMLInputElement;
    this.listContainer = this.container.querySelector('#shortcuts-list-container') as HTMLElement;

    this.container.querySelector('#btn-shortcuts-close')?.addEventListener('click', () => {
      this.close();
    });

    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.close();
      }
    });

    this.searchInput.addEventListener('input', () => {
      this.renderList(this.searchInput.value.trim().toLowerCase());
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  private renderList(filterQuery: string = '') {
    this.listContainer.innerHTML = '';

    const filtered = this.shortcuts.filter(s => {
      if (!filterQuery) return true;
      return (
        s.command.toLowerCase().includes(filterQuery) ||
        s.category.toLowerCase().includes(filterQuery) ||
        s.keys.join(' ').toLowerCase().includes(filterQuery)
      );
    });

    if (filtered.length === 0) {
      this.listContainer.innerHTML = `<div class="shortcuts-empty">No matching keybindings found.</div>`;
      return;
    }

    // Group by category
    const categories = Array.from(new Set(filtered.map(s => s.category)));

    for (const cat of categories) {
      const catHeading = document.createElement('div');
      catHeading.className = 'shortcuts-cat-heading';
      catHeading.textContent = cat.toUpperCase();
      this.listContainer.appendChild(catHeading);

      const catShortcuts = filtered.filter(s => s.category === cat);
      for (const item of catShortcuts) {
        const row = document.createElement('div');
        row.className = 'shortcuts-row';

        const commandSpan = document.createElement('span');
        commandSpan.className = 'shortcut-cmd-label';
        commandSpan.textContent = item.command;

        const keysGroup = document.createElement('div');
        keysGroup.className = 'shortcut-keys-group';

        item.keys.forEach((k, idx) => {
          if (k === 'or') {
            const orSpan = document.createElement('span');
            orSpan.className = 'shortcut-or-label';
            orSpan.textContent = 'or';
            keysGroup.appendChild(orSpan);
          } else {
            const kbd = document.createElement('kbd');
            kbd.textContent = k;
            keysGroup.appendChild(kbd);
            if (idx < item.keys.length - 1 && item.keys[idx + 1] !== 'or') {
              const plus = document.createElement('span');
              plus.className = 'shortcut-plus';
              plus.textContent = '+';
              keysGroup.appendChild(plus);
            }
          }
        });

        row.appendChild(commandSpan);
        row.appendChild(keysGroup);
        this.listContainer.appendChild(row);
      }
    }
  }

  open() {
    this.isOpen = true;
    this.container.style.display = 'flex';
    this.searchInput.value = '';
    this.renderList();
    setTimeout(() => this.searchInput.focus(), 50);
  }

  close() {
    this.isOpen = false;
    this.container.style.display = 'none';
  }
}
