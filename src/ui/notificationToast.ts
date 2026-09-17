/**
 * Floating Toast Notification Component
 * Renders non-blocking, actionable notification cards in the bottom-right viewport.
 */

import { notificationService, NotificationItem, NotificationType } from '../services/notification';

function getIconSvg(type: NotificationType): string {
  switch (type) {
    case 'success':
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    case 'warning':
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d29922" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    case 'error':
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f85149" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    default:
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }
}

export class NotificationToastComponent {
  private container: HTMLElement;
  private toastElements = new Map<string, {
    element: HTMLElement;
    timer?: any;
    remainingMs: number;
    startTime: number;
  }>();

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'notification-toast-container';
    this.container.className = 'notification-toast-container';
    document.body.appendChild(this.container);

    notificationService.onNotification((item) => this.renderToast(item));
    notificationService.onDismiss((id) => this.removeToast(id));
  }

  private renderToast(item: NotificationItem) {
    // If already rendered, remove old
    if (this.toastElements.has(item.id)) {
      this.removeToast(item.id);
    }

    const toast = document.createElement('div');
    toast.className = `notification-toast toast-${item.type}`;
    toast.setAttribute('data-id', item.id);

    let actionsHtml = '';
    if (item.actions && item.actions.length > 0) {
      actionsHtml = `
        <div class="toast-actions">
          ${item.actions.map((act, idx) => `
            <button class="toast-action-btn ${act.primary ? 'primary' : 'secondary'}" data-action-idx="${idx}">
              ${act.label}
            </button>
          `).join('')}
        </div>
      `;
    }

    toast.innerHTML = `
      <div class="toast-header">
        <div class="toast-icon">${getIconSvg(item.type)}</div>
        <span class="toast-title">${item.title}</span>
        <button class="toast-close-btn" aria-label="Close">×</button>
      </div>
      <div class="toast-message">${item.message}</div>
      ${actionsHtml}
    `;

    // Wire close button
    toast.querySelector('.toast-close-btn')?.addEventListener('click', () => {
      notificationService.dismiss(item.id);
    });

    // Wire action buttons
    if (item.actions) {
      const actionBtns = toast.querySelectorAll('.toast-action-btn');
      actionBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-action-idx') || '0', 10);
          const act = item.actions?.[idx];
          if (act) {
            try {
              act.onClick();
            } catch (err) {
              console.error('[NotificationToast] Action click error:', err);
            }
          }
          notificationService.dismiss(item.id);
        });
      });
    }

    this.container.appendChild(toast);

    // Auto-dismiss handling
    let timer: any;
    let remainingMs = item.durationMs || 0;
    let startTime = Date.now();

    if (remainingMs > 0) {
      const startDismissTimer = () => {
        startTime = Date.now();
        timer = setTimeout(() => {
          notificationService.dismiss(item.id);
        }, remainingMs);
      };

      startDismissTimer();

      // Pause timer on hover
      toast.addEventListener('mouseenter', () => {
        if (timer) {
          clearTimeout(timer);
          remainingMs -= (Date.now() - startTime);
        }
      });

      toast.addEventListener('mouseleave', () => {
        if (remainingMs > 0) {
          startDismissTimer();
        }
      });
    }

    this.toastElements.set(item.id, {
      element: toast,
      timer,
      remainingMs,
      startTime
    });

    // Trigger entrance animation
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });
  }

  private removeToast(id: string) {
    const entry = this.toastElements.get(id);
    if (!entry) return;

    if (entry.timer) clearTimeout(entry.timer);
    this.toastElements.delete(id);

    entry.element.classList.remove('visible');
    entry.element.classList.add('dismissing');

    setTimeout(() => {
      if (entry.element.parentNode) {
        entry.element.parentNode.removeChild(entry.element);
      }
    }, 250);
  }
}
