/**
 * Gitero IDE Notification Service
 * Manages floating toast notifications with severity levels and interactive actions.
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
}

export class NotificationService {
  private nextId = 1;
  private listeners: ((item: NotificationItem) => void)[] = [];
  private dismissListeners: ((id: string) => void)[] = [];
  private activeNotifications = new Map<string, NotificationItem>();

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

  show(item: Omit<NotificationItem, 'id'>): string {
    const id = `notif-${this.nextId++}-${Date.now()}`;
    const fullItem: NotificationItem = {
      ...item,
      id,
      durationMs: item.durationMs !== undefined ? item.durationMs : (item.actions && item.actions.length > 0 ? 0 : 5000)
    };

    this.activeNotifications.set(id, fullItem);
    for (const listener of this.listeners) {
      try {
        listener(fullItem);
      } catch (err) {
        console.error('[NotificationService] Listener error:', err);
      }
    }

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
}

export const notificationService = new NotificationService();
