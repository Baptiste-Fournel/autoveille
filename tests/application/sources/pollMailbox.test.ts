import { describe, expect, it } from 'vitest';
import type { EmailReading } from '../../../src/application/ports/listingExtractor.js';
import { MailboxUnavailable } from '../../../src/application/ports/mailboxUnavailable.js';
import { mailboxPolling, pollMailbox } from '../../../src/application/sources/pollMailbox.js';
import { sourcesOverview } from '../../../src/application/sources/sourcesOverview.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import type { RawListing } from '../../../src/domain/vehicle/types.js';
import {
  AUDI_A3,
  BMW_M3_E46,
  FERRARI_360,
  MAZDA_5,
  MERCEDES_C63,
  PORSCHE_911_4S,
  PORSCHE_997_PRO,
  TOYOTA_GR_YARIS,
} from '../../contracts/vehicleSamples.js';
import { settingsWithDealerMailbox } from '../../support/dealerMailbox.js';
import { type AlertInMailbox, DEALER_TELEGRAM, mailWorld } from '../../support/mailWorld.js';

const LACENTRALE_MORE_RESULTS = 'https://www.lacentrale.fr/listing?makesModelsCommercialNames=PORSCHE&sortBy=firstOnlineDateDesc';

const adsRead = (site: string, listings: readonly RawListing[], fields: Partial<EmailReading> = {}): EmailReading => ({
  site,
  listings,
  pendingLinks: [],
  ignoredLinks: 4,
  ...fields,
});

const leboncoinAlert = (uid: number, date: string, listings: readonly RawListing[]): AlertInMailbox => ({
  uid,
  email: {
    messageId: `<alerte-${uid}@leboncoin.fr>`,
    from: 'alerte@leboncoin.fr',
    subject: 'Une nouvelle annonce correspond à votre recherche « Porsche 911 »',
    date,
    html: `<html>alerte Leboncoin ${uid}</html>`,
  },
  reading: adsRead('leboncoin', listings),
});

const laCentraleAlert = (uid: number, date: string, subject: string, reading: AlertInMailbox['reading']): AlertInMailbox => ({
  uid,
  email: {
    messageId: `<alerte-${uid}@mail-alerte.lacentrale.fr>`,
    from: 'info@mail-alerte.lacentrale.fr',
    subject,
    date,
    html: `<html>${uid}</html>`,
  },
  reading,
});

const paruVenduAlert = (uid: number, date: string, listings: readonly RawListing[], announced = listings.length): AlertInMailbox => ({
  uid,
  email: {
    messageId: `<alerte-${uid}@paruvendu.fr>`,
    from: 'info@paruvendu.fr',
    subject: `🚗 ${announced} nouvelle${announced > 1 ? 's' : ''} annonce${announced > 1 ? 's' : ''} - Voiture d’occasion / Bordeaux`,
    date,
    html: `<html>alerte ParuVendu ${uid}</html>`,
  },
  reading: adsRead('paruvendu', listings),
});

const quietAlert = (uid: number, date: string): AlertInMailbox => ({
  uid,
  email: {
    messageId: `<alerte-${uid}@leboncoin.fr>`,
    from: 'alerte@leboncoin.fr',
    subject: 'Vos recherches sauvegardées',
    date,
    text: `alerte ${uid}`,
  },
});

const truncatedLaCentraleDigest = (uid: number, date: string): AlertInMailbox =>
  laCentraleAlert(
    uid,
    date,
    '61 nouveaux véhicules correspondent à votre recherche',
    adsRead('lacentrale', [PORSCHE_997_PRO, MAZDA_5, TOYOTA_GR_YARIS], { moreUrl: LACENTRALE_MORE_RESULTS }),
  );

const processedIds = (world: ReturnType<typeof mailWorld>): readonly string[] =>
  world.mailboxState
    .recentlyProcessed(100)
    .map((email) => email.messageId)
    .sort();

