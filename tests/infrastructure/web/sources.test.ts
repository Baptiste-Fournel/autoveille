import { describe, expect, it } from 'vitest';
import { ingestListing } from '../../../src/application/ingest/ingestListing.js';
import type { EmailReadingSummary, ProcessedEmail } from '../../../src/application/ports/mailboxStateRepository.js';
import { recordAlertConfirmation } from '../../../src/domain/settings/alerts.js';
import type { AlertInfo } from '../../../src/domain/settings/types.js';
import type { RawListing } from '../../../src/domain/vehicle/types.js';
import type { ImapClient, ImapClientFactory } from '../../../src/infrastructure/email/imap/imapClient.js';
import { DEALER_MAILBOX } from '../../support/dealerMailbox.js';
import { loadFixture } from '../../support/fixtures.js';
import { signedInApplication } from '../../support/signedInApplication.js';
import { type StoredImapMessage, simulatedImapClient } from '../../support/simulatedImapClient.js';
import { answering, htmlPage, simulatedWeb } from '../../support/simulatedWeb.js';

const MASKED = '••••••••';

const GARAGE_PAGE = 'https://www.garage-des-graves.fr/nos-occasions';

const GARAGE_ROBOTS_TXT = 'https://www.garage-des-graves.fr/robots.txt';

const PARUVENDU_NEW_LISTING_ALERT: StoredImapMessage = {
  uid: 12,
  receivedAt: '2026-10-15T06:05:12.000Z',
  source: loadFixture('emails/paruvendu/une-nouvelle-annonce.eml'),
};

const PARUVENDU_AUDI_TT: RawListing = {
  site: 'paruvendu',
  siteLabel: 'ParuVendu',
  externalId: '1296277822A1KVVOAUTT',
  url: 'https://www.paruvendu.fr/a/voiture-occasion/audi/tt/1296277822A1KVVOAUTT',
  title: 'Audi Tt éthanol',
  price: 17000,
  km: 75000,
  year: 2011,
};

const LACENTRALE_NARROW_ALERT: AlertInfo = {
  site: 'lacentrale',
  criteria: '80 000 km max, 33000 (rayon de 50 km), particuliers',
  confirmedAt: '2026-10-12T17:42:05.000Z',
  manageUrl: 'https://www.lacentrale.fr/compte/notification/recherche',
  maxKm: 80000,
  postalCode: '33000',
  radiusKm: 50,
  sellerType: 'particulier',
};

const AUTOSCOUT24_SAVED_SEARCH: AlertInfo = {
  site: 'autoscout24',
  criteria: 'Recherche « Profil de recherche 14/09/2026 » enregistrée',
  confirmedAt: '2026-09-14T16:31:17.000Z',
  manageUrl: 'https://www.autoscout24.fr/account/searches',
};

const LACENTRALE_MORE_RESULTS = 'https://www.lacentrale.fr/listing?customerFamilyCodes=PART';

const laCentraleDigest = (summary: EmailReadingSummary): ProcessedEmail => ({
  messageId: '<alerte-61@mail-alerte.lacentrale.fr>',
  uid: 44,
  subject: '61 nouveaux véhicules correspondent à votre recherche',
  sender: 'info@mail-alerte.lacentrale.fr',
  receivedAt: '2026-10-15T07:58:12.000Z',
  site: 'lacentrale',
  listingCount: 2,
  summary,
  error: null,
  processedAt: '2026-10-15T08:00:03.000Z',
});

const TWO_LACENTRALE_LISTINGS: EmailReadingSummary['listings'] = [
  {
    title: 'Mercedes-AMG C63 S Coupé',
    price: 64900,
    km: 45200,
    year: 2019,
    city: 'Libourne',
    postalCode: '33500',
    sellerType: 'particulier',
    url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html',
  },
  {
    title: 'Porsche 911 (997) Carrera S 3.8 355ch',
    price: 54900,
    km: 89000,
    year: 2006,
    city: 'Angoulême',
    postalCode: '16000',
    sellerType: 'pro',
    url: 'https://www.lacentrale.fr/auto-occasion-annonce-69100000001.html',
  },
];

const MAILBOX_READ_ONLY_ON_SCHEDULE = { IMAP_IDLE: '0' };

const openedWhen =
  (factory: ImapClientFactory, allowed: Promise<void>): ImapClientFactory =>
  (options) => {
    const client = factory(options);
    const gated: ImapClient = {
      get mailbox() {
        return client.mailbox;
      },
      connect: async () => {
        await allowed;
        await client.connect();
      },
      getMailboxLock: (path) => client.getMailboxLock(path),
      search: (query, searchOptions) => client.search(query, searchOptions),
      fetchOne: (range, query, fetchOptions) => client.fetchOne(range, query, fetchOptions),
      logout: () => client.logout(),
      on: (event, listener) => client.on(event, listener),
    };
    return gated;
  };

