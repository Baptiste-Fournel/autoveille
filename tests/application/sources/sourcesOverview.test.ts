import { describe, expect, it } from 'vitest';
import type { ProcessedEmail } from '../../../src/application/ports/mailboxStateRepository.js';
import { sourcesOverview } from '../../../src/application/sources/sourcesOverview.js';
import { recordAlertConfirmation } from '../../../src/domain/settings/alerts.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import type { AlertInfo } from '../../../src/domain/settings/types.js';
import { fakeMailboxStateRepository } from '../../fakes/fakeMailboxStateRepository.js';
import { fakeSettingsRepository } from '../../fakes/fakeSettingsRepository.js';
import { fakeSourceRunRepository } from '../../fakes/fakeSourceRunRepository.js';
import { settingsWithDealerMailbox } from '../../support/dealerMailbox.js';

const LACENTRALE_MORE_RESULTS = 'https://www.lacentrale.fr/listing?makesModelsCommercialNames=PORSCHE&sortBy=firstOnlineDateDesc';

const processedEmail = (fields: Partial<ProcessedEmail> & Pick<ProcessedEmail, 'messageId' | 'processedAt'>): ProcessedEmail => ({
  uid: null,
  subject: '',
  sender: '',
  receivedAt: null,
  site: null,
  listingCount: 0,
  summary: null,
  error: null,
  ...fields,
});

const laCentraleDigest = (messageId: string, announced: number, receivedAt: string): ProcessedEmail =>
  processedEmail({
    messageId,
    subject: `${announced} nouveaux véhicules correspondent à votre recherche`,
    sender: 'alertes@lacentrale.fr',
    receivedAt,
    site: 'lacentrale',
    listingCount: 3,
    summary: { listings: [], pending: 0, ignored: 0, announced, kind: 'new', moreUrl: LACENTRALE_MORE_RESULTS },
    processedAt: receivedAt,
  });

const paruVenduSingleAd = (processedAt: string): ProcessedEmail =>
  processedEmail({
    messageId: `<paruvendu-${processedAt}@paruvendu.fr>`,
    subject: '🚗 1 nouvelle annonce - Voiture d’occasion / Bordeaux',
    sender: 'alerte@paruvendu.fr',
    receivedAt: processedAt,
    site: 'paruvendu',
    listingCount: 1,
    summary: { listings: [], pending: 0, ignored: 0, announced: 1, kind: 'new' },
    processedAt,
  });

const narrowLaCentraleAlert: AlertInfo = {
  site: 'lacentrale',
  criteria: '80 000 km max, 33000 (rayon de 50 km), particuliers',
  confirmedAt: '2026-10-12T17:42:05.000Z',
  manageUrl: 'https://www.lacentrale.fr/compte/notification/recherche',
  radiusKm: 50,
  maxKm: 80000,
  postalCode: '33000',
  sellerType: 'particulier',
};

