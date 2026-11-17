/**
 * Desktop + mobile notifications for incoming chat messages.
 *
 * Uses the browser Notification API (no service worker required, so it works on
 * a plain static host such as GitHub Pages). Notifications are only raised when
 * the user has granted permission *and* is not already looking at that chat.
 */

export type NotificationPermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission as NotificationPermissionState;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result as NotificationPermissionState;
  } catch {
    return 'denied';
  }
}

interface ShowMessageNotificationOptions {
  title: string;
  body: string;
  /** Collapses repeat notifications for the same chat into one entry. */
  tag?: string;
  icon?: string;
  onClick?: () => void;
}

let activeNotification: Notification | null = null;

/**
 * Shows a message notification. Returns true when a notification was displayed.
 * The caller is responsible for deciding whether the user wants them.
 */
export function showMessageNotification({
  title,
  body,
  tag,
  icon,
  onClick,
}: ShowMessageNotificationOptions): boolean {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;

  try {
    const notification = new Notification(title, {
      body,
      tag,
      icon: icon || undefined,
      badge: icon || undefined,
      silent: false,
    });

    notification.onclick = () => {
      window.focus();
      onClick?.();
      notification.close();
    };

    // Keep a reference so the browser does not garbage-collect it immediately.
    activeNotification = notification;
    window.setTimeout(() => {
      if (activeNotification === notification) activeNotification = null;
      notification.close();
    }, 6000);

    return true;
  } catch {
    // Some browsers (notably iOS Safari outside a PWA) throw on construction.
    return false;
  }
}