const pendingWorkDone = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

describe('écran Sites', () => {
  it('l’écran Sites montre la boîte, le résumé tronqué de La Centrale, l’écart et le conseil de son alerte, et les emails lus sous leurs noms d’origine', async () => {
    // Given
    const { application, session } = await signedInApplication();
    const { ports } = application;
    ports.settings.save(
      recordAlertConfirmation(recordAlertConfirmation(ports.settings.load(), LACENTRALE_NARROW_ALERT), AUTOSCOUT24_SAVED_SEARCH),
    );
    ports.mailboxState.recordProcessed(
      laCentraleDigest({
        listings: TWO_LACENTRALE_LISTINGS,
        pending: 0,
        ignored: 0,
        announced: 61,
        kind: 'new',
        moreUrl: LACENTRALE_MORE_RESULTS,
      }),
    );
    ports.sourceRuns.record({
      source: 'email',
      lastRunAt: '2026-10-15T08:00:03.000Z',
      ok: false,
      detail: '2 email(s) lu(s), 3 annonce(s), 2 nouvelle(s) correspondant aux réglages ; 1 erreur(s) : uid 41: Unexpected close',
    });

    // When
    const response = await application.server.inject({ method: 'GET', url: '/api/sources', headers: session });

    // Then
    const body = response.json();
    const site = (key: string) => body.sites.find((candidate: { readonly key: string }) => candidate.key === key);
    expect(response.statusCode).toBe(200);
    expect(body.imap).toEqual({
      host: 'imap.gmail.com',
      port: 993,
      user: '',
      hasPassword: false,
      mailbox: 'INBOX',
      configured: false,
      lastRun: {
        source: 'email',
        last_run_at: '2026-10-15T08:00:03.000Z',
        ok: 0,
        detail: '2 email(s) lu(s), 3 annonce(s), 2 nouvelle(s) correspondant aux réglages ; 1 erreur(s) : uid 41: Unexpected close',
      },
    });
    expect(body.emails).toEqual([
      {
        message_id: '<alerte-61@mail-alerte.lacentrale.fr>',
        subject: '61 nouveaux véhicules correspondent à votre recherche',
        sender: 'info@mail-alerte.lacentrale.fr',
        received_at: '2026-10-15T07:58:12.000Z',
        site: 'lacentrale',
        parsed_count: 2,
        parsed: { listings: TWO_LACENTRALE_LISTINGS, pending: 0, ignored: 0, announced: 61, kind: 'new', moreUrl: LACENTRALE_MORE_RESULTS },
        error: null,
        processed_at: '2026-10-15T08:00:03.000Z',
      },
    ]);
    expect(site('lacentrale')).toMatchObject({
      label: 'La Centrale',
      done: true,
      alert: LACENTRALE_NARROW_ALERT,
      help: 'Lancez une recherche avec vos critères, puis « Créer une alerte » (compte gratuit) et choisissez la réception par email à chaque nouvelle annonce.',
      issues: [
        'L’alerte du site ne couvre que 50 km autour de la ville, vos réglages vont jusqu’à 100 km : les annonces entre les deux n’arriveront jamais.',
        'L’alerte du site s’arrête à 80 000 km au compteur, vos réglages acceptent jusqu’à 100 000 km.',
      ],
      advice:
        'Cette alerte est réglée au plus juste. Vous pouvez l’élargir (150 km de rayon, 150 000 km au compteur) : l’application garde votre tri, et les annonces écartées restent consultables au cas où une bonne affaire s’y cache.',
      digest: {
        at: '2026-10-15T07:58:12.000Z',
        announced: 61,
        received: 2,
        url: LACENTRALE_MORE_RESULTS,
        subject: '61 nouveaux véhicules correspondent à votre recherche',
      },
    });
    expect(site('lacentrale').targeted[0]).toEqual({
      label: 'Porsche à partir de 30 000 €',
      url: 'https://www.lacentrale.fr/listing?makesModelsCommercialNames=PORSCHE&priceMin=30000&customerFamilyCodes=PART&distance=5&dptCp=33000&mileageMax=150000&sortBy=firstOnlineDateDesc',
      brands: ['PORSCHE'],
      minPrice: 30000,
    });
    expect(site('lacentrale').targeted.at(-1)).toEqual({
      label: 'Collection : toutes marques jusqu’à 1995',
      url: 'https://www.lacentrale.fr/listing?yearMax=1995&customerFamilyCodes=PART&distance=5&dptCp=33000&mileageMax=150000&sortBy=firstOnlineDateDesc',
      brands: [],
      maxYear: 1995,
    });
    expect(site('autoscout24')).toMatchObject({ alert: AUTOSCOUT24_SAVED_SEARCH, issues: [], digest: null });
    expect(site('autoscout24')).not.toHaveProperty('advice');
    expect(site('leboncoin')).toMatchObject({ alert: null, advice: null, done: false, targeted: [] });
    expect(site('largus')).not.toHaveProperty('manageUrl');
  });

  it('un email La Centrale lu juste avant que l’application classe les alertes (sans type enregistré) est montré tel quel, sans résumé tronqué', async () => {
    // Given
    const { application, session } = await signedInApplication();
    application.ports.mailboxState.recordProcessed(
      laCentraleDigest({ listings: TWO_LACENTRALE_LISTINGS, pending: 0, ignored: 0, announced: 61 }),
    );

    // When
    const response = await application.server.inject({ method: 'GET', url: '/api/sources', headers: session });

    // Then
    const body = response.json();
    expect(body.emails[0].parsed).toEqual({ listings: TWO_LACENTRALE_LISTINGS, pending: 0, ignored: 0, announced: 61 });
    expect(body.sites.find((site: { readonly key: string }) => site.key === 'lacentrale').digest).toBeNull();
  });
});

