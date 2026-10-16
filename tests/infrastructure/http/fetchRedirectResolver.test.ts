import { describe, expect, it, vi } from 'vitest';
import { fetchRedirectResolver } from '../../../src/infrastructure/http/fetchRedirectResolver.js';
import { manualTimers } from '../../support/manualTimers.js';
import { cutOffDuringBody, headerSent, htmlPage, redirectingTo, silentUntilAborted, simulatedWeb } from '../../support/simulatedWeb.js';

const LA_CENTRALE_CLICK = 'https://clicks.mail-alerte.lacentrale.fr/f/a/t4~~/AAAHahA~/x';

const LA_CENTRALE_AD = 'https://www.lacentrale.fr/auto-occasion-annonce-69115730001.html';

const LA_CENTRALE_TRACKED_LINK = 'https://click.mail.lacentrale.fr/r/abc123?x=1';

const ROUTER_PAGE = 'https://r.emailing-annonces.fr/mk/cl/f/7Hx2';

const LEBONCOIN_AD = 'https://www.leboncoin.fr/ad/voitures/2841736521';

const PARUVENDU_CLICK = 'https://t.paruvendu.fr/c/eJx1jk0OgjAQha8yBzBMrWjdIQYXLjSCF2hgxEZoSad';

const PARUVENDU_AD = 'https://www.paruvendu.fr/a/voiture-occasion/porsche/911/1287654321A1KVVOPO911';

