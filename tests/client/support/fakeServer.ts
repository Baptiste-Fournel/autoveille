export interface RecordedRequest {
  readonly method: string;
  readonly url: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly headers: Headers;
  readonly body: unknown;
}

export type Answer = (request: RecordedRequest) => Response | Promise<Response>;

interface Route {
  readonly method: string;
  readonly path: string;
  readonly answer: Answer;
}

export interface FakeServer {
  readonly fetch: typeof fetch;
  readonly requests: readonly RecordedRequest[];
  readonly on: (method: string, path: string, answer: Answer) => void;
  readonly requestsTo: (method: string, path: string) => readonly RecordedRequest[];
}

const APPLICATION_ORIGIN = 'https://autoveille.example.fr';

export const json = (status: number, body: unknown, headers: Readonly<Record<string, string>> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

export const notModified = (): Response => new Response(null, { status: 304 });

const bodyOf = (init: RequestInit | undefined): unknown => (typeof init?.body === 'string' ? JSON.parse(init.body) : undefined);

export const fakeServer = (): FakeServer => {
  const routes: Route[] = [];
  const requests: RecordedRequest[] = [];
  return {
    requests,
    on: (method, path, answer) => {
      routes.unshift({ method, path, answer });
    },
    requestsTo: (method, path) => requests.filter((request) => request.method === method && request.path === path),
    fetch: async (input, init) => {
      const address = new URL(String(input), APPLICATION_ORIGIN);
      const request: RecordedRequest = {
        method: init?.method ?? 'GET',
        url: `${address.pathname}${address.search}`,
        path: address.pathname,
        query: address.searchParams,
        headers: new Headers(init?.headers),
        body: bodyOf(init),
      };
      requests.push(request);
      const route = routes.find((candidate) => candidate.method === request.method && candidate.path === request.path);
      return route === undefined ? json(404, { error: 'inconnu' }) : route.answer(request);
    },
  };
};
