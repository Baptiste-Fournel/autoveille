import type { RedirectResolver } from '../../application/ports/redirectResolver.js';
import { siteForHost } from '../../domain/sites/catalog.js';
import { isWebAddress } from '../../domain/sites/webAddress.js';
import { type DeadlineTimers, withDeadline } from './deadline.js';
import type { Web } from './web.js';

const MAX_HOPS = 6;

const HOP_TIMEOUT_MS = 8_000;

const REDIRECTOR_USER_AGENT = 'Mozilla/5.0 (compatible; AutoVeille/1.0)';

const REDIRECTION_IN_PAGE = /(?:url=|location(?:\.href)?\s*=\s*['"])(https?:\/\/[^'"\s>]+)/i;

const isRedirection = (status: number): boolean => status >= 300 && status < 400;

const redirectionInPage = async (response: Response): Promise<string | undefined> => {
  const body = response.status === 200 ? await response.text().catch(() => '') : '';
  return REDIRECTION_IN_PAGE.exec(body)?.[1];
};

const nextAddress = <Handle>(web: Web<Handle>, address: string): Promise<string | undefined> =>
  withDeadline(web.timers, HOP_TIMEOUT_MS, async (signal) => {
    const response = await web.fetch(address, {
      method: 'GET',
      redirect: 'manual',
      signal,
      headers: { 'user-agent': REDIRECTOR_USER_AGENT },
    });
    const location = response.headers.get('location');
    return isRedirection(response.status) && location ? new URL(location, address).toString() : redirectionInPage(response);
  });

const follow = async <Handle>(web: Web<Handle>, href: string, address: string, hopsLeft: number): Promise<string | undefined> => {
  if (hopsLeft === 0) {
    return address;
  }
  const next = await nextAddress(web, address);
  if (next === undefined) {
    return address !== href ? address : undefined;
  }
  if (!isWebAddress(next)) {
    return undefined;
  }
  return siteForHost(new URL(next).hostname) ? next : follow(web, href, next, hopsLeft - 1);
};

export const fetchRedirectResolver = <Handle>(fetchImpl: typeof fetch, timers: DeadlineTimers<Handle>): RedirectResolver => ({
  resolve: (href) => follow({ fetch: fetchImpl, timers }, href, href, MAX_HOPS).catch(() => undefined),
});
