import { siteForHost } from './catalog.js';
import { isWebAddress } from './webAddress.js';

export interface UnwrappedUrl {
  readonly url: string;
  readonly resolved: boolean;
}

const TRACKING_PATH = /^\/(click|clic|clicks|r|e|ls|l|t|c|track|tracking|redirect|redir|go|url|link|links|lnk|wf|ss|uni|CL0)(\/|$)/i;

const TRACKING_SUBDOMAIN =
  /^(click|clic|clicks|link|links|lnk|email|emails|mail|mailing|e|em|t|r|go|url|redirect|track|tracking|news|newsletter|info|notif|notification|notifications|alert|alerte|alertes|alerts|m|msg)\./i;

const urlOf = (text: string): URL | undefined => (URL.canParse(text) ? new URL(text) : undefined);

function decodedOrAsIs(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

const knownSitePage = (candidate: URL | undefined): URL | undefined =>
  candidate && isWebAddress(candidate.href) && siteForHost(candidate.hostname) ? candidate : undefined;

const destinationInQuery = (url: URL): URL | undefined =>
  [...url.searchParams.values()]
    .map((value) => knownSitePage(urlOf(value) ?? urlOf(decodedOrAsIs(value))))
    .find((candidate) => candidate !== undefined);

const destinationInPath = (url: URL): URL | undefined => {
  const inline = /https?:\/\/[^\s"'<>]+/i.exec(decodedOrAsIs(url.pathname + url.search));
  return inline ? knownSitePage(urlOf(inline[0])) : undefined;
};

export function unwrapTrackingUrl(href: string): UnwrappedUrl {
  const url = urlOf(href);
  if (!url) {
    return { url: href, resolved: false };
  }
  const trackingHost = TRACKING_SUBDOMAIN.test(url.hostname);
  if (siteForHost(url.hostname) && !trackingHost) {
    return { url: href, resolved: true };
  }
  const destination = destinationInQuery(url) ?? destinationInPath(url);
  if (destination) {
    return { url: destination.toString(), resolved: true };
  }
  return { url: href, resolved: !(trackingHost || TRACKING_PATH.test(url.pathname)) };
}
