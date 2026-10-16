export interface WebRequest {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

export type WebAnswer = (request: WebRequest) => Response | Promise<Response>;

export interface SimulatedWeb {
  readonly fetch: typeof fetch;
  readonly requests: () => readonly WebRequest[];
  readonly requested: () => readonly string[];
}

const addressOf = (input: Parameters<typeof fetch>[0]): string => {
  if (typeof input === 'string') {
    return input;
  }
  return input instanceof URL ? input.toString() : input.url;
};

export const simulatedWeb = (answers: Readonly<Record<string, WebAnswer>>): SimulatedWeb => {
  let requests: readonly WebRequest[] = [];
  return {
    fetch: async (input, init) => {
      const request = { url: addressOf(input), init };
      requests = [...requests, request];
      const answer = Object.hasOwn(answers, request.url) ? answers[request.url] : undefined;
      if (answer === undefined) {
        throw new TypeError('fetch failed');
      }
      return answer(request);
    },
    requests: () => requests,
    requested: () => requests.map((request) => request.url),
  };
};

export const headerSent = (request: WebRequest | undefined, name: string): string | null => new Headers(request?.init?.headers).get(name);

export const answering =
  (body: string | null, status = 200, headers: Readonly<Record<string, string>> = {}): WebAnswer =>
  () =>
    new Response(body, { status, headers });

export const htmlPage = (html: string, status = 200): WebAnswer => answering(html, status, { 'content-type': 'text/html; charset=utf-8' });

export const redirectingTo = (location: string, status = 302): WebAnswer => answering(null, status, { location });

export const silentUntilAborted: WebAnswer = ({ init }) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
  });

export const cutOffDuringBody =
  (firstBytes: string, status = 200, headers: Readonly<Record<string, string>> = {}): WebAnswer =>
  () =>
    new Response(
      new ReadableStream({
        start: (controller) => {
          controller.enqueue(new TextEncoder().encode(firstBytes));
          controller.error(new TypeError('terminated'));
        },
      }),
      { status, headers },
    );
