import { cleanupOutdatedCaches, matchPrecache, type PrecacheEntry, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clickedAddress, notificationFromPush } from './serviceWorker/pushNotification';
import { REFRESH_MESSAGE } from './serviceWorker/refreshMessage';

declare const self: ServiceWorkerGlobalScope & { readonly __WB_MANIFEST: Array<PrecacheEntry | string> };

const SHELL_PAGE = '/index.html';

const NEVER_FROM_CACHE = [/^\/api\//];

const LEGACY_CACHE_PREFIX = 'autoveille-';

const deleteLegacyCaches = async (): Promise<void> => {
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith(LEGACY_CACHE_PREFIX)).map((name) => caches.delete(name)));
};

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(deleteLegacyCaches().then(() => self.clients.claim()));
});

const pageFromTheServerOrShell = async (request: Request): Promise<Response> => {
  try {
    return await fetch(request);
  } catch {
    return (await matchPrecache(SHELL_PAGE)) ?? Response.error();
  }
};

registerRoute(new NavigationRoute(({ request }) => pageFromTheServerOrShell(request), { denylist: NEVER_FROM_CACHE }));
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('push', (event) => {
  const { title, options } = notificationFromPush(() => event.data?.json());
  event.waitUntil(
    self.registration
      .showNotification(title, options)
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((windows) => {
        for (const client of windows) {
          client.postMessage(REFRESH_MESSAGE);
        }
      }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const address = clickedAddress(event.notification.data);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          if ('navigate' in client) {
            void client.navigate(address);
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(address);
    }),
  );
});
