/**
 * Gitero IDE Notification Service
 * Manages floating toast notifications, session history, and unread counts.
 */

export type NotificationType = 'info' | 'warning' | 'error' | 'success';

export interface NotificationAction {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  durationMs?: number; // 0 or undefined for persistent / action-required
  actions?: NotificationAction[];
  onDismiss?: () => void;
  timestamp: number;
  isRead: boolean;
  count: number;
}

export class NotificationService {
  private nextId = 1;
  private listeners: ((item: NotificationItem) => void)[] = [];
  private dismissListeners: ((id: string) => void)[] = [];
  private historyListeners: ((history: NotificationItem[]) => void)[] = [];
  private activeNotifications = new Map<string, NotificationItem>();
  private history: NotificationItem[] = [];

  onNotification(listener: (item: NotificationItem) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  onDismiss(listener: (id: string) => void): () => void {
    this.dismissListeners.push(listener);
    return () => {
      const idx = this.dismissListeners.indexOf(listener);
      if (idx !== -1) this.dismissListeners.splice(idx, 1);
    };
  }

  onHistoryChange(listener: (history: NotificationItem[]) => void): () => void {
    this.historyListeners.push(listener);
    return () => {
      const idx = this.historyListeners.indexOf(listener);
      if (idx !== -1) this.historyListeners.splice(idx, 1);
    };
  }

  private emitHistoryChange() {
    const copy = [...this.history];
    for (const listener of this.historyListeners) {
      try {
        listener(copy);
      } catch (err) {
        console.error('[NotificationService] History listener error:', err);
      }
    }
  }

  show(item: Omit<NotificationItem, 'id' | 'timestamp' | 'isRead' | 'count'>): string {
    const now = Date.now();

    // Check for de-duplication with active notifications (within last 8 seconds)
    for (const [, active] of this.activeNotifications) {
      if (
        active.type === item.type &&
        active.title === item.title &&
        active.message === item.message &&
        now - active.timestamp < 8000
      ) {
        active.count = (active.count || 1) + 1;
        active.timestamp = now;
        active.isRead = false;

        // Notify toast listener of update
        for (const listener of this.listeners) {
          try {
            listener(active);
          } catch (err) {
            console.error('[NotificationService] Listener error:', err);
          }
        }
        this.emitHistoryChange();
        return active.id;
      }
    }

    const id = `notif-${this.nextId++}-${now}`;
    const fullItem: NotificationItem = {
      ...item,
      id,
      timestamp: now,
      isRead: false,
      count: 1,
      durationMs: item.durationMs !== undefined ? item.durationMs : (item.actions && item.actions.length > 0 ? 0 : 5000)
    };

    this.activeNotifications.set(id, fullItem);
    this.history.unshift(fullItem);

    // Limit history to last 50 items
    if (this.history.length > 50) {
      this.history.pop();
    }

    for (const listener of this.listeners) {
      try {
        listener(fullItem);
      } catch (err) {
        console.error('[NotificationService] Listener error:', err);
      }
    }

    this.emitHistoryChange();
    return id;
  }

  info(title: string, message: string, actions?: NotificationAction[], durationMs?: number): string {
    return this.show({ type: 'info', title, message, actions, durationMs });
  }

  warn(title: string, message: string, actions?: NotificationAction[], durationMs?: number): string {
    return this.show({ type: 'warning', title, message, actions, durationMs });
  }

  error(title: string, message: string, actions?: NotificationAction[], durationMs?: number): string {
    return this.show({ type: 'error', title, message, actions, durationMs: durationMs ?? 0 });
  }

  success(title: string, message: string, actions?: NotificationAction[], durationMs?: number): string {
    return this.show({ type: 'success', title, message, actions, durationMs: durationMs ?? 4000 });
  }

  dismiss(id: string) {
    const item = this.activeNotifications.get(id);
    if (!item) return;

    this.activeNotifications.delete(id);
    try {
      item.onDismiss?.();
    } catch {}

    for (const listener of this.dismissListeners) {
      try {
        listener(id);
      } catch (err) {
        console.error('[NotificationService] Dismiss listener error:', err);
      }
    }
  }

  getHistory(): NotificationItem[] {
    return [...this.history];
  }

  getUnreadCount(): number {
    return this.history.filter((h) => !h.isRead).length;
  }

  markRead(id: string): void {
    const item = this.history.find((h) => h.id === id);
    if (item && !item.isRead) {
      item.isRead = true;
      this.emitHistoryChange();
    }
  }

  markAllRead(): void {
    let changed = false;
    for (const item of this.history) {
      if (!item.isRead) {
        item.isRead = true;
        changed = true;
      }
    }
    if (changed) {
      this.emitHistoryChange();
    }
  }

  clearHistory(): void {
    this.history = [];
    this.emitHistoryChange();
  }

  removeHistoryItem(id: string): void {
    const idx = this.history.findIndex((h) => h.id === id);
    if (idx !== -1) {
      this.history.splice(idx, 1);
      this.emitHistoryChange();
    }
  }
}

export const notificationService = new NotificationService();
