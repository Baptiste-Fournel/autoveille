import { type SiteDef, siteForHost } from '../../domain/sites/catalog.js';
import { unwrapTrackingUrl } from '../../domain/sites/tracking.js';
import { isWebAddress } from '../../domain/sites/webAddress.js';

const MORE_RESULTS_WORDING =
  /toutes? les (annonces|r[ée]sultats|v[ée]hicules|offres)|tous les r[ée]sultats|voir (les )?\d+|d[ée]couvr\w* toutes|consultez toutes|voir plus d|afficher (les|toutes)/i;

export interface CaptionedLink {
  readonly href: string;
  readonly caption: string;
}

export const moreResultsUrl = (
  link: CaptionedLink,
  emailSite: SiteDef | undefined,
  resolvedLinks: ReadonlyMap<string, string>,
): string | undefined => {
  if (!MORE_RESULTS_WORDING.test(link.caption)) {
    return undefined;
  }
  const destination = resolvedLinks.get(link.href) ?? unwrapTrackingUrl(link.href).url;
  if (!isWebAddress(destination) || !URL.canParse(destination)) {
    return undefined;
  }
  return !emailSite || siteForHost(new URL(destination).hostname)?.key === emailSite.key ? destination : undefined;
};
