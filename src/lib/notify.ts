/**
 * System notifications, shared by the evening reminder and the focus timer.
 * They go through the service worker when there is one (so clicking them
 * opens Momentum), or the page's own Notification otherwise.
 */
export const notificationsSupported = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window

export const canNotify = (): boolean =>
  notificationsSupported() && Notification.permission === 'granted'

/** Asks for permission if needed. Returns why notifications can't be shown, or `null`. */
export async function requestNotifications(): Promise<string | null> {
  if (!notificationsSupported()) {
    return /iPhone|iPad|iPod/.test(navigator.userAgent)
      ? 'On iPhone and iPad, add Momentum to your Home Screen first, then turn this on from the app.'
      : "This browser doesn't support notifications."
  }
  const permission =
    Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission
  return permission === 'granted'
    ? null
    : 'Notifications are blocked for this site. Allow them in your browser settings.'
}

export type NotifyOptions = NotificationOptions & {
  actions?: { action: string; title: string }[]
  /** Where clicking the notification goes. */
  url?: string
}

/** Shows a notification if permission was granted. Returns whether it did. */
export async function notify(
  title: string,
  { url = '/', ...options }: NotifyOptions = {},
): Promise<boolean> {
  if (!canNotify()) return false
  const full = {
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    ...options,
    data: { url },
  }
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) await registration.showNotification(title, full)
    else new Notification(title, full)
    return true
  } catch {
    return false
  }
}
