export interface MenuItem {
  label: string;
  icon?: string; // Vector SVG icon string
  shortcut?: string;
  checked?: boolean | (() => boolean);
  disabled?: boolean | (() => boolean);
  danger?: boolean;
  action?: () => void;
  divider?: boolean;
  submenu?: MenuItem[] | (() => MenuItem[]);
}

export class MenuController {
  private static activeRootMenu: HTMLElement | null = null;
  private static activeSubmenus: Set<HTMLElement> = new Set();
  private static closeHandler: ((e: MouseEvent | KeyboardEvent) => void) | null = null;

  public static dismiss(): void {
    if (this.activeRootMenu) {
      this.activeRootMenu.remove();
      this.activeRootMenu = null;
    }
    this.activeSubmenus.forEach((sub) => sub.remove());
    this.activeSubmenus.clear();

    if (this.closeHandler) {
      window.removeEventListener('mousedown', this.closeHandler as any, true);
      window.removeEventListener('keydown', this.closeHandler as any, true);
      this.closeHandler = null;
    }
  }

  public static showAt(x: number, y: number, items: MenuItem[]): HTMLElement {
    this.dismiss();

    const menuEl = this.createMenuElement(items, 0);
    document.body.appendChild(menuEl);
    this.activeRootMenu = menuEl;

    // Viewport boundary positioning
    const menuWidth = menuEl.offsetWidth || 230;
    const menuHeight = menuEl.offsetHeight || items.length * 28;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let posX = x;
    let posY = y;

    if (posX + menuWidth > winWidth - 8) {
      posX = Math.max(8, winWidth - menuWidth - 8);
    }
    if (posY + menuHeight > winHeight - 8) {
      posY = Math.max(8, winHeight - menuHeight - 8);
    }

    menuEl.style.left = `${posX}px`;
    menuEl.style.top = `${posY}px`;

    this.setupDismissListeners();
    return menuEl;
  }

  public static showAtElement(anchor: HTMLElement, items: MenuItem[], align: 'left' | 'right' = 'right'): HTMLElement {
    this.dismiss();

    const rect = anchor.getBoundingClientRect();
    const menuEl = this.createMenuElement(items, 0);
    document.body.appendChild(menuEl);
    this.activeRootMenu = menuEl;

    const menuWidth = menuEl.offsetWidth || 230;
    const menuHeight = menuEl.offsetHeight || items.length * 28;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let posX = align === 'right' ? rect.right - menuWidth : rect.left;
    let posY = rect.bottom + 4;

    if (posX < 8) posX = 8;
    if (posX + menuWidth > winWidth - 8) {
      posX = Math.max(8, winWidth - menuWidth - 8);
    }
    if (posY + menuHeight > winHeight - 8) {
      posY = Math.max(8, rect.top - menuHeight - 4);
    }

    menuEl.style.left = `${posX}px`;
    menuEl.style.top = `${posY}px`;

    this.setupDismissListeners();
    return menuEl;
  }

  private static createMenuElement(items: MenuItem[], depth: number): HTMLElement {
    const menu = document.createElement('div');
    menu.className = `gitero-menu-dropdown ${depth > 0 ? 'gitero-submenu' : 'gitero-menu-root'}`;

    for (const item of items) {
      if (item.divider) {
        const div = document.createElement('div');
        div.className = 'gitero-menu-divider';
        menu.appendChild(div);
        continue;
      }

      const isDisabled = typeof item.disabled === 'function' ? item.disabled() : !!item.disabled;
      const isChecked = typeof item.checked === 'function' ? item.checked() : !!item.checked;
      const hasSubmenu = !!item.submenu;

      const row = document.createElement('div');
      row.className = `gitero-menu-item ${isDisabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''} ${hasSubmenu ? 'has-submenu' : ''}`;

      // 1. Icon or Checkmark Slot
      const checkSlot = document.createElement('span');
      checkSlot.className = 'gitero-menu-check-slot';
      if (isChecked) {
        checkSlot.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
      } else if (item.icon) {
        checkSlot.innerHTML = item.icon;
      }
      row.appendChild(checkSlot);

      // 2. Label
      const labelSpan = document.createElement('span');
      labelSpan.className = 'gitero-menu-label';
      labelSpan.textContent = item.label;
      row.appendChild(labelSpan);

      // 3. Submenu arrow or Shortcut
      if (hasSubmenu) {
        const arrow = document.createElement('span');
        arrow.className = 'gitero-menu-arrow';
        arrow.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;
        row.appendChild(arrow);

        let activeSubmenuEl: HTMLElement | null = null;
        let openTimer: any = null;
        let closeTimer: any = null;

        const openSub = () => {
          clearTimeout(closeTimer);
          if (activeSubmenuEl) return;
          const subItems = typeof item.submenu === 'function' ? item.submenu() : (item.submenu || []);
          if (!subItems || subItems.length === 0) return;

          activeSubmenuEl = this.createMenuElement(subItems, depth + 1);
          document.body.appendChild(activeSubmenuEl);
          this.activeSubmenus.add(activeSubmenuEl);
          row.classList.add('submenu-active');

          // Position submenu to the right or left
          const rowRect = row.getBoundingClientRect();
          const subWidth = activeSubmenuEl.offsetWidth || 220;
          const subHeight = activeSubmenuEl.offsetHeight || subItems.length * 28;
          const winWidth = window.innerWidth;
          const winHeight = window.innerHeight;

          let subX = rowRect.right + 2;
          if (subX + subWidth > winWidth - 8) {
            subX = Math.max(8, rowRect.left - subWidth - 2);
          }

          let subY = rowRect.top - 4;
          if (subY + subHeight > winHeight - 8) {
            subY = Math.max(8, winHeight - subHeight - 8);
          }

          activeSubmenuEl.style.left = `${subX}px`;
          activeSubmenuEl.style.top = `${subY}px`;
        };

        const closeSub = () => {
          clearTimeout(openTimer);
          if (activeSubmenuEl) {
            this.activeSubmenus.delete(activeSubmenuEl);
            activeSubmenuEl.remove();
            activeSubmenuEl = null;
            row.classList.remove('submenu-active');
          }
        };

        row.addEventListener('mouseenter', () => {
          clearTimeout(closeTimer);
          openTimer = setTimeout(openSub, 60);
        });

        row.addEventListener('mouseleave', (e) => {
          clearTimeout(openTimer);
          const relTarget = e.relatedTarget as HTMLElement;
          if (activeSubmenuEl && activeSubmenuEl.contains(relTarget)) {
            return;
          }
          closeTimer = setTimeout(closeSub, 150);
        });

        row.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item.action && !isDisabled) {
            this.dismiss();
            item.action();
          }
        });
      } else {
        if (item.shortcut) {
          const scSpan = document.createElement('span');
          scSpan.className = 'gitero-menu-shortcut';
          scSpan.textContent = item.shortcut;
          row.appendChild(scSpan);
        }

        if (!isDisabled) {
          row.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dismiss();
            item.action?.();
          });
        }
      }

      menu.appendChild(row);
    }

    return menu;
  }

  private static setupDismissListeners() {
    this.closeHandler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') {
          this.dismiss();
        }
        return;
      }

      const target = e.target as HTMLElement;
      if (target && (target.closest('.gitero-menu-dropdown') || target.closest('.gitero-submenu'))) {
        return;
      }
      this.dismiss();
    };

    setTimeout(() => {
      window.addEventListener('mousedown', this.closeHandler as any, true);
      window.addEventListener('keydown', this.closeHandler as any, true);
    }, 10);
  }
}