describe('lecture de la boîte mail', () => {
  it('trois alertes lues, quatre annonces dont deux nouvelles retenues : le passage est enregistré et journalisé avec ce détail', async () => {
    // Given
    const world = mailWorld([
      leboncoinAlert(41, '2026-10-14T07:12:04.000Z', [PORSCHE_911_4S]),
      laCentraleAlert(
        42,
        '2026-10-14T09:40:31.000Z',
        '2 nouveaux véhicules correspondent à votre recherche',
        adsRead('lacentrale', [AUDI_A3, BMW_M3_E46]),
      ),
      paruVenduAlert(43, '2026-10-15T06:02:17.000Z', [FERRARI_360]),
    ]);

    // When
    const summary = await pollMailbox(world);

    // Then
    const detail = '3 email(s) lu(s), 4 annonce(s), 2 nouvelle(s) correspondant aux réglages';
    expect(summary).toEqual({ source: 'email', ok: true, detail });
    expect(world.sourceRuns.all()).toEqual([{ source: 'email', lastRunAt: '2026-10-15T08:30:00.000Z', ok: true, detail }]);
    expect(world.logger.messages()).toEqual(['3 email(s) à traiter', `email: ${detail}`]);
    expect(world.mailboxState.position('INBOX')).toEqual({ lastUid: 43, uidValidity: 1 });
    expect(world.mailboxReader.openings()).toEqual([{ account: world.settings.load().imap, connectionTimeoutMs: undefined }]);
    expect(world.mailboxReader.openSessions()).toBe(0);
  });

  it('chaque email lu est enregistré pour l’écran Sites, avec le résumé de ses annonces', async () => {
    // Given
    const world = mailWorld([paruVenduAlert(43, '2026-10-15T06:02:17.000Z', [FERRARI_360])]);

    // When
    await pollMailbox(world);

    // Then
    expect(world.mailboxState.recentlyProcessed(10)).toEqual([
      {
        messageId: '<alerte-43@paruvendu.fr>',
        uid: 43,
        subject: '🚗 1 nouvelle annonce - Voiture d’occasion / Bordeaux',
        sender: 'info@paruvendu.fr',
        receivedAt: '2026-10-15T06:02:17.000Z',
        site: 'paruvendu',
        listingCount: 1,
        summary: {
          listings: [
            {
              title: 'Ferrari 360 Modena F1',
              price: 79000,
              km: 45000,
              year: 2001,
              city: 'Langon',
              postalCode: '33210',
              sellerType: 'particulier',
              url: 'https://www.paruvendu.fr/a/voiture-occasion/ferrari/360/ABCDEF123456',
            },
          ],
          pending: 0,
          ignored: 4,
          announced: 1,
          kind: 'new',
          leftAside: 0,
        },
        error: null,
        processedAt: '2026-10-15T08:30:00.000Z',
      },
    ]);
  });

  it('un email La Centrale de baisses de prix : la Mercedes déjà connue prend son nouveau prix, la Porsche inconnue est laissée de côté, et l’écran Sites le voit', async () => {
    // Given
    const world = mailWorld([
      laCentraleAlert(
        40,
        '2026-10-14T07:05:52.000Z',
        '2 nouveaux véhicules correspondent à votre recherche',
        adsRead('lacentrale', [MERCEDES_C63]),
      ),
      laCentraleAlert(
        44,
        '2026-10-15T07:05:52.000Z',
        '↘️ 2 baisses de prix sur votre alerte',
        adsRead('lacentrale', [{ ...MERCEDES_C63, price: 59900 }, PORSCHE_997_PRO]),
      ),
    ]);

    // When
    await pollMailbox(world);

    // Then
    const mercedes = world.vehicles.findListing(MERCEDES_C63.site, MERCEDES_C63.externalId);
    expect(mercedes?.vehicle.price).toBe(59900);
    expect(mercedes?.vehicle.priceDropped).toBe(true);
    expect(world.vehicles.findListing(PORSCHE_997_PRO.site, PORSCHE_997_PRO.externalId)).toBeUndefined();
    expect(world.vehicles.allVehicles()).toHaveLength(1);
    expect(world.mailboxState.recentlyProcessed(10).find((email) => email.uid === 44)?.summary).toMatchObject({
      kind: 'price_drop',
      leftAside: 1,
    });
    expect(world.logger.messages()).toContain(
      'La Centrale : 1 annonce(s) d’un email de baisse de prix ou de relance laissée(s) de côté, jamais vue(s) comme nouveauté',
    );
  });

  it('une annonce ParuVendu sans date prend celle de l’email d’alerte ; une annonce La Centrale connue, revue dans un email de baisses de prix, garde la sienne', async () => {
    // Given
    const world = mailWorld([
      paruVenduAlert(43, '2026-10-15T06:02:17.000Z', [FERRARI_360]),
      laCentraleAlert(
        40,
        '2026-10-14T07:05:52.000Z',
        '2 nouveaux véhicules correspondent à votre recherche',
        adsRead('lacentrale', [MERCEDES_C63]),
      ),
      laCentraleAlert(
        44,
        '2026-10-15T07:05:52.000Z',
        '↘️ 3 baisses de prix sur votre alerte',
        adsRead('lacentrale', [{ ...MERCEDES_C63, price: 59900 }]),
      ),
    ]);

    // When
    await pollMailbox(world);

    // Then
    const ferrari = world.vehicles.findListing(FERRARI_360.site, FERRARI_360.externalId);
    const mercedes = world.vehicles.findListing(MERCEDES_C63.site, MERCEDES_C63.externalId);
    expect(ferrari?.listing.publishedAt).toBe('2026-10-15T06:02:17.000Z');
    expect(ferrari?.vehicle.publishedAt).toBe('2026-10-15T06:02:17.000Z');
    expect(mercedes?.listing.publishedAt).toBe('2026-10-14T07:05:52.000Z');
    expect(mercedes?.vehicle.publishedAt).toBe('2026-10-14T07:05:52.000Z');
    expect(mercedes?.vehicle.price).toBe(59900);
  });

  it('première lecture d’une boîte qui garde deux semaines d’alertes : seuls les emails des trois derniers jours sont lus', async () => {
    // Given
    const world = mailWorld([
      paruVenduAlert(12, '2026-10-01T06:00:00.000Z', [FERRARI_360]),
      leboncoinAlert(25, '2026-10-11T19:30:00.000Z', [PORSCHE_911_4S]),
      leboncoinAlert(31, '2026-10-12T08:10:00.000Z', [BMW_M3_E46]),
      laCentraleAlert(38, '2026-10-14T09:40:31.000Z', '1 nouveau véhicule correspond à votre recherche', adsRead('lacentrale', [AUDI_A3])),
    ]);

    // When
    const summary = await pollMailbox(world);

    // Then
    expect(summary.detail).toBe('2 email(s) lu(s), 2 annonce(s), 0 nouvelle(s) correspondant aux réglages');
    expect(processedIds(world)).toEqual(['<alerte-31@leboncoin.fr>', '<alerte-38@mail-alerte.lacentrale.fr>']);
    expect(world.mailboxState.position('INBOX')).toEqual({ lastUid: 38, uidValidity: 1 });
  });

  it('la passe suivante ne lit que les emails arrivés depuis la précédente', async () => {
    // Given
    const world = mailWorld([
      leboncoinAlert(41, '2026-10-14T07:12:04.000Z', [PORSCHE_911_4S]),
      paruVenduAlert(43, '2026-10-15T06:02:17.000Z', [FERRARI_360]),
    ]);
    world.mailboxState.savePosition('INBOX', { lastUid: 41, uidValidity: 1 });

    // When
    const summary = await pollMailbox(world);

    // Then
    expect(summary.detail).toBe('1 email(s) lu(s), 1 annonce(s), 1 nouvelle(s) correspondant aux réglages');
    expect(processedIds(world)).toEqual(['<alerte-43@paruvendu.fr>']);
  });

  it('la boîte renumérotée par le serveur (uidValidity changé) est relue depuis le début, sur les trois derniers jours', async () => {
    // Given
    const world = mailWorld(
      [
        quietAlert(3, '2026-10-10T07:00:00.000Z'),
        leboncoinAlert(4, '2026-10-13T07:12:04.000Z', [PORSCHE_911_4S]),
        paruVenduAlert(5, '2026-10-15T06:02:17.000Z', [FERRARI_360]),
      ],
      { uidValidity: 7 },
    );
    world.mailboxState.savePosition('INBOX', { lastUid: 189, uidValidity: 1 });

    // When
    const summary = await pollMailbox(world);

    // Then
    expect(summary.detail).toBe('2 email(s) lu(s), 2 annonce(s), 2 nouvelle(s) correspondant aux réglages');
    expect(world.mailboxState.position('INBOX')).toEqual({ lastUid: 5, uidValidity: 7 });
  });

  it('une boîte qui a reçu 75 alertes pendant une coupure est rattrapée en deux passes : 60 emails, puis les 15 suivants', async () => {
    // Given
    const alerts = Array.from({ length: 75 }, (_, index) => quietAlert(index + 1, '2026-10-15T05:00:00.000Z'));
    const world = mailWorld(alerts);

    // When
    const first = await pollMailbox(world);
    const second = await pollMailbox(world);

    // Then
    expect(first.detail).toBe('60 email(s) lu(s), 0 annonce(s), 0 nouvelle(s) correspondant aux réglages');
    expect(second.detail).toBe('15 email(s) lu(s), 0 annonce(s), 0 nouvelle(s) correspondant aux réglages');
    expect(world.logger.messages().filter((message) => message.endsWith('à traiter'))).toEqual([
      '60 email(s) à traiter',
      '15 email(s) à traiter',
    ]);
    expect(world.mailboxState.position('INBOX')).toEqual({ lastUid: 75, uidValidity: 1 });
  });

  it('après une passe interrompue par un redémarrage, l’email ParuVendu déjà traité est reconnu à son Message-ID et n’est pas traité deux fois', async () => {
    // Given
    const world = mailWorld([
      paruVenduAlert(41, '2026-10-15T06:02:17.000Z', [FERRARI_360]),
      leboncoinAlert(42, '2026-10-15T07:12:04.000Z', [PORSCHE_911_4S]),
    ]);
    world.mailboxState.savePosition('INBOX', { lastUid: 40, uidValidity: 1 });
    world.mailboxState.recordProcessed({
      messageId: '<alerte-41@paruvendu.fr>',
      uid: 41,
      subject: '🚗 1 nouvelle annonce - Voiture d’occasion / Bordeaux',
      sender: 'info@paruvendu.fr',
      receivedAt: '2026-10-15T06:02:17.000Z',
      site: 'paruvendu',
      listingCount: 1,
      summary: null,
      error: null,
      processedAt: '2026-10-15T06:04:00.000Z',
    });

    // When
    const summary = await pollMailbox(world);

    // Then
    expect(summary.detail).toBe('1 email(s) lu(s), 1 annonce(s), 1 nouvelle(s) correspondant aux réglages');
    expect(world.extractor.emailExtractions().map(({ email }) => email.messageId)).toEqual(['<alerte-42@leboncoin.fr>']);
    expect(world.vehicles.findListing(FERRARI_360.site, FERRARI_360.externalId)).toBeUndefined();
    expect(world.mailboxState.position('INBOX')).toEqual({ lastUid: 42, uidValidity: 1 });
  });

  it('un email que le serveur n’arrive jamais à transmettre n’est pas relu à chaque passe : la boîte reprend après lui', async () => {
    // Given
    const world = mailWorld(
      [leboncoinAlert(41, '2026-10-15T05:12:04.000Z', [PORSCHE_911_4S]), leboncoinAlert(42, '2026-10-15T07:12:04.000Z', [MERCEDES_C63])],
      { unreadableUids: [42] },
    );
    await pollMailbox(world);

    // When
    const next = await pollMailbox(world);

    // Then
    expect(next.detail).toBe('0 email(s) lu(s), 0 annonce(s), 0 nouvelle(s) correspondant aux réglages');
    expect(world.mailboxState.position('INBOX')).toEqual({ lastUid: 42, uidValidity: 1 });
  });

  it('un email dont la lecture est coupée par le serveur est journalisé sous uid-1-41, et l’email suivant est lu', async () => {
    // Given
    const world = mailWorld(
      [leboncoinAlert(41, '2026-10-15T05:12:04.000Z', [MERCEDES_C63]), leboncoinAlert(42, '2026-10-15T07:12:04.000Z', [PORSCHE_911_4S])],
      {
        unreadableUids: [41],
      },
    );

    // When
    const summary = await pollMailbox(world);

    // Then
    const detail = '1 email(s) lu(s), 1 annonce(s), 1 nouvelle(s) correspondant aux réglages ; 1 erreur(s) : uid 41: Unexpected close';
    expect(summary.detail).toBe(detail);
    expect(world.mailboxState.recentlyProcessed(10).find((email) => email.uid === 41)).toEqual({
      messageId: 'uid-1-41',
      uid: 41,
      subject: '',
      sender: '',
      receivedAt: null,
      site: null,
      listingCount: 0,
      summary: null,
      error: 'Unexpected close',
      processedAt: '2026-10-15T08:30:00.000Z',
    });
    expect(world.vehicles.findListing(PORSCHE_911_4S.site, PORSCHE_911_4S.externalId)).toBeDefined();
    expect(world.mailboxState.position('INBOX')).toEqual({ lastUid: 42, uidValidity: 1 });
  });

  it('comportement hérité : une passe avec un email en erreur répond « ok » à « Vérifier maintenant », mais l’écran Sites montre le passage en échec', async () => {
    // Given
    const world = mailWorld(
      [leboncoinAlert(41, '2026-10-15T05:12:04.000Z', [MERCEDES_C63]), leboncoinAlert(42, '2026-10-15T07:12:04.000Z', [PORSCHE_911_4S])],
      {
        unreadableUids: [41],
      },
    );

    // When
    const summary = await pollMailbox(world);

    // Then
    expect(summary.ok).toBe(true);
    expect(world.sourceRuns.all().map((run) => run.ok)).toEqual([false]);
  });

  it('un email Leboncoin HTML sans annonce reconnue est enregistré comme lu, avec zéro annonce, pour que l’écran Sites le signale', async () => {
    // Given
    const favourites: AlertInMailbox = {
      uid: 44,
      email: {
        messageId: '<favoris-44@leboncoin.fr>',
        from: 'alerte@leboncoin.fr',
        subject: 'Vos favoris vous attendent',
        date: '2026-10-15T07:30:00.000Z',
        html: '<html>Vos favoris vous attendent</html>',
      },
      reading: { site: 'leboncoin', listings: [], pendingLinks: [], ignoredLinks: 7 },
    };
    const world = mailWorld([favourites]);

    // When
    const summary = await pollMailbox(world);

    // Then
    expect(summary.detail).toBe('1 email(s) lu(s), 0 annonce(s), 0 nouvelle(s) correspondant aux réglages');
    expect(world.mailboxState.recentlyProcessed(10)).toMatchObject([
      {
        messageId: '<favoris-44@leboncoin.fr>',
        listingCount: 0,
        error: null,
        summary: { listings: [], pending: 0, ignored: 7, kind: 'other' },
      },
    ]);
  });

  it('un email La Centrale dont le lien de suivi ne se déroule qu’en HTTP : le lien est résolu, puis l’annonce est lue', async () => {
    // Given
    const tracking = 'https://clicks.mail-alerte.lacentrale.fr/f/a/AAAHahA~/c63';
    const destination = 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html';
    const alert = laCentraleAlert(45, '2026-10-15T06:45:31.000Z', '1 nouveau véhicule correspond à votre recherche', (resolved) =>
      resolved.get(tracking) === destination
        ? adsRead('lacentrale', [MERCEDES_C63])
        : adsRead('lacentrale', [], { pendingLinks: [{ href: tracking, text: 'Mercedes-AMG C63 S Coupé' }] }),
    );
    const world = mailWorld([alert], { destinations: { [tracking]: destination } });

    // When
    const summary = await pollMailbox(world);

    // Then
    expect(summary.detail).toBe('1 email(s) lu(s), 1 annonce(s), 1 nouvelle(s) correspondant aux réglages');
    expect(world.redirectResolver.requested()).toEqual([tracking]);
    expect(world.extractor.emailExtractions().map(({ resolvedLinks }) => [...resolvedLinks])).toEqual([[], [[tracking, destination]]]);
    expect(world.mailboxState.recentlyProcessed(1)[0]?.summary?.pending).toBe(0);
  });

  it('un récapitulatif La Centrale aux 45 liens de suivi illisibles hors ligne : seuls les 40 premiers sont résolus', async () => {
    // Given
    const pendingLinks = Array.from({ length: 45 }, (_, index) => ({
      href: `https://clicks.mail-alerte.lacentrale.fr/f/a/AAAHahA~/${index}`,
      text: 'Voir l’annonce',
    }));
    const world = mailWorld([
      laCentraleAlert(46, '2026-10-15T06:45:31.000Z', 'Votre récapitulatif de la semaine', adsRead('lacentrale', [], { pendingLinks })),
    ]);

    // When
    await pollMailbox(world);

    // Then
    expect(world.redirectResolver.requested()).toEqual(pendingLinks.slice(0, 40).map((link) => link.href));
    expect(world.mailboxState.recentlyProcessed(1)[0]?.summary?.pending).toBe(45);
  });

  it('l’email de confirmation d’alerte La Centrale coche l’alerte dans les réglages, avec ses critères', async () => {
    // Given
    const confirmation: AlertInMailbox = {
      uid: 102,
      email: {
        messageId: '<creation-alerte@mail-alerte.lacentrale.fr>',
        from: 'info@mail-alerte.lacentrale.fr',
        subject: '     Création de votre alerte ',
        date: '2026-10-14T16:25:03.000Z',
        html: '<html>confirmation La Centrale</html>',
      },
      visible: {
        text: 'Votre alerte est confirmée, vous serez informé des nouveautés ! Votre alerte est activée Votre recherche de véhicule est enregistrée. Gérez vos alertes, quand vous le souhaitez, en vous connectant à . votre compte Recherche Kilométrage ... 100000 km Localisation 33000 (rayon de 1... Type de vendeur Particulier Pourquoi choisir la centrale ?',
        links: [{ text: 'votre compte', href: 'https://clicks.mail-alerte.lacentrale.fr/f/a/abc' }],
      },
    };
    const world = mailWorld([confirmation]);

    // When
    await pollMailbox(world);

    // Then
    expect(world.settings.load().alerts).toEqual({
      lacentrale: {
        site: 'lacentrale',
        confirmedAt: '2026-10-14T16:25:03.000Z',
        manageUrl: 'https://www.lacentrale.fr/compte/notification/recherche',
        criteria: '100 000 km max, 33000, particuliers',
        maxKm: 100000,
        postalCode: '33000',
        sellerType: 'particulier',
      },
    });
    expect(world.settings.load().alertsDone).toEqual({ lacentrale: true });
    expect(world.logger.messages()).toContain('alerte lacentrale confirmée par email : 100 000 km max, 33000, particuliers');
  });

  it('un email La Centrale « 61 nouveaux véhicules » qui n’en montre que 3 prévient sur Telegram et garde l’écart pour l’écran Sites', async () => {
    // Given
    const settings = settingsWithDealerMailbox({ notifications: { ...defaultSettings().notifications, ...DEALER_TELEGRAM } });
    const world = mailWorld([truncatedLaCentraleDigest(47, '2026-10-15T06:45:31.000Z')], { settings });

    // When
    await pollMailbox(world);

    // Then
    expect(world.logger.messages()).toContain('La Centrale : email tronqué, 61 annonces annoncées, 3 lue(s)');
    expect(world.channel.telegrams()).toHaveLength(1);
    expect(world.channel.telegrams()[0]?.text).toContain('61 nouvelles annonces');
    expect(world.channel.telegrams()[0]?.text).toContain(LACENTRALE_MORE_RESULTS);
    expect(sourcesOverview(world).sites.find((site) => site.key === 'lacentrale')?.digest).toEqual({
      at: '2026-10-15T06:45:31.000Z',
      announced: 61,
      received: 3,
      url: LACENTRALE_MORE_RESULTS,
      subject: '61 nouveaux véhicules correspondent à votre recherche',
    });
  });

  it('un email ParuVendu qui annonce 3 annonces et en montre 2 : l’écart est journalisé, sans notification', async () => {
    // Given
    const settings = settingsWithDealerMailbox({ notifications: { ...defaultSettings().notifications, ...DEALER_TELEGRAM } });
    const world = mailWorld([paruVenduAlert(48, '2026-10-15T06:02:17.000Z', [AUDI_A3, BMW_M3_E46], 3)], { settings });

    // When
    await pollMailbox(world);

    // Then
    expect(world.logger.messages()).toContain('ParuVendu : email tronqué, 3 annonces annoncées, 2 lue(s)');
    expect(world.channel.telegrams()).toEqual([]);
  });

  it('Telegram refuse la notification du résumé tronqué : l’échec est journalisé et les annonces de l’email entrent quand même', async () => {
    // Given
    const settings = settingsWithDealerMailbox({ notifications: { ...defaultSettings().notifications, ...DEALER_TELEGRAM } });
    const telegramFailure = new Error('Telegram 401: {"ok":false,"error_code":401,"description":"Unauthorized"}');
    const world = mailWorld([truncatedLaCentraleDigest(47, '2026-10-15T06:45:31.000Z')], { settings, telegramFailure });

    // When
    const summary = await pollMailbox(world);

    // Then
    expect(world.logger.messages()).toContain(`notification résumé tronqué : ${String(telegramFailure)}`);
    expect(summary.detail).toBe('1 email(s) lu(s), 3 annonce(s), 0 nouvelle(s) correspondant aux réglages');
    expect(world.vehicles.findListing(TOYOTA_GR_YARIS.site, TOYOTA_GR_YARIS.externalId)).toBeDefined();
  });

  it('sans adresse ni mot de passe d’application, la boîte n’est pas lue et rien n’est enregistré', async () => {
    // Given
    const world = mailWorld([leboncoinAlert(41, '2026-10-15T07:12:04.000Z', [PORSCHE_911_4S])], { settings: defaultSettings() });

    // When
    const summary = await pollMailbox(world);

    // Then
    expect(summary).toEqual({ source: 'email', ok: false, detail: 'Boîte mail non configurée.' });
    expect(world.mailboxReader.openings()).toEqual([]);
    expect(world.sourceRuns.all()).toEqual([]);
  });

  it('Gmail refuse le mot de passe : le passage est enregistré en échec avec le message qui parle du mot de passe d’application', async () => {
    // Given
    const refusal = new MailboxUnavailable('authenticationRefused', 'Invalid credentials (Failure)');
    const world = mailWorld([leboncoinAlert(41, '2026-10-15T07:12:04.000Z', [PORSCHE_911_4S])], { refusal });

    // When
    const summary = await pollMailbox(world);

    // Then
    const detail =
      'Connexion à la boîte mail refusée : vérifiez l’adresse et le mot de passe d’application (Gmail exige un mot de passe d’application, pas le mot de passe habituel).';
    expect(summary).toEqual({ source: 'email', ok: false, detail });
    expect(world.sourceRuns.all()).toEqual([{ source: 'email', lastRunAt: '2026-10-15T08:30:00.000Z', ok: false, detail }]);
    expect(world.logger.messages()).toEqual([`email: ${detail}`]);
    expect(world.mailboxState.position('INBOX')).toEqual({ lastUid: 0, uidValidity: null });
  });
});

