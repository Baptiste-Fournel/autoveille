import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const SERVICE_WORKER_MODULE = '../../client/src/sw.ts';

const APPLICATION_ORIGIN = window.location.origin;

const GARAGE_PHOTO = 'https://cdn.garage-exemple.fr/alpine-a110.jpg';

const APPLICATION_STYLESHEET = `${APPLICATION_ORIGIN}/assets/index-Cn2u7dTR.css`;

const SHELL_PAGE = '<!doctype html><title>AutoVeille</title>';

const PRECACHE_MANIFEST = [
  { url: 'index.html', revision: 'b7bd678e7648969eedef85789ee38077' },
  { url: 'manifest.webmanifest', revision: '212388c417de8721c83c7f89844cbfa1' },
  { url: 'assets/index-Cn2u7dTR.css', revision: null },
  { url: 'assets/index-X9wa3HUf.js', revision: null },
];

type Listener = (event: unknown) => void;

interface ShownNotification {
  readonly title: string;
  readonly options: NotificationOptions;
}

interface OpenWindow {
  readonly url: string;
  readonly messages: unknown[];
  readonly visited: string[];
  focused: boolean;
}

class WorkerEvent extends Event {
  readonly pending: Promise<unknown>[] = [];

  waitUntil(promise: Promise<unknown>): void {
    this.pending.push(promise);
  }
}

class WorkerFetchEvent extends WorkerEvent {
  readonly request: Request;
  answer: Promise<Response> | undefined;

  constructor(request: Request) {
    super('fetch');
    this.request = request;
  }

  respondWith(answer: Promise<Response>): void {
    this.answer = answer;
  }
}

class ApplicationRequest extends Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(typeof input === 'string' ? new URL(input, APPLICATION_ORIGIN).href : input, init);
  }
}

const listeners = new Map<string, Listener[]>();

const shown: ShownNotification[] = [];

const windows: OpenWindow[] = [];

const opened: string[] = [];

const dispatch = (type: string, event: unknown): void => {
  for (const listener of listeners.get(type) ?? []) {
    listener(event);
  }
};

const fetched = (url: string, mode?: RequestMode): WorkerFetchEvent => {
  const request = new ApplicationRequest(url);
  if (mode !== undefined) {
    Object.defineProperty(request, 'mode', { value: mode });
  }
  const event = new WorkerFetchEvent(request);
  dispatch('fetch', event);
  return event;
};

const settled = async (event: WorkerEvent): Promise<void> => {
  await Promise.all(event.pending);
};

const pushed = (data: { readonly json: () => unknown } | null): WorkerEvent => {
  const event = Object.assign(new WorkerEvent('push'), { data });
  dispatch('push', event);
  return event;
};

const clicked = (data: unknown): WorkerEvent => {
  const event = Object.assign(new WorkerEvent('notificationclick'), { notification: { data, close: () => undefined } });
  dispatch('notificationclick', event);
  return event;
};

const shellPageFor = (request: RequestInfo | URL): Response | undefined =>
  (request instanceof Request ? request.url : String(request)).startsWith(`${APPLICATION_ORIGIN}/index.html`)
    ? new Response(SHELL_PAGE)
    : undefined;

const precacheStorage = {
  keys: async () => [],
  delete: async () => true,
  match: async (request: RequestInfo | URL) => shellPageFor(request),
  open: async () => ({ match: async (request: RequestInfo | URL) => shellPageFor(request) }),
};

const withoutNetwork = async (): Promise<Response> => {
  throw new TypeError('Failed to fetch');
};

const installWorkerScope = (): void => {
  vi.stubGlobal('ExtendableEvent', WorkerEvent);
  vi.stubGlobal('FetchEvent', WorkerFetchEvent);
  vi.stubGlobal('Request', ApplicationRequest);
  vi.stubGlobal('__WB_DISABLE_DEV_LOGS', true);
  vi.stubGlobal('fetch', withoutNetwork);
  vi.stubGlobal('caches', precacheStorage);
  vi.stubGlobal('self', {
    caches: precacheStorage,
    __WB_MANIFEST: PRECACHE_MANIFEST,
    __WB_DISABLE_DEV_LOGS: true,
    location: new URL(`${APPLICATION_ORIGIN}/sw.js`),
    registration: {
      scope: `${APPLICATION_ORIGIN}/`,
      showNotification: async (title: string, options: NotificationOptions) => {
        shown.push({ title, options });
      },
    },
    clients: {
      claim: async () => undefined,
      matchAll: async () =>
        windows.map((open) => ({
          postMessage: (message: unknown) => open.messages.push(message),
          navigate: async (url: string) => open.visited.push(url),
          focus: async () => {
            open.focused = true;
            return open;
          },
        })),
      openWindow: async (url: string) => {
        opened.push(url);
        return null;
      },
    },
    skipWaiting: async () => undefined,
    addEventListener: (type: string, listener: Listener) => listeners.set(type, [...(listeners.get(type) ?? []), listener]),
  });
};

