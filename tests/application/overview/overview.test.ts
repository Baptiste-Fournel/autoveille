import { describe, expect, it } from 'vitest';
import { overview } from '../../../src/application/overview/overview.js';
import { getVehicle } from '../../../src/application/vehicles/getVehicle.js';
import { updateVehicle } from '../../../src/application/vehicles/updateVehicle.js';
import { laCentraleCriteriaText } from '../../../src/domain/presentation/alerts.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import type { Settings } from '../../../src/domain/settings/types.js';
import {
  ALPINE_A110,
  BMW_M3_E46,
  CORVETTE_C7,
  FERRARI_360,
  MUSTANG_GT,
  PORSCHE_911_4S,
  storeFirstSighting,
} from '../../contracts/vehicleSamples.js';
import { FAKE_NOW, fakeClock } from '../../fakes/fakeClock.js';
import { fakePersistence } from '../../fakes/fakePersistence.js';
import { FAKE_PUSH_KEYS } from '../../fakes/fakePushKeyGenerator.js';
import { garageDuLac } from '../../support/dealer.js';

const KEPT = { matched: true, rejections: [] } as const;

const world = () => ({ ...fakePersistence(), clock: fakeClock() });

const LA_CENTRALE_ALERT = {
  site: 'lacentrale',
  criteria: laCentraleCriteriaText({ maxKm: 80000, postalCode: '33000', radiusKm: 50, sellerType: 'particulier' }),
  confirmedAt: '2026-10-09T18:02:00.000Z',
  maxKm: 80000,
  postalCode: '33000',
  radiusKm: 50,
  sellerType: 'particulier',
} as const;

const configured: Settings = {
  ...defaultSettings(),
  dealer: garageDuLac,
  imap: { host: 'imap.gmail.com', port: 993, user: 'veille.garagedulac@example.com', pass: 'abcd efgh ijkl mnop', mailbox: 'INBOX' },
  alertsDone: { leboncoin: true, lacentrale: true, paruvendu: false },
  alerts: { lacentrale: LA_CENTRALE_ALERT },
};

