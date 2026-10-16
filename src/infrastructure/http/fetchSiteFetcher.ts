import type { SiteFetcher, SitePage } from '../../application/ports/siteFetcher.js';
import { errorMessage } from '../../application/sources/errorMessage.js';
import { robotsAllows } from '../../domain/sites/robots.js';
import { type DeadlineTimers, withDeadline } from './deadline.js';
import type { Web } from './web.js';

const USER_AGENT = "AutoVeille/1.0 (veille d'annonces; respecte robots.txt)";

const PAGE_HEADERS = { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml', 'accept-language': 'fr-FR,fr;q=0.9' };

const ROBOTS_TIMEOUT_MS = 8_000;

const PAGE_TIMEOUT_MS = 15_000;

const REFUSED_STATUSES: readonly number[] = [401, 403, 429];

const ANTI_BOT_PAGE = /<title>[^<]*(access denied|just a moment|attention required|captcha|vérification)/i;

type PageAnswer = { readonly response: Response } | { readonly failure: string };

const robotsForbid = async <Handle>(web: Web<Handle>, page: URL): Promise<boolean> => {
  try {
    return await withDeadline(web.timers, ROBOTS_TIMEOUT_MS, async (signal) => {
      const robots = await web.fetch(`${page.origin}/robots.txt`, { headers: PAGE_HEADERS, signal });
      return robots.ok && !robotsAllows(await robots.text(), page.pathname + page.search);
    });
  } catch {
    return false;
  }
};

const readPage = <Handle>(web: Web<Handle>, page: URL): Promise<SitePage> =>
  withDeadline(web.timers, PAGE_TIMEOUT_MS, async (signal) => {
    const answer = await web.fetch(page.toString(), { headers: PAGE_HEADERS, signal }).then(
      (response): PageAnswer => ({ response }),
      (error: unknown): PageAnswer => ({ failure: errorMessage(error) }),
    );
    if ('failure' in answer) {
      return { kind: 'unreachable', message: answer.failure };
    }
    const { response } = answer;
    if (REFUSED_STATUSES.includes(response.status)) {
      return { kind: 'refused', status: response.status };
    }
    if (!response.ok) {
      return { kind: 'unexpectedStatus', status: response.status };
    }
    const html = await response.text();
    return ANTI_BOT_PAGE.test(html) ? { kind: 'antiBotPage' } : { kind: 'page', url: page.toString(), html };
  });

export const fetchSiteFetcher = <Handle>(fetchImpl: typeof fetch, timers: DeadlineTimers<Handle>): SiteFetcher => ({
  fetchPage: async (url) => {
    if (!URL.canParse(url)) {
      return { kind: 'invalidAddress' };
    }
    const page = new URL(url);
    const web = { fetch: fetchImpl, timers };
    return (await robotsForbid(web, page)) ? { kind: 'disallowedByRobots' } : readPage(web, page);
  },
});
