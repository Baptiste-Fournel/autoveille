import { test as base, expect, type Page, type Route } from '@playwright/test';
import { FAKE_NOW } from '../../fakes/fakeClock.js';
import { OWNER_PASSWORD } from '../../support/authentication.js';

const THIS_MACHINE = ['127.0.0.1', 'localhost'];

const GOOGLE_FONTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

const LISTING_SITE_PAGE =
  '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Annonce</title></head><body><h1>Annonce</h1></body></html>';

export interface RequestSeen {
  readonly method: string;
  readonly url: URL;
}

export interface PhoneTraffic {
  readonly requested: () => readonly RequestSeen[];
}

const isOnThisMachine = (address: URL): boolean => THIS_MACHINE.includes(address.hostname);

const simulatedInternet = async (route: Route): Promise<void> => {
  if (route.request().isNavigationRequest()) {
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: LISTING_SITE_PAGE });
    return;
  }
  await route.abort('internetdisconnected');
};

const isGoogleFonts = ({ url }: RequestSeen): boolean => GOOGLE_FONTS.includes(url.hostname);

const isContentSecurityPolicyReport = (text: string): boolean => text.includes('Content Security Policy');

export const test = base.extend<{ traffic: PhoneTraffic }>({
  traffic: [
    async ({ context, page }, use) => {
      const requested: RequestSeen[] = [];
      const policyViolations: string[] = [];
      const pageErrors: string[] = [];
      context.on('request', (request) => {
        requested.push({ method: request.method(), url: new URL(request.url()) });
      });
      page.on('console', (message) => {
        if (isContentSecurityPolicyReport(message.text())) {
          policyViolations.push(message.text());
        }
      });
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });
      await context.route((address) => !isOnThisMachine(address), simulatedInternet);
      await page.clock.setFixedTime(new Date(FAKE_NOW));

      await use({ requested: () => [...requested] });

      expect(requested.filter(isGoogleFonts).map(({ url }) => url.href)).toEqual([]);
      expect(policyViolations).toEqual([]);
      expect(pageErrors).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export const signedInOnThisPhone = async (page: Page): Promise<void> => {
  const answer = await page.request.post('/api/login', { data: { password: OWNER_PASSWORD } });
  expect(answer.ok()).toBe(true);
};

export const toast = (page: Page) => page.getByRole('status');
