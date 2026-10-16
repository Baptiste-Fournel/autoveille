import type { EmailContent, EmailReading, ListingExtractor, PendingLink } from '../ports/listingExtractor.js';
import type { RedirectResolver } from '../ports/redirectResolver.js';

export interface AlertEmailReadingDependencies {
  readonly extractor: ListingExtractor;
  readonly redirectResolver: RedirectResolver;
}

const resolvedDestinations = async (
  resolver: RedirectResolver,
  links: readonly PendingLink[],
  maxResolvedLinks: number,
): Promise<ReadonlyMap<string, string>> => {
  const destinations = await Promise.all(
    links.slice(0, maxResolvedLinks).map(async (link) => [link.href, await resolver.resolve(link.href)] as const),
  );
  return new Map(destinations.flatMap(([href, destination]) => (destination ? [[href, destination] as const] : [])));
};

export const readAlertEmail = async (
  dependencies: AlertEmailReadingDependencies,
  content: EmailContent,
  maxResolvedLinks: number,
): Promise<EmailReading> => {
  const firstReading = dependencies.extractor.listingsFromEmail(content, new Map());
  if (firstReading.pendingLinks.length === 0) {
    return firstReading;
  }
  return dependencies.extractor.listingsFromEmail(
    content,
    await resolvedDestinations(dependencies.redirectResolver, firstReading.pendingLinks, maxResolvedLinks),
  );
};
