/// <reference lib="webworker" />
/**
 * Momentum's service worker: precaches the app so it works offline, and shows
 * the evening reminder when the browser wakes it (periodic background sync).
 */
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { toDateKey } from './lib/date'
import { readMirror, writeMirror } from './features/reminder/lib/mirror'
import {
  REMINDER_TAG,
  reminderDue,
  reminderMessage,
} from './features/reminder/lib/schedule'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
// Every navigation gets the app shell, so deep links work offline too.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

async function remindIfDue() {
  const state = await readMirror()
  const now = new Date()
  if (!state || !reminderDue(state, now)) return
  await writeMirror({ lastNotified: toDateKey(now) })
  const { title, body } = reminderMessage(state.streak)
  await self.registration.showNotification(title, {
    body,
    tag: REMINDER_TAG,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: '/' },
    actions: [{ action: 'check-in', title: 'Check in' }],
  } as NotificationOptions)
}

self.addEventListener('periodicsync', ((
  event: ExtendableEvent & { tag: string },
) => {
  if (event.tag === REMINDER_TAG) event.waitUntil(remindIfDue())
}) as EventListener)

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // "Check in" opens the app and checks in straight away.
  const url = event.action === 'check-in' ? '/?checkin=1' : '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      const existing = windows[0]
      if (existing) {
        await existing.navigate(url)
        await existing.focus()
      } else {
        await self.clients.openWindow(url)
      }
    })(),
  )
})
