import { describe, expect, it } from 'vitest';
import { hashPassword } from './auth.js';
import { Store } from './db.js';
import { buildServer } from './server.js';

describe('Sites screen', () => {
  it('offers no javascript: link that an email read before the fix left in the database', async () => {
    // Given
    const store = new Store(':memory:');
    store.setSecret('password_hash', hashPassword('mot-de-passe-de-test'));
    store.markEmail({
      message_id: '<digest-61@mail-alerte.lacentrale.fr>', uid: 1, subject: '61 nouveaux véhicules correspondent à votre recherche', sender: 'info@mail-alerte.lacentrale.fr',
      received_at: '2026-10-15T06:36:59Z', site: 'lacentrale', parsed_count: 3, error: null,
      parsed_json: JSON.stringify({ listings: [], pending: 0, ignored: 0, announced: 61, kind: 'new', moreUrl: 'javascript://www.lacentrale.fr/%0aalert(document.domain)' }),
    });
    store.recordAlert({ site: 'paruvendu', criteria: "Voiture d'occasion, Bordeaux (33000), Rayon de 100 km", confirmedAt: '2026-10-14T09:00:00Z', manageUrl: 'javascript:alert(document.domain)' });
    const { app } = await buildServer({ store });
    const login = await app.inject({ method: 'POST', url: '/api/login', payload: { password: 'mot-de-passe-de-test' } });
    const session = login.cookies.find((c) => c.name === 'av_session');

    // When
    const res = await app.inject({ method: 'GET', url: '/api/sources', cookies: { av_session: session?.value ?? '' } });

    // Then
    const sites = res.json().sites as Array<{ key: string; digest: { announced: number; url: string | null } | null; alert: { manageUrl?: string } | null }>;
    expect(sites.find((s) => s.key === 'lacentrale')?.digest).toMatchObject({ announced: 61, url: null });
    expect(sites.find((s) => s.key === 'paruvendu')?.alert?.manageUrl).toBeUndefined();
    await app.close();
  });
});