describe('tests de connexion des sources', () => {
  it('tester la boîte avec le mot de passe masqué « •••••••• » renvoyé par le formulaire utilise le mot de passe enregistré', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n, messages: [PARUVENDU_NEW_LISTING_ALERT] });
    const { application, session } = await signedInApplication({ imapClient: imap.createClient });
    await application.server.inject({ method: 'PUT', url: '/api/settings', headers: session, payload: { imap: DEALER_MAILBOX } });

    // When
    const response = await application.server.inject({
      method: 'POST',
      url: '/api/sources/imap/test',
      headers: session,
      payload: { ...DEALER_MAILBOX, pass: MASKED },
    });

    // Then
    expect(response.json()).toEqual({ ok: true, detail: 'Connexion réussie, 1 email(s) dans la boîte.' });
    expect(imap.connections()).toEqual([
      expect.objectContaining({ auth: { user: DEALER_MAILBOX.user, pass: DEALER_MAILBOX.pass }, connectionTimeout: 15_000 }),
    ]);
  });

  it('tester la boîte sans adresse ni mot de passe d’application', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await application.server.inject({ method: 'POST', url: '/api/sources/imap/test', headers: session, payload: {} });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 200,
      body: { ok: false, detail: 'Adresse ou mot de passe d’application manquant.' },
    });
  });

  it('tester une page de résultats sans adresse', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await application.server.inject({
      method: 'POST',
      url: '/api/sources/http/test',
      headers: session,
      payload: { url: '   ' },
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 200,
      body: { ok: false, detail: 'Indiquez l’adresse de la page de résultats.' },
    });
  });

  it('tester la page des occasions d’un garage montre les annonces lues, réduites à ce que l’écran affiche', async () => {
    // Given
    const web = simulatedWeb({
      [GARAGE_ROBOTS_TXT]: answering('Not Found', 404),
      [GARAGE_PAGE]: htmlPage(loadFixture('pages/garage-occasions-avec-une-annonce-leboncoin-et-un-modele-non-rempli.html')),
    });
    const { application, session } = await signedInApplication({ fetch: web.fetch });

    // When
    const response = await application.server.inject({
      method: 'POST',
      url: '/api/sources/http/test',
      headers: session,
      payload: { url: GARAGE_PAGE },
    });

    // Then
    expect(response.json()).toEqual({
      ok: true,
      detail: '2 annonce(s) lue(s) (lecture des liens).',
      sample: [
        {
          title: 'Porsche 911 Carrera 4S PDK',
          price: 98500,
          km: 42000,
          year: 2019,
          city: 'Pessac',
          url: 'https://www.garage-des-graves.fr/occasion/porsche-911-carrera-4s/245871',
        },
        {
          title: 'Alpine A110 Légende',
          price: 61900,
          km: 12500,
          year: 2021,
          city: 'Pessac',
          url: 'https://www.garage-des-graves.fr/occasion/alpine-a110-legende/245902',
        },
      ],
    });
  });
});

