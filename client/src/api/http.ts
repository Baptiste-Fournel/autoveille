import { isRecord } from '../guards/isRecord';
import { ApiError } from './ApiError';

const SESSION_EXPIRED_TEXT = 'Connexion expirée, reconnectez-vous.';

const UNAUTHORIZED = 401;

const NOT_MODIFIED = 304;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type Revalidation<T> = { readonly changed: false } | { readonly changed: true; readonly body: T; readonly etag: string | null };

export interface Http {
  readonly send: <T>(method: HttpMethod, url: string, body?: unknown) => Promise<T>;
  readonly revalidate: <T>(url: string, etag: string | null) => Promise<Revalidation<T>>;
}

export interface HttpDependencies {
  readonly fetch: typeof fetch;
  readonly onUnauthorized: (needsSetup: boolean) => void;
}

const failureText = (body: unknown, status: number): string =>
  isRecord(body) && typeof body.error === 'string' && body.error !== '' ? body.error : `Erreur ${status}`;

const needsSetupIn = (body: unknown): boolean => isRecord(body) && body.needsSetup === true;

const refusalBodyOf = (response: Response): Promise<unknown> => response.json().catch(() => null);

const bodyTypedByTheContract = <T>(response: Response): Promise<T> => response.json().catch(() => null);

export const createHttp = ({ fetch, onUnauthorized }: HttpDependencies): Http => {
  const refusalOf = async (response: Response): Promise<ApiError> => {
    const body = await refusalBodyOf(response);
    if (response.status === UNAUTHORIZED) {
      onUnauthorized(needsSetupIn(body));
      return new ApiError(SESSION_EXPIRED_TEXT, UNAUTHORIZED);
    }
    return new ApiError(failureText(body, response.status), response.status);
  };

  const exchange = async (method: HttpMethod, url: string, body: unknown, headers: Readonly<Record<string, string>>) => {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? headers : { ...headers, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
    if (!response.ok && response.status !== NOT_MODIFIED) {
      throw await refusalOf(response);
    }
    return response;
  };

  return {
    send: async <T>(method: HttpMethod, url: string, body?: unknown): Promise<T> =>
      bodyTypedByTheContract<T>(await exchange(method, url, body, {})),
    revalidate: async <T>(url: string, etag: string | null): Promise<Revalidation<T>> => {
      const response = await exchange('GET', url, undefined, etag === null ? {} : { 'if-none-match': etag });
      if (response.status === NOT_MODIFIED) {
        return { changed: false };
      }
      return { changed: true, body: await bodyTypedByTheContract<T>(response), etag: response.headers.get('etag') };
    },
  };
};