describe('une seule lecture de la boîte à la fois', () => {
  it('« Vérifier maintenant » pendant une lecture de la boîte attend la lecture en cours et rend son résultat', async () => {
    // Given
    const world = mailWorld([leboncoinAlert(41, '2026-10-15T07:12:04.000Z', [PORSCHE_911_4S])]);
    const polling = mailboxPolling(world);

    // When
    const [scheduled, requested] = await Promise.all([polling.poll(), polling.poll()]);

    // Then
    expect(requested).toBe(scheduled);
    expect(world.mailboxReader.openings()).toHaveLength(1);
  });

  it('« Tout relire » attend la fin de la lecture en cours, oublie les emails lus et relit la boîte sans dupliquer les annonces', async () => {
    // Given
    const world = mailWorld([
      leboncoinAlert(41, '2026-10-14T07:12:04.000Z', [PORSCHE_911_4S]),
      paruVenduAlert(43, '2026-10-15T06:02:17.000Z', [FERRARI_360]),
    ]);
    const polling = mailboxPolling(world);

    // When
    const [scheduled, reread] = await Promise.all([polling.poll(), polling.rereadAll()]);

    // Then
    expect(scheduled.detail).toBe('2 email(s) lu(s), 2 annonce(s), 2 nouvelle(s) correspondant aux réglages');
    expect(reread.detail).toBe('2 email(s) lu(s), 2 annonce(s), 0 nouvelle(s) correspondant aux réglages');
    expect(world.mailboxReader.openings()).toHaveLength(2);
    expect(world.vehicles.allVehicles()).toHaveLength(2);
  });

  it('Gmail signale une nouvelle alerte pendant la lecture planifiée : une seconde lecture suit celle en cours, au lieu de s’y joindre', async () => {
    // Given
    const world = mailWorld([leboncoinAlert(41, '2026-10-15T07:12:04.000Z', [PORSCHE_911_4S])]);
    const polling = mailboxPolling(world);
    const scheduled = polling.poll();

    // When
    const signalled = polling.pollForNewEmail();
    await Promise.all([scheduled, signalled]);

    // Then
    expect(signalled).not.toBe(scheduled);
    expect(world.mailboxReader.openings()).toHaveLength(2);
  });

  it('trois alertes signalées par Gmail pendant une même lecture : une seule lecture de plus, après celle en cours', async () => {
    // Given
    const world = mailWorld([leboncoinAlert(41, '2026-10-15T07:12:04.000Z', [PORSCHE_911_4S])]);
    const polling = mailboxPolling(world);
    const signalledFirst = polling.pollForNewEmail();

    // When
    const signalledDuring = [polling.pollForNewEmail(), polling.pollForNewEmail(), polling.pollForNewEmail()];
    await Promise.all([signalledFirst, ...signalledDuring]);

    // Then
    expect(new Set(signalledDuring).size).toBe(1);
    expect(world.mailboxReader.openings()).toHaveLength(2);
  });

  it('le disque du serveur plein fait échouer la lecture en cours : l’alerte signalée par Gmail pendant ce temps est lue quand même juste après', async () => {
    // Given
    const world = mailWorld([leboncoinAlert(41, '2026-10-15T07:12:04.000Z', [PORSCHE_911_4S])]);
    let failedRecords = 0;
    const polling = mailboxPolling({
      ...world,
      sourceRuns: {
        ...world.sourceRuns,
        record: (run) => {
          if (failedRecords < 2) {
            failedRecords += 1;
            throw new Error('SQLITE_FULL: database or disk is full');
          }
          world.sourceRuns.record(run);
        },
      },
    });
    const scheduled = polling.poll();

    // When
    const signalled = polling.pollForNewEmail();
    const scheduledFailure = await scheduled.catch((error: unknown) => error);
    await signalled;

    // Then
    expect(scheduledFailure).toEqual(new Error('SQLITE_FULL: database or disk is full'));
    expect(world.mailboxReader.openings()).toHaveLength(2);
    expect(world.sourceRuns.all()).toHaveLength(1);
  });

  it('une alerte signalée par Gmail quand aucune lecture n’est en cours : la boîte est lue une fois', async () => {
    // Given
    const world = mailWorld([leboncoinAlert(41, '2026-10-15T07:12:04.000Z', [PORSCHE_911_4S])]);
    const polling = mailboxPolling(world);

    // When
    const signalled = await polling.pollForNewEmail();

    // Then
    expect(signalled.detail).toBe('1 email(s) lu(s), 1 annonce(s), 1 nouvelle(s) correspondant aux réglages');
    expect(world.mailboxReader.openings()).toHaveLength(1);
  });

  it('comportement hérité : « Tout relire » ne relit que les emails des trois derniers jours, comme une première lecture', async () => {
    // Given
    const world = mailWorld([
      paruVenduAlert(30, '2026-10-05T06:02:17.000Z', [FERRARI_360]),
      leboncoinAlert(41, '2026-10-14T07:12:04.000Z', [PORSCHE_911_4S]),
    ]);
    world.mailboxState.savePosition('INBOX', { lastUid: 29, uidValidity: 1 });
    const polling = mailboxPolling(world);
    await polling.poll();

    // When
    const reread = await polling.rereadAll();

    // Then
    expect(reread.detail).toBe('1 email(s) lu(s), 1 annonce(s), 0 nouvelle(s) correspondant aux réglages');
    expect(processedIds(world)).toEqual(['<alerte-41@leboncoin.fr>']);
  });
});