describe('vérifier maintenant et tout relire', () => {
  it('« Vérifier maintenant » lit la nouvelle alerte ParuVendu de la boîte, puis la page du garage lue directement', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n, messages: [PARUVENDU_NEW_LISTING_ALERT] });
    const web = simulatedWeb({
      [GARAGE_ROBOTS_TXT]: answering('Not Found', 404),
      [GARAGE_PAGE]: htmlPage(loadFixture('pages/garage-occasions-avec-une-annonce-leboncoin-et-un-modele-non-rempli.html')),
    });
    const { application, session } = await signedInApplication({ imapClient: imap.createClient, fetch: web.fetch });
    await application.server.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: session,
      payload: { imap: DEALER_MAILBOX, httpSites: [{ id: 'g7d2k9qa', name: 'Garage des Graves', url: GARAGE_PAGE, enabled: true }] },
    });

    // When
    const response = await application.server.inject({ method: 'POST', url: '/api/sources/check-now', headers: session });

    // Then
    expect(response.json()).toEqual({
      mail: { source: 'email', ok: true, detail: '1 email(s) lu(s), 1 annonce(s), 0 nouvelle(s) correspondant aux réglages' },
      http: [
        {
          source: 'Garage des Graves',
          ok: true,
          detail: '2 annonce(s) lue(s) (lecture des liens). 2 nouvelle(s) correspondant aux réglages.',
        },
      ],
    });
    expect(application.ports.vehicles.allVehicles()).toHaveLength(3);
  });

  it('« Vérifier maintenant » pendant la lecture planifiée de la boîte attend cette lecture et rend son résultat, sans ouvrir une seconde connexion', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n, messages: [PARUVENDU_NEW_LISTING_ALERT] });
    let openMailbox = (): void => undefined;
    const mailboxAnswers = new Promise<void>((resolve) => {
      openMailbox = resolve;
    });
    const { application, session } = await signedInApplication({
      environment: MAILBOX_READ_ONLY_ON_SCHEDULE,
      imapClient: openedWhen(imap.createClient, mailboxAnswers),
    });
    await application.server.inject({ method: 'PUT', url: '/api/settings', headers: session, payload: { imap: DEALER_MAILBOX } });
    await application.start();
    application.timers.advanceBy(5_000);

    // When
    const checking = application.server.inject({ method: 'POST', url: '/api/sources/check-now', headers: session });
    await pendingWorkDone();
    await pendingWorkDone();
    openMailbox();
    const response = await checking;

    // Then
    expect(response.json().mail).toEqual({
      source: 'email',
      ok: true,
      detail: '1 email(s) lu(s), 1 annonce(s), 0 nouvelle(s) correspondant aux réglages',
    });
    expect(imap.connections()).toHaveLength(1);
  });

  it('« Tout relire » après une correction de la lecture des emails ParuVendu complète l’Audi TT déjà connue sans la dupliquer', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n, messages: [PARUVENDU_NEW_LISTING_ALERT] });
    const { application, session } = await signedInApplication({ imapClient: imap.createClient });
    const { ports } = application;
    await application.server.inject({ method: 'PUT', url: '/api/settings', headers: session, payload: { imap: DEALER_MAILBOX } });
    await ingestListing(ports, { listing: PARUVENDU_AUDI_TT, settings: ports.settings.load(), notify: false, aboutOlderAds: false });
    ports.mailboxState.recordProcessed({
      messageId: '<alerte-une-nouvelle-annonce@paruvendu.fr>',
      uid: 12,
      subject: '🚗 1 nouvelle annonce',
      sender: 'info@paruvendu.fr',
      receivedAt: PARUVENDU_NEW_LISTING_ALERT.receivedAt,
      site: 'paruvendu',
      listingCount: 1,
      summary: {
        listings: [{ title: PARUVENDU_AUDI_TT.title, url: PARUVENDU_AUDI_TT.url }],
        pending: 0,
        ignored: 21,
        announced: 1,
        kind: 'new',
      },
      error: null,
      processedAt: '2026-10-15T08:00:00.000Z',
    });
    ports.mailboxState.savePosition(DEALER_MAILBOX.mailbox, { lastUid: 12, uidValidity: 7 });

    // When
    const response = await application.server.inject({ method: 'POST', url: '/api/sources/reread', headers: session });

    // Then
    const vehicles = ports.vehicles.allVehicles();
    const listings = vehicles.flatMap((vehicle) => ports.vehicles.listingsOf(vehicle.id));
    expect(response.json()).toEqual({
      mail: { source: 'email', ok: true, detail: '1 email(s) lu(s), 1 annonce(s), 0 nouvelle(s) correspondant aux réglages' },
    });
    expect(vehicles).toHaveLength(1);
    expect(listings).toEqual([
      expect.objectContaining({
        externalId: PARUVENDU_AUDI_TT.externalId,
        description: "Audi Tt éthanol 17 000€ Coupé - Essence - Année 2011 - 75 000 km Voir l'annonce",
        imageUrl: expect.stringMatching(/^https:\/\/media\.paruvendu\.fr\//),
        publishedAt: PARUVENDU_NEW_LISTING_ALERT.receivedAt,
      }),
    ]);
  });
});
