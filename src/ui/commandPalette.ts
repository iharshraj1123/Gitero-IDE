export interface PaletteItem {
  id: string;
  title: string;
  detail?: string;
  category?: string;
  action: () => void;
}

export class CommandPaletteComponent {
  private overlay!: HTMLElement;
  private input!: HTMLInputElement;
  private listEl!: HTMLElement;
  private items: PaletteItem[] = [];
  private filteredItems: PaletteItem[] = [];
  private selectedIndex: number = 0;
  private isOpen: boolean = false;
  private promptModeCallback: ((val: string) => void) | null = null;

  constructor() {
    this.createDom();
    this.setupListeners();
  }

  private createDom() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'command-palette-overlay';
    this.overlay.style.display = 'none';

    this.overlay.innerHTML = `
      <div class="command-palette-modal">
        <div class="palette-input-container">
          <input type="text" class="palette-input" placeholder="Type a command or filename..." />
        </div>
        <div class="palette-list"></div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    this.input = this.overlay.querySelector('.palette-input') as HTMLInputElement;
    this.listEl = this.overlay.querySelector('.palette-list') as HTMLElement;
  }

  private setupListeners() {
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    this.input.addEventListener('input', () => {
      this.filter(this.input.value);
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.promptModeCallback) {
          const cb = this.promptModeCallback;
          const val = this.input.value;
          this.close();
          cb(val);
          return;
        }
        const selected = this.filteredItems[this.selectedIndex];
        if (selected) {
          this.close();
          selected.action();
        }
        return;
      }

      if (this.promptModeCallback) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredItems.length - 1);
        this.renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.renderList();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });
  }

  open(items: PaletteItem[], initialQuery: string = '') {
    this.items = items;
    this.isOpen = true;
    this.overlay.style.display = 'flex';
    this.input.value = initialQuery;
    this.filter(initialQuery);
    setTimeout(() => {
      this.input.focus();
      this.input.select();
    }, 20);
  }

  promptInput(options: { placeholder: string; initialValue?: string; onAccept: (value: string) => void }) {
    this.items = [];
    this.filteredItems = [];
    this.promptModeCallback = options.onAccept;
    this.isOpen = true;
    this.overlay.style.display = 'flex';
    this.input.placeholder = options.placeholder;
    this.input.value = options.initialValue || '';
    this.listEl.innerHTML = '';
    setTimeout(() => {
      this.input.focus();
      this.input.select();
    }, 20);
  }

  close() {
    this.isOpen = false;
    this.overlay.style.display = 'none';
    this.promptModeCallback = null;
    this.input.placeholder = 'Type a command or filename...';
  }

  isPaletteOpen(): boolean {
    return this.isOpen;
  }

  private filter(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) {
      this.filteredItems = [...this.items];
    } else {
      this.filteredItems = this.items.filter(item => {
        const titleMatch = item.title.toLowerCase().includes(q);
        const detailMatch = item.detail ? item.detail.toLowerCase().includes(q) : false;
        const catMatch = item.category ? item.category.toLowerCase().includes(q) : false;
        return titleMatch || detailMatch || catMatch;
      });
    }
    this.selectedIndex = 0;
    this.renderList();
  }

  private renderList() {
    this.listEl.innerHTML = '';
    if (this.filteredItems.length === 0) {
      this.listEl.innerHTML = `<div class="palette-empty">No matching commands or files</div>`;
      return;
    }

    this.filteredItems.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = `palette-row ${idx === this.selectedIndex ? 'selected' : ''}`;

      row.innerHTML = `
        <div class="palette-item-left">
          ${item.category ? `<span class="palette-cat">${item.category}</span>` : ''}
          <span class="palette-title">${item.title}</span>
        </div>
        ${item.detail ? `<span class="palette-detail">${item.detail}</span>` : ''}
      `;

      row.addEventListener('click', () => {
        this.close();
        item.action();
      });

      row.addEventListener('mouseenter', () => {
        this.selectedIndex = idx;
        this.updateSelection();
      });

      this.listEl.appendChild(row);
    });

    this.scrollToSelected();
  }

  private updateSelection() {
    const rows = this.listEl.querySelectorAll('.palette-row');
    rows.forEach((r, idx) => {
      if (idx === this.selectedIndex) {
        r.classList.add('selected');
      } else {
        r.classList.remove('selected');
      }
    });
  }

  private scrollToSelected() {
    const selectedEl = this.listEl.children[this.selectedIndex] as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }
}

export const commandPalette = new CommandPaletteComponent();