describe('l’accueil', () => {
  it('une annonce contactée puis remise « Pas encore contactée » ne compte plus dans les contacts de la semaine', () => {
    // Given
    const app = world();
    const porsche = storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-15T07:00:00.000Z', KEPT);
    updateVehicle(app, porsche.vehicleId, { status: 'contacte' });
    const contacted = overview(app);
    const contactedSheet = getVehicle(app, porsche.vehicleId);

    // When
    updateVehicle(app, porsche.vehicleId, { status: 'nouveau' });

    // Then
    expect(contacted.week).toEqual({ received: 1, contacted: 1, replied: 0 });
    expect(contactedSheet.contactedAt).toBe(FAKE_NOW);
    expect(overview(app).week).toEqual({ received: 1, contacted: 0, replied: 0 });
    expect(getVehicle(app, porsche.vehicleId).events.map((event) => event.type)).not.toContain('statut_contacte');
  });

  it('la ligne des 7 derniers jours compte les annonces retenues arrivées, les vendeurs contactés et les réponses, d’après les événements', () => {
    // Given
    const app = world();
    const corvette = storeFirstSighting(app.vehicles, CORVETTE_C7, '2026-10-05T08:00:00.000Z', KEPT);
    app.clock.set('2026-10-07T20:00:00.000Z');
    updateVehicle(app, corvette.vehicleId, { status: 'contacte' });
    const ferrari = storeFirstSighting(app.vehicles, FERRARI_360, '2026-10-09T09:00:00.000Z', KEPT);
    app.clock.set('2026-10-09T17:40:00.000Z');
    updateVehicle(app, ferrari.vehicleId, { status: 'contacte' });
    app.clock.set('2026-10-13T11:20:00.000Z');
    updateVehicle(app, ferrari.vehicleId, { status: 'repondu' });
    updateVehicle(app, ferrari.vehicleId, { status: 'contacte' });
    const mustang = storeFirstSighting(app.vehicles, MUSTANG_GT, '2026-10-12T06:00:00.000Z', KEPT);
    app.clock.set('2026-10-14T10:00:00.000Z');
    updateVehicle(app, mustang.vehicleId, { status: 'contacte' });
    app.clock.set('2026-10-14T16:00:00.000Z');
    updateVehicle(app, mustang.vehicleId, { status: 'repondu' });
    storeFirstSighting(app.vehicles, BMW_M3_E46, '2026-10-14T08:00:00.000Z', {
      matched: false,
      rejections: [{ kind: 'mileageAbove', km: 128000, maxKm: 100000 }],
    });
    app.clock.set(FAKE_NOW);

    // When
    const home = overview(app);

    // Then
    expect(home.week).toEqual({ received: 2, contacted: 2, replied: 1 });
  });

  it('l’accueil compte les annonces retenues de chaque onglet, et celles arrivées depuis minuit', () => {
    // Given
    const app = world();
    storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-15T06:40:00.000Z', KEPT);
    storeFirstSighting(app.vehicles, MUSTANG_GT, '2026-10-14T21:10:00.000Z', KEPT);
    storeFirstSighting(app.vehicles, ALPINE_A110, '2026-10-12T08:00:00.000Z', { ...KEPT, status: 'contacte' });
    storeFirstSighting(app.vehicles, CORVETTE_C7, '2026-10-11T08:00:00.000Z', { ...KEPT, status: 'ignore', doNotContact: true });
    storeFirstSighting(app.vehicles, BMW_M3_E46, '2026-10-15T07:35:00.000Z', {
      matched: false,
      rejections: [{ kind: 'mileageAbove', km: 128000, maxKm: 100000 }],
    });

    // When
    const home = overview(app);

    // Then
    expect(home.counts).toEqual({ nouveau: 2, contacte: 1, repondu: 0, ignore: 1, today: 1 });
  });

  it('l’accueil reprend le concessionnaire, la zone, la boîte configurée, les alertes cochées, les derniers passages des sources et la clé des notifications', () => {
    // Given
    const app = world();
    app.settings.save(configured);
    app.secrets.set('vapid_public', FAKE_PUSH_KEYS.publicKey);
    app.sourceRuns.record({
      source: 'email',
      lastRunAt: '2026-10-15T08:15:00.000Z',
      ok: true,
      detail: '3 email(s) lu(s), 4 annonce(s), 1 nouvelle(s) correspondant aux réglages.',
    });
    app.sourceRuns.record({
      source: 'http:k3v9q2xa',
      lastRunAt: '2026-10-15T07:00:00.000Z',
      ok: true,
      detail: '12 annonce(s) lue(s) (données structurées). 0 nouvelle(s) correspondant aux réglages.',
    });

    // When
    const home = overview(app);

    // Then
    expect(home.dealer).toEqual(garageDuLac);
    expect(home.zone).toEqual({ city: 'Bordeaux', radiusKm: 100 });
    expect(home.imapConfigured).toBe(true);
    expect(home.alertsDone).toEqual(['leboncoin', 'lacentrale']);
    expect(home.sources.map((run) => run.source)).toEqual(['email', 'http:k3v9q2xa']);
    expect(home.pushKey).toBe(FAKE_PUSH_KEYS.publicKey);
  });

  it('une alerte La Centrale réglée sur 50 km et 80 000 km, plus étroite que les réglages, est signalée à revoir', () => {
    // Given
    const app = world();
    app.settings.save(configured);

    // When
    const home = overview(app);

    // Then
    expect(home.alertIssues).toEqual([
      { site: 'lacentrale', mismatch: { kind: 'radiusNarrower', alertRadiusKm: 50, settingsRadiusKm: 100 } },
      { site: 'lacentrale', mismatch: { kind: 'mileageNarrower', alertMaxKm: 80000, settingsMaxKm: 100000 } },
    ]);
  });

  it('au premier lancement, l’accueil est vide : aucune annonce, boîte non configurée, aucune alerte, aucune clé de notification', () => {
    // Given
    const app = world();

    // When
    const home = overview(app);

    // Then
    expect(home).toEqual({
      counts: { nouveau: 0, contacte: 0, repondu: 0, ignore: 0, today: 0 },
      week: { received: 0, contacted: 0, replied: 0 },
      dealer: defaultSettings().dealer,
      zone: { city: 'Bordeaux', radiusKm: 100 },
      imapConfigured: false,
      alertsDone: [],
      alertIssues: [],
      sources: [],
      pushKey: undefined,
    });
  });

  it('une adresse de boîte saisie sans mot de passe d’application ne compte pas comme une boîte configurée', () => {
    // Given
    const app = world();
    app.settings.save({ ...configured, imap: { ...configured.imap, pass: '' } });

    // When
    const home = overview(app);

    // Then
    expect(home.imapConfigured).toBe(false);
  });
});