describe('l’écran Sites', () => {
  it('montre le dernier email La Centrale qui annonçait 61 véhicules et n’en montrait que 3, avec le lien vers la suite', () => {
    // Given
    const mailboxState = fakeMailboxStateRepository();
    mailboxState.recordProcessed(laCentraleDigest('<digest-24@lacentrale.fr>', 24, '2026-10-12T06:30:12.000Z'));
    mailboxState.recordProcessed(paruVenduSingleAd('2026-10-12T18:04:51.000Z'));
    mailboxState.recordProcessed(laCentraleDigest('<digest-61@lacentrale.fr>', 61, '2026-10-13T09:56:40.000Z'));
    mailboxState.recordProcessed(paruVenduSingleAd('2026-10-13T12:20:03.000Z'));

    // When
    const overview = sourcesOverview({ settings: fakeSettingsRepository(), sourceRuns: fakeSourceRunRepository(), mailboxState });

    // Then
    const laCentrale = overview.sites.find((site) => site.key === 'lacentrale');
    const paruVendu = overview.sites.find((site) => site.key === 'paruvendu');
    expect(laCentrale?.digest).toEqual({
      at: '2026-10-13T09:56:40.000Z',
      announced: 61,
      received: 3,
      url: LACENTRALE_MORE_RESULTS,
      subject: '61 nouveaux véhicules correspondent à votre recherche',
    });
    expect(paruVendu?.digest).toBeNull();
    expect(overview.emails.map((email) => email.messageId)).toEqual([
      '<paruvendu-2026-10-13T12:20:03.000Z@paruvendu.fr>',
      '<digest-61@lacentrale.fr>',
      '<paruvendu-2026-10-12T18:04:51.000Z@paruvendu.fr>',
      '<digest-24@lacentrale.fr>',
    ]);
  });

  it('un récapitulatif La Centrale de la semaine qui annonce plus d’annonces qu’il n’en montre n’est pas un résumé tronqué de nouvelles annonces', () => {
    // Given
    const mailboxState = fakeMailboxStateRepository();
    mailboxState.recordProcessed(laCentraleDigest('<digest-61@lacentrale.fr>', 61, '2026-10-13T09:56:40.000Z'));
    mailboxState.recordProcessed({
      ...laCentraleDigest('<recap@lacentrale.fr>', 12, '2026-10-14T07:00:00.000Z'),
      subject: 'Votre récapitulatif : 12 nouvelles annonces cette semaine',
      summary: { listings: [], pending: 0, ignored: 0, announced: 12, kind: 'recap', moreUrl: LACENTRALE_MORE_RESULTS },
    });

    // When
    const overview = sourcesOverview({ settings: fakeSettingsRepository(), sourceRuns: fakeSourceRunRepository(), mailboxState });

    // Then
    expect(overview.sites.find((site) => site.key === 'lacentrale')?.digest?.announced).toBe(61);
  });

  it('avant la mise en route, la boîte mail apparaît non configurée, sans mot de passe ni passage', () => {
    // Given
    const settings = fakeSettingsRepository();

    // When
    const overview = sourcesOverview({ settings, sourceRuns: fakeSourceRunRepository(), mailboxState: fakeMailboxStateRepository() });

    // Then
    expect(overview.imap).toEqual({
      host: 'imap.gmail.com',
      port: 993,
      user: '',
      hasPassword: false,
      mailbox: 'INBOX',
      configured: false,
      lastRun: null,
    });
    expect(overview.httpSites).toEqual([]);
    expect(overview.emails).toEqual([]);
  });

  it('une alerte La Centrale réglée à 50 km et 80 000 km : la ligne du site montre les deux écarts et le conseil d’élargir', () => {
    // Given
    const confirmed = recordAlertConfirmation(defaultSettings(), narrowLaCentraleAlert);
    const settings = fakeSettingsRepository({ ...confirmed, alertsDone: { ...confirmed.alertsDone, leboncoin: true } });

    // When
    const overview = sourcesOverview({ settings, sourceRuns: fakeSourceRunRepository(), mailboxState: fakeMailboxStateRepository() });

    // Then
    const laCentrale = overview.sites.find((site) => site.key === 'lacentrale');
    const leboncoin = overview.sites.find((site) => site.key === 'leboncoin');
    expect(laCentrale).toMatchObject({
      done: true,
      alert: narrowLaCentraleAlert,
      issues: [
        { kind: 'radiusNarrower', alertRadiusKm: 50, settingsRadiusKm: 100 },
        { kind: 'mileageNarrower', alertMaxKm: 80000, settingsMaxKm: 100000 },
      ],
      advice: { radiusKm: 150, maxKm: 150000 },
    });
    expect(laCentrale?.targeted.length).toBeGreaterThan(0);
    expect(leboncoin).toMatchObject({ done: true, alert: null, issues: [], targeted: [] });
    expect(leboncoin?.advice).toBeUndefined();
  });

  it('la boîte configurée et la recherche Leparking montrent leur dernier passage, sans renvoyer le mot de passe', () => {
    // Given
    const settings = fakeSettingsRepository(
      settingsWithDealerMailbox({
        httpSites: [
          { id: 'k3v9x2ab', name: 'Leparking', url: 'https://www.leparking.fr/voiture-occasion/bmw-m3.html', enabled: true },
          {
            id: 'p7q2m4cd',
            name: 'La Centrale',
            url: 'https://www.lacentrale.fr/listing?makesModelsCommercialNames=PORSCHE',
            enabled: false,
          },
        ],
      }),
    );
    const sourceRuns = fakeSourceRunRepository();
    const mailRun = {
      source: 'email',
      lastRunAt: '2026-10-13T16:45:00.218Z',
      ok: true,
      detail: '0 email(s) lu(s), 0 annonce(s), 0 nouvelle(s) correspondant aux réglages',
    } as const;
    const leparkingRun = {
      source: 'http:k3v9x2ab',
      lastRunAt: '2026-10-13T16:45:03.904Z',
      ok: true,
      detail: '1 annonce(s) lue(s) (données structurées). 0 nouvelle(s) correspondant aux réglages.',
    } as const;
    sourceRuns.record(mailRun);
    sourceRuns.record(leparkingRun);

    // When
    const overview = sourcesOverview({ settings, sourceRuns, mailboxState: fakeMailboxStateRepository() });

    // Then
    expect(overview.imap).toEqual({
      host: 'imap.gmail.com',
      port: 993,
      user: 'concession.veille@example.com',
      hasPassword: true,
      mailbox: 'INBOX',
      configured: true,
      lastRun: mailRun,
    });
    expect(overview.httpSites.map((site) => [site.name, site.lastRun])).toEqual([
      ['Leparking', leparkingRun],
      ['La Centrale', null],
    ]);
  });

  it('un résumé tronqué La Centrale suivi de trente emails reste signalé, mais l’écran ne liste que les 25 derniers emails', () => {
    // Given
    const mailboxState = fakeMailboxStateRepository();
    mailboxState.recordProcessed(laCentraleDigest('<digest-61@lacentrale.fr>', 61, '2026-10-13T09:56:40.000Z'));
    for (const minute of Array.from({ length: 30 }, (_, index) => index + 10)) {
      mailboxState.recordProcessed(paruVenduSingleAd(`2026-10-13T12:${minute}:00.000Z`));
    }

    // When
    const overview = sourcesOverview({ settings: fakeSettingsRepository(), sourceRuns: fakeSourceRunRepository(), mailboxState });

    // Then
    expect(overview.sites.find((site) => site.key === 'lacentrale')?.digest?.announced).toBe(61);
    expect(overview.emails).toHaveLength(25);
    expect(overview.emails.some((email) => email.site === 'lacentrale')).toBe(false);
  });
});