describe('suivi d’un lien de suivi jusqu’à l’annonce', () => {
  it('le lien de suivi d’un email La Centrale répond 302 vers l’annonce : l’annonce est trouvée sans être demandée, en une requête à notre nom', async () => {
    // Given
    const web = simulatedWeb({ [LA_CENTRALE_CLICK]: redirectingTo(LA_CENTRALE_AD) });

    // When
    const destination = await fetchRedirectResolver(web.fetch, manualTimers()).resolve(LA_CENTRALE_CLICK);

    // Then
    expect(destination).toBe(LA_CENTRALE_AD);
    expect(web.requested()).toEqual([LA_CENTRALE_CLICK]);
    const [request] = web.requests();
    expect(request?.init?.method).toBe('GET');
    expect(request?.init?.redirect).toBe('manual');
    expect(headerSent(request, 'user-agent')).toBe('Mozilla/5.0 (compatible; AutoVeille/1.0)');
  });

  it('un redirecteur qui répond 302 vers une page intermédiaire, puis 200 avec un meta refresh, mène à l’annonce Leboncoin', async () => {
    // Given
    const web = simulatedWeb({
      [LA_CENTRALE_TRACKED_LINK]: redirectingTo(ROUTER_PAGE),
      [ROUTER_PAGE]: htmlPage(`<html><head><meta http-equiv="refresh" content="0;url=${LEBONCOIN_AD}"></head><body></body></html>`),
    });

    // When
    const destination = await fetchRedirectResolver(web.fetch, manualTimers()).resolve(LA_CENTRALE_TRACKED_LINK);

    // Then
    expect(destination).toBe(LEBONCOIN_AD);
    expect(web.requested()).toEqual([LA_CENTRALE_TRACKED_LINK, ROUTER_PAGE]);
  });

  it('un redirecteur qui répond 302 vers une page intermédiaire dont la connexion coupe au milieu de la page : l’adresse intermédiaire est gardée, comme une page sans redirection', async () => {
    // Given
    const web = simulatedWeb({
      [LA_CENTRALE_TRACKED_LINK]: redirectingTo(ROUTER_PAGE),
      [ROUTER_PAGE]: cutOffDuringBody('<html><head><meta http-equiv="refresh" content="0;url=https://www.lebon', 200, {
        'content-type': 'text/html; charset=utf-8',
      }),
    });

    // When
    const destination = await fetchRedirectResolver(web.fetch, manualTimers()).resolve(LA_CENTRALE_TRACKED_LINK);

    // Then
    expect(destination).toBe(ROUTER_PAGE);
    expect(web.requested()).toEqual([LA_CENTRALE_TRACKED_LINK, ROUTER_PAGE]);
  });

  it('un redirecteur ParuVendu qui répond 200 avec une redirection en JavaScript mène à l’annonce, sans exécuter la page', async () => {
    // Given
    const web = simulatedWeb({
      [PARUVENDU_CLICK]: htmlPage(`<html><body><script>window.location.href = "${PARUVENDU_AD}";</script></body></html>`),
    });

    // When
    const destination = await fetchRedirectResolver(web.fetch, manualTimers()).resolve(PARUVENDU_CLICK);

    // Then
    expect(destination).toBe(PARUVENDU_AD);
    expect(web.requested()).toEqual([PARUVENDU_CLICK]);
  });

  it('une chaîne de suivi de plus de six redirections : on s’arrête après six requêtes, sur la dernière adresse atteinte', async () => {
    // Given
    const hop = (rank: number): string => `https://clic.routeur-publicitaire.fr/r/${rank}`;
    const web = simulatedWeb(
      Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((rank) => [hop(rank), redirectingTo(rank === 7 ? LEBONCOIN_AD : hop(rank + 1))])),
    );

    // When
    const destination = await fetchRedirectResolver(web.fetch, manualTimers()).resolve(hop(1));

    // Then
    expect(destination).toBe(hop(7));
    expect(web.requested()).toEqual([hop(1), hop(2), hop(3), hop(4), hop(5), hop(6)]);
  });

  it('un lien de suivi qui mène, par un 302, au site d’un garage hors catalogue : la page du garage est la destination', async () => {
    // Given
    const garagePage = 'https://www.garage-des-graves.fr/vehicule/porsche-911-carrera-4s-123456';
    const web = simulatedWeb({
      [LA_CENTRALE_TRACKED_LINK]: redirectingTo(garagePage),
      [garagePage]: htmlPage('<html><head><title>Porsche 911 Carrera 4S</title></head><body></body></html>'),
    });

    // When
    const destination = await fetchRedirectResolver(web.fetch, manualTimers()).resolve(LA_CENTRALE_TRACKED_LINK);

    // Then
    expect(destination).toBe(garagePage);
  });

  it('une page de suivi qui n’emmène nulle part (200 sans redirection) : le lien reste à résoudre', async () => {
    // Given
    const web = simulatedWeb({ [LA_CENTRALE_TRACKED_LINK]: htmlPage('<html><body>Merci de votre visite</body></html>') });

    // When
    const destination = await fetchRedirectResolver(web.fetch, manualTimers()).resolve(LA_CENTRALE_TRACKED_LINK);

    // Then
    expect(destination).toBeUndefined();
  });

  it('le redirecteur de suivi est injoignable (panne DNS) : le lien reste à résoudre, sans erreur', async () => {
    // Given
    const web = simulatedWeb({});

    // When
    const destination = await fetchRedirectResolver(web.fetch, manualTimers()).resolve(LA_CENTRALE_TRACKED_LINK);

    // Then
    expect(destination).toBeUndefined();
    expect(web.requested()).toEqual([LA_CENTRALE_TRACKED_LINK]);
  });

  it('un redirecteur qui ne répond pas : on l’attend huit secondes, puis le lien reste à résoudre', async () => {
    // Given
    const timers = manualTimers();
    const web = simulatedWeb({ [LA_CENTRALE_TRACKED_LINK]: silentUntilAborted });
    const outcome = vi.fn();

    // When
    void fetchRedirectResolver(web.fetch, timers).resolve(LA_CENTRALE_TRACKED_LINK).then(outcome);
    await timers.elapse(7_999);
    const beforeEightSeconds = outcome.mock.calls.length;
    await timers.elapse(1);

    // Then
    expect(beforeEightSeconds).toBe(0);
    expect(outcome).toHaveBeenCalledWith(undefined);
  });
});
