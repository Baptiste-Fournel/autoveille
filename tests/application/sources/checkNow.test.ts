import { describe, expect, it } from 'vitest';
import { checkNow } from '../../../src/application/sources/checkNow.js';
import { httpSitesFetching } from '../../../src/application/sources/fetchHttpSites.js';
import { mailboxPolling } from '../../../src/application/sources/pollMailbox.js';
import { httpSitesWorld, LEPARKING_PAGE, LEPARKING_SITE } from '../../support/httpSitesWorld.js';
import { LEPARKING_BMW_M3_SEARCH } from '../../support/leparkingListings.js';

describe('« Vérifier maintenant »', () => {
  it('« Vérifier maintenant » relève d’abord la boîte des alertes, sans nouvel email ce matin, puis la recherche Leparking des BMW M3, et rend les deux bilans', async () => {
    // Given
    const world = httpSitesWorld([LEPARKING_SITE], { [LEPARKING_BMW_M3_SEARCH]: LEPARKING_PAGE });

    // When
    const summary = await checkNow({ mailbox: mailboxPolling(world), httpSites: httpSitesFetching(world) });

    // Then
    expect(summary).toEqual({
      mail: { source: 'email', ok: true, detail: '0 email(s) lu(s), 0 annonce(s), 0 nouvelle(s) correspondant aux réglages' },
      http: [
        { source: 'Leparking', ok: true, detail: '6 annonce(s) lue(s) (données structurées). 3 nouvelle(s) correspondant aux réglages.' },
      ],
    });
    expect(world.sourceRuns.all().map((run) => run.source)).toEqual(['email', 'http:k3v9x2ab']);
  });
});
