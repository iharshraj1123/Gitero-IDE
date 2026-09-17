/**
 * Notification Center Component
 * Provides a slide-up flyout panel above the Status Bar displaying session notification history,
 * unread badges, severity filters, and re-triggerable action buttons.
 */

import { notificationService, NotificationItem, NotificationType } from '../services/notification';

function getSeveritySvg(type: NotificationType): string {
  switch (type) {
    case 'success':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    case 'warning':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d29922" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    case 'error':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f85149" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    default:
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }
}

function formatTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 15) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const d = new Date(timestamp);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export class NotificationCenterComponent {
  private element!: HTMLElement;
  private isVisible: boolean = false;
  private currentFilter: 'all' | 'error' | 'warning' | 'info' = 'all';

  constructor() {
    this.createDom();
    this.setupListeners();
  }

  private createDom() {
    this.element = document.createElement('div');
    this.element.id = 'notification-center-flyout';
    this.element.className = 'notification-center-flyout';
    this.element.style.display = 'none';

    this.element.innerHTML = `
      <div class="notif-center-header">
        <div class="notif-center-title-group">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span class="notif-center-title">Notifications</span>
          <span class="notif-center-unread-badge" id="notif-header-unread">0</span>
        </div>
        <div class="notif-center-header-actions">
          <button type="button" class="notif-header-btn" id="btn-notif-mark-read" title="Mark all as read">Mark as read</button>
          <button type="button" class="notif-header-btn" id="btn-notif-clear-all" title="Clear all notification history">Clear all</button>
          <button type="button" class="notif-close-btn" id="btn-notif-close" aria-label="Close">×</button>
        </div>
      </div>

      <div class="notif-filter-bar">
        <button type="button" class="notif-filter-chip active" data-filter="all">All</button>
        <button type="button" class="notif-filter-chip" data-filter="error">Errors</button>
        <button type="button" class="notif-filter-chip" data-filter="warning">Warnings</button>
        <button type="button" class="notif-filter-chip" data-filter="info">Info</button>
      </div>

      <div class="notif-items-list" id="notif-items-list">
        <!-- Rendered dynamically -->
      </div>
    `;

    document.body.appendChild(this.element);
  }

  private setupListeners() {
    notificationService.onHistoryChange(() => {
      if (this.isVisible) {
        this.renderList();
      }
    });

    const closeBtn = this.element.querySelector('#btn-notif-close') as HTMLElement;
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    const markReadBtn = this.element.querySelector('#btn-notif-mark-read') as HTMLElement;
    markReadBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      notificationService.markAllRead();
      this.renderList();
    });

    const clearAllBtn = this.element.querySelector('#btn-notif-clear-all') as HTMLElement;
    clearAllBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      notificationService.clearHistory();
      this.renderList();
    });

    // Filter chip clicks
    const filterChips = this.element.querySelectorAll<HTMLButtonElement>('.notif-filter-chip');
    filterChips.forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        filterChips.forEach((c) => c.classList.toggle('active', c === chip));
        this.currentFilter = (chip.getAttribute('data-filter') as any) || 'all';
        this.renderList();
      });
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!this.isVisible) return;
      const target = e.target as HTMLElement;
      if (
        !this.element.contains(target) &&
        !target.closest('#status-notifications')
      ) {
        this.close();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.close();
      }
    });
  }

  isOpen(): boolean {
    return this.isVisible;
  }

  toggle(): void {
    if (this.isVisible) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.isVisible = true;
    this.element.style.display = 'flex';
    requestAnimationFrame(() => {
      this.element.classList.add('visible');
    });
    this.renderList();
  }

  close(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.element.classList.remove('visible');
    setTimeout(() => {
      if (!this.isVisible) {
        this.element.style.display = 'none';
      }
    }, 200);
  }

  private renderList(): void {
    const listContainer = this.element.querySelector('#notif-items-list') as HTMLElement;
    const unreadBadge = this.element.querySelector('#notif-header-unread') as HTMLElement;
    if (!listContainer) return;

    const unreadCount = notificationService.getUnreadCount();
    if (unreadBadge) {
      unreadBadge.textContent = String(unreadCount);
      unreadBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }

    let items = notificationService.getHistory();

    if (this.currentFilter !== 'all') {
      items = items.filter((item) => {
        if (this.currentFilter === 'info') return item.type === 'info' || item.type === 'success';
        return item.type === this.currentFilter;
      });
    }

    if (items.length === 0) {
      listContainer.innerHTML = `
        <div class="notif-empty-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <div class="notif-empty-title">No notifications</div>
          <div class="notif-empty-desc">Your session alerts, warnings, and updates will appear here.</div>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';

    for (const item of items) {
      const card = document.createElement('div');
      card.className = `notif-item-card ${item.isRead ? 'read' : 'unread'} type-${item.type}`;
      card.setAttribute('data-id', item.id);

      let actionsHtml = '';
      if (item.actions && item.actions.length > 0) {
        actionsHtml = `
          <div class="notif-item-actions">
            ${item.actions.map((act, idx) => `
              <button type="button" class="notif-action-btn ${act.primary ? 'primary' : 'secondary'}" data-act-idx="${idx}">
                ${act.label}
              </button>
            `).join('')}
          </div>
        `;
      }

      card.innerHTML = `
        <div class="notif-item-header">
          <div class="notif-item-icon">${getSeveritySvg(item.type)}</div>
          <span class="notif-item-title">${item.title}</span>
          ${item.count > 1 ? `<span class="notif-item-count">(${item.count})</span>` : ''}
          <span class="notif-item-time">${formatTime(item.timestamp)}</span>
          <button type="button" class="notif-item-delete-btn" title="Remove notification" aria-label="Remove">×</button>
        </div>
        <div class="notif-item-message">${item.message}</div>
        ${actionsHtml}
      `;

      // Mark read when card is clicked
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.notif-item-delete-btn') || target.closest('.notif-action-btn')) {
          return;
        }
        notificationService.markRead(item.id);
        card.classList.remove('unread');
        card.classList.add('read');
      });

      // Individual remove
      card.querySelector('.notif-item-delete-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationService.removeHistoryItem(item.id);
        this.renderList();
      });

      // Actions click
      if (item.actions) {
        const actionBtns = card.querySelectorAll('.notif-action-btn');
        actionBtns.forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.getAttribute('data-act-idx') || '0', 10);
            const act = item.actions?.[idx];
            if (act) {
              try {
                act.onClick();
              } catch (err) {
                console.error('[NotificationCenter] Action click error:', err);
              }
            }
            notificationService.markRead(item.id);
            this.renderList();
          });
        });
      }

      listContainer.appendChild(card);
    }
  }
}
