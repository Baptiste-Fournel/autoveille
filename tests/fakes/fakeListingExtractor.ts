import type {
  EmailContent,
  EmailMessage,
  EmailReading,
  FetchedPage,
  ListingExtractor,
  PageReading,
  VisibleContent,
} from '../../src/application/ports/listingExtractor.js';

export type PreparedReading = EmailReading | ((resolvedLinks: ReadonlyMap<string, string>) => EmailReading);

export interface PreparedExtractions {
  readonly emails?: Readonly<Record<string, EmailMessage>>;
  readonly readings?: Readonly<Record<string, PreparedReading>>;
  readonly visible?: Readonly<Record<string, VisibleContent>>;
  readonly pages?: Readonly<Record<string, PageReading>>;
}

export interface EmailExtraction {
  readonly email: EmailContent;
  readonly resolvedLinks: ReadonlyMap<string, string>;
}

export interface FakeListingExtractor extends ListingExtractor {
  readonly emailExtractions: () => readonly EmailExtraction[];
  readonly pagesRead: () => readonly FetchedPage[];
}

export const NO_LISTING_READING: EmailReading = { listings: [], pendingLinks: [], ignoredLinks: 0 };

const NOTHING_VISIBLE: VisibleContent = { text: '', links: [] };

const NO_PAGE_LISTING: PageReading = { listings: [], method: 'links' };

const prepared = <T>(table: Readonly<Record<string, T>> | undefined, key: string): T | undefined =>
  table !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;

export const fakeListingExtractor = (extractions: PreparedExtractions = {}): FakeListingExtractor => {
  let emailExtractions: readonly EmailExtraction[] = [];
  let pagesRead: readonly FetchedPage[] = [];
  return {
    readEmail: async (source) => {
      const email = prepared(extractions.emails, new TextDecoder().decode(source));
      if (email === undefined) {
        throw new Error('Email illisible : aucune lecture préparée pour cette source');
      }
      return email;
    },
    listingsFromEmail: (email, resolvedLinks) => {
      emailExtractions = [...emailExtractions, { email, resolvedLinks }];
      const reading = prepared(extractions.readings, email.messageId) ?? NO_LISTING_READING;
      return typeof reading === 'function' ? reading(resolvedLinks) : reading;
    },
    visibleContent: (email) => prepared(extractions.visible, email.html ?? email.text ?? '') ?? NOTHING_VISIBLE,
    listingsFromPage: (page) => {
      pagesRead = [...pagesRead, page];
      return prepared(extractions.pages, page.url) ?? NO_PAGE_LISTING;
    },
    emailExtractions: () => emailExtractions,
    pagesRead: () => pagesRead,
  };
};