beforeAll(async () => {
  installWorkerScope();
  await import(SERVICE_WORKER_MODULE);
});

beforeEach(installWorkerScope);

describe('service worker', () => {
  it('le service worker laisse le navigateur charger lui-même la photo d’une annonce hébergée ailleurs, que sa propre politique de sécurité lui interdit d’aller chercher', async () => {
    // Given
    const photo = GARAGE_PHOTO;

    // When
    const photoRequest = fetched(photo);
    const stylesheetRequest = fetched(APPLICATION_STYLESHEET);
    await stylesheetRequest.answer?.catch(() => undefined);

    // Then
    expect(photoRequest.answer).toBeUndefined();
    expect(stylesheetRequest.answer).toBeDefined();
  });

  it('hors ligne, l’application ouverte depuis l’écran d’accueil s’affiche : la page de l’application vient du cache', async () => {
    // Given
    const launch = `${APPLICATION_ORIGIN}/?source=ecran-accueil`;

    // When
    const navigation = fetched(launch, 'navigate');

    // Then
    const page = await navigation.answer;
    expect(await page?.text()).toBe(SHELL_PAGE);
  });

  it('en ligne, la page vient du serveur avec ses en-têtes du jour : une politique de sécurité durcie sur le serveur s’applique dès l’ouverture suivante, sans attendre une nouvelle version de l’application', async () => {
    // Given
    const hardenedPolicy = "default-src 'self';img-src 'self' https:;script-src 'self'";
    vi.stubGlobal('fetch', async () => new Response(SHELL_PAGE, { headers: { 'content-security-policy': hardenedPolicy } }));

    // When
    const navigation = fetched(`${APPLICATION_ORIGIN}/`, 'navigate');

    // Then
    const page = await navigation.answer;
    expect(page?.headers.get('content-security-policy')).toBe(hardenedPolicy);
  });

  it('les annonces et les réglages ne sont jamais servis depuis le cache : l’API part toujours au serveur', () => {
    // Given
    const vehicles = `${APPLICATION_ORIGIN}/api/vehicles?status=nouveau`;

    // When
    const listRequest = fetched(vehicles);
    const openedInBrowser = fetched(`${APPLICATION_ORIGIN}/api/health`, 'navigate');

    // Then
    expect(listRequest.answer).toBeUndefined();
    expect(openedInBrowser.answer).toBeUndefined();
  });

  it('une notification « Nouvelle annonce » pour la Porsche 911 s’affiche avec son texte, et les fenêtres ouvertes rechargent leurs annonces', async () => {
    // Given
    windows.splice(0, windows.length, { url: `${APPLICATION_ORIGIN}/#/annonces`, messages: [], visited: [], focused: false });
    const payload = {
      title: 'Nouvelle annonce : Porsche 911 Carrera S',
      body: '2015, 42 000 km, 89 900 €, Mérignac, à 12 km',
      url: '/#/annonce/12',
      vehicleId: 12,
    };

    // When
    await settled(pushed({ json: () => payload }));

    // Then
    expect(shown.at(-1)).toEqual({
      title: 'Nouvelle annonce : Porsche 911 Carrera S',
      options: {
        body: '2015, 42 000 km, 89 900 €, Mérignac, à 12 km',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: 'vehicle-12',
        data: { url: '/#/annonce/12' },
      },
    });
    expect(windows[0]?.messages).toEqual([{ type: 'refresh' }]);
  });

  it('une notification push en texte brut affiche le titre et le texte par défaut', async () => {
    // Given
    const plainText = {
      json: () => {
        throw new SyntaxError('Unexpected token B in JSON at position 0');
      },
    };

    // When
    await settled(pushed(plainText));

    // Then
    expect(shown.at(-1)).toEqual({
      title: 'AutoVeille',
      options: { body: 'Nouvelle annonce', icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', tag: undefined, data: { url: '/' } },
    });
  });

  it('toucher la notification ramène l’application ouverte au premier plan sur la fiche de la Porsche, ou l’ouvre si elle était fermée', async () => {
    // Given
    windows.splice(0, windows.length, { url: `${APPLICATION_ORIGIN}/#/reglages`, messages: [], visited: [], focused: false });

    // When
    await settled(clicked({ url: '/#/annonce/12' }));
    const openWindow = windows[0];
    windows.splice(0, windows.length);
    await settled(clicked({ url: '/#/annonce/12' }));

    // Then
    expect(openWindow).toMatchObject({ visited: ['/#/annonce/12'], focused: true });
    expect(opened).toEqual(['/#/annonce/12']);
  });
});
