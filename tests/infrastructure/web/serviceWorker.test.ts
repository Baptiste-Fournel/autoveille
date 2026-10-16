import { runInNewContext } from 'node:vm';
import { describe, expect, it, onTestFinished } from 'vitest';
import { composedApplication } from '../../support/composedApplication.js';

const APPLICATION_ORIGIN = 'https://autoveille.example.fr';

const GARAGE_PHOTO = 'https://cdn.garage-exemple.fr/alpine-a110.jpg';

const SCREEN_FONT = 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&display=swap';

const APPLICATION_STYLESHEET = `${APPLICATION_ORIGIN}/styles.css`;

type FetchListener = (event: { readonly request: Request; readonly respondWith: (answer: Promise<Response>) => void }) => void;

interface InstalledWorker {
  readonly takesOver: (url: string) => boolean;
}

function installedWorker(script: string): InstalledWorker {
  const fetchListeners: FetchListener[] = [];
  const workerScope = {
    location: new URL(APPLICATION_ORIGIN),
    addEventListener: (type: string, listener: FetchListener) => {
      if (type === 'fetch') fetchListeners.push(listener);
    },
  };
  runInNewContext(script, {
    self: workerScope,
    URL,
    caches: { open: async () => ({ put: async () => undefined }), match: async () => undefined },
    fetch: async () => new Response(''),
  });
  return {
    takesOver: (url) => {
      const answers: Promise<Response>[] = [];
      for (const listener of fetchListeners) {
        listener({ request: new Request(url), respondWith: (answer) => answers.push(answer) });
      }
      return answers.length > 0;
    },
  };
}

describe('service worker', () => {
  it('le service worker laisse le navigateur charger lui-même la photo d’une annonce et la police de l’écran, hébergées ailleurs, que sa propre politique de sécurité lui interdit d’aller chercher', async () => {
    // Given
    const application = await composedApplication();
    onTestFinished(() => application.stop());
    const served = await application.server.inject({ method: 'GET', url: '/sw.js' });
    const worker = installedWorker(served.body);

    // When
    const photoTakenOver = worker.takesOver(GARAGE_PHOTO);
    const fontTakenOver = worker.takesOver(SCREEN_FONT);
    const stylesheetTakenOver = worker.takesOver(APPLICATION_STYLESHEET);

    // Then
    expect(String(served.headers['content-security-policy']).split(';')).toContain("connect-src 'self'");
    expect(photoTakenOver).toBe(false);
    expect(fontTakenOver).toBe(false);
    expect(stylesheetTakenOver).toBe(true);
  });
});
