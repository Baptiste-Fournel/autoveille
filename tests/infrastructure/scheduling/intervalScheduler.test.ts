import { describe, expect, it } from 'vitest';
import type { SitePage } from '../../../src/application/ports/siteFetcher.js';
import { httpSitesFetching } from '../../../src/application/sources/fetchHttpSites.js';
import { mailboxPolling } from '../../../src/application/sources/pollMailbox.js';
import type { SourceRunSummary } from '../../../src/application/sources/sourceRunSummary.js';
import type { HttpSite } from '../../../src/domain/settings/types.js';
import { IntervalScheduler, type ScheduledSources } from '../../../src/infrastructure/scheduling/intervalScheduler.js';
import { fakeListingExtractor } from '../../fakes/fakeListingExtractor.js';
import { fakeSiteFetcher } from '../../fakes/fakeSiteFetcher.js';
import { settingsWithDealerMailbox } from '../../support/dealerMailbox.js';
import { LEPARKING_BMW_M3_RESULTS, LEPARKING_BMW_M3_SEARCH } from '../../support/leparkingListings.js';
import { mailWorld } from '../../support/mailWorld.js';
import { manualTimers } from '../../support/manualTimers.js';

interface CountedSources extends ScheduledSources {
  readonly mailboxPasses: () => number;
  readonly httpSitesPasses: () => number;
}

const countedSources = (): CountedSources => {
  let mailboxPasses = 0;
  let httpSitesPasses = 0;
  const done: SourceRunSummary = {
    source: 'email',
    ok: true,
    detail: '0 email(s) lu(s), 0 annonce(s), 0 nouvelle(s) correspondant aux réglages',
  };
  return {
    mailbox: {
      poll: async () => {
        mailboxPasses += 1;
        return done;
      },
    },
    httpSites: {
      fetchAll: async () => {
        httpSitesPasses += 1;
        return [];
      },
    },
    mailboxPasses: () => mailboxPasses,
    httpSitesPasses: () => httpSitesPasses,
  };
};

const MINUTE_MS = 60_000;

const leparking: HttpSite = { id: 'k3v9x2ab', name: 'Leparking', url: LEPARKING_BMW_M3_SEARCH, enabled: true };

const leparkingPage: SitePage = { kind: 'page', url: LEPARKING_BMW_M3_SEARCH, html: '<html>…</html>' };

describe('lectures planifiées de la boîte mail et des sites', () => {
  it('au démarrage du serveur, la boîte mail et les sites sont lus une première fois au bout de cinq secondes', () => {
    // Given
    const timers = manualTimers();
    const sources = countedSources();
    new IntervalScheduler(sources, timers).start({ mailboxMinutes: 2, httpSitesMinutes: 30 });

    // When
    timers.advanceBy(4_999);
    const passesBeforeFiveSeconds = [sources.mailboxPasses(), sources.httpSitesPasses()];
    timers.advanceBy(1);

    // Then
    expect(passesBeforeFiveSeconds).toEqual([0, 0]);
    expect([sources.mailboxPasses(), sources.httpSitesPasses()]).toEqual([1, 1]);
  });

  it('avec IMAP_POLL_MINUTES=2 et HTTP_POLL_MINUTES=30, la boîte est relue toutes les deux minutes et les sites toutes les demi-heures', () => {
    // Given
    const timers = manualTimers();
    const sources = countedSources();
    new IntervalScheduler(sources, timers).start({ mailboxMinutes: 2, httpSitesMinutes: 30 });

    // When
    timers.advanceBy(60 * MINUTE_MS);

    // Then
    expect(sources.mailboxPasses()).toBe(1 + 30);
    expect(sources.httpSitesPasses()).toBe(1 + 2);
  });

  it('des cadences réglées trop courtes sont relevées à une minute pour la boîte et cinq minutes pour les sites', () => {
    // Given
    const timers = manualTimers();
    const sources = countedSources();
    new IntervalScheduler(sources, timers).start({ mailboxMinutes: 0, httpSitesMinutes: 1 });

    // When
    timers.advanceBy(10 * MINUTE_MS);

    // Then
    expect(sources.mailboxPasses()).toBe(1 + 10);
    expect(sources.httpSitesPasses()).toBe(1 + 2);
  });

  it('l’arrêt du serveur juste après le démarrage arrête les lectures planifiées, la première comprise', () => {
    // Given
    const timers = manualTimers();
    const sources = countedSources();
    const scheduler = new IntervalScheduler(sources, timers);
    scheduler.start({ mailboxMinutes: 2, httpSitesMinutes: 30 });
    timers.advanceBy(3_000);

    // When
    scheduler.stop();
    timers.advanceBy(60 * MINUTE_MS);

    // Then
    expect([sources.mailboxPasses(), sources.httpSitesPasses()]).toEqual([0, 0]);
  });

  it('la relecture de la boîte tombe pendant la première lecture encore en cours : la boîte n’est ouverte qu’une fois', async () => {
    // Given
    const timers = manualTimers();
    const world = mailWorld([]);
    const polling = mailboxPolling(world);
    let passes: readonly Promise<SourceRunSummary>[] = [];
    const mailbox = {
      poll: () => {
        const pass = polling.poll();
        passes = [...passes, pass];
        return pass;
      },
    };
    new IntervalScheduler({ mailbox, httpSites: countedSources().httpSites }, timers).start({ mailboxMinutes: 1, httpSitesMinutes: 30 });

    // When
    timers.advanceBy(MINUTE_MS);
    await Promise.all(passes);

    // Then
    expect(passes).toHaveLength(2);
    expect(passes[1]).toBe(passes[0]);
    expect(world.mailboxReader.openings()).toHaveLength(1);
  });

  it('la relecture des sites tombe pendant la lecture des sites encore en cours : les sites ne sont pas relus', async () => {
    // Given
    const timers = manualTimers();
    const world = {
      ...mailWorld([], { settings: settingsWithDealerMailbox({ httpSites: [leparking] }) }),
      siteFetcher: fakeSiteFetcher({ [LEPARKING_BMW_M3_SEARCH]: leparkingPage }),
      extractor: fakeListingExtractor({
        pages: { [LEPARKING_BMW_M3_SEARCH]: { listings: LEPARKING_BMW_M3_RESULTS, method: 'structuredData' } },
      }),
    };
    const fetching = httpSitesFetching(world);
    let passes: readonly Promise<readonly SourceRunSummary[]>[] = [];
    const httpSites = {
      fetchAll: () => {
        const pass = fetching.fetchAll();
        passes = [...passes, pass];
        return pass;
      },
    };
    new IntervalScheduler({ mailbox: countedSources().mailbox, httpSites }, timers).start({ mailboxMinutes: 2, httpSitesMinutes: 5 });

    // When
    timers.advanceBy(5 * MINUTE_MS);
    const [first, second] = await Promise.all(passes);

    // Then
    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
    expect(world.siteFetcher.requested()).toEqual([LEPARKING_BMW_M3_SEARCH]);
  });
});
