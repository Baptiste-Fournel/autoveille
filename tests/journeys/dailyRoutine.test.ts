import { describe, expect, it } from 'vitest';
import type { ListedStatus, OverviewResponse, VehicleDto, VehiclesResponse } from '../../src/shared/api.js';
import { FAKE_NOW } from '../fakes/fakeClock.js';
import { type Dealership, notificationsReceived, type Phone, savedSettings, setUpDealership } from '../support/dealerPhone.js';
import {
  AUDI_RS6_ON_LEBONCOIN,
  BMW_M3_ON_LEBONCOIN,
  PORSCHE_911_ON_LEBONCOIN,
  porscheGirondeAlert,
} from '../support/porscheGirondeAlert.js';

const DAY_MS = 86_400_000;

const THE_NEXT_DAY = '2026-10-16T08:30:00.000Z';

const FIRST_ALERT = porscheGirondeAlert({ uid: 7, receivedAt: '2026-10-15T08:24:51.000Z' });

const NEXT_DAY_ALERT_WITH_A_LOWER_PRICE = porscheGirondeAlert({ uid: 8, receivedAt: '2026-10-16T07:41:03.000Z', porschePrice: '84 900 €' });

const tab = async (phone: Phone, status: ListedStatus): Promise<readonly VehicleDto[]> => {
  const { body } = await phone.request<VehiclesResponse>('GET', `/api/vehicles?status=${status}&limit=1000`);
  return body.vehicles;
};

const urlsIn = async (phone: Phone, status: ListedStatus): Promise<readonly string[]> =>
  (await tab(phone, status)).map((vehicle) => vehicle.url);

const overviewOf = async (phone: Phone): Promise<OverviewResponse> => (await phone.request<OverviewResponse>('GET', '/api/overview')).body;

const porscheOf = async (phone: Phone): Promise<VehicleDto> => {
  const porsche = (await tab(phone, 'tous')).find((vehicle) => vehicle.url === PORSCHE_911_ON_LEBONCOIN);
  if (porsche === undefined) {
    throw new Error('La Porsche 911 de l’alerte Leboncoin n’a pas été retenue');
  }
  return porsche;
};

const update = (phone: Phone, vehicle: VehicleDto, change: object) =>
  phone.request<VehicleDto>('POST', `/api/vehicles/${vehicle.id}`, change);

const porscheAlertRead = async (): Promise<Dealership> => {
  const dealership = await setUpDealership();
  dealership.inbox.receive(FIRST_ALERT);
  await dealership.phone.request('POST', '/api/sources/check-now');
  return dealership;
};

describe('au quotidien', () => {
  it('une notification annonce la Porsche 911 de Mérignac : le concessionnaire ouvre l’annonce, copie le message, répond « Oui, envoyé », puis « Le vendeur a répondu » le lendemain', async () => {
    // Given
    const { application, inbox, pushService, phone } = await setUpDealership();
    inbox.receive(FIRST_ALERT);

    // When
    await phone.request('POST', '/api/sources/check-now');
    const [notification] = notificationsReceived(pushService);
    const opened = await phone.request<VehicleDto>('GET', `/api/vehicles/${notification?.vehicleId}`);
    const sent = await update(phone, opened.body, { status: 'contacte' });
    const contacted = await urlsIn(phone, 'contacte');
    const weekAfterContact = (await overviewOf(phone)).week;
    application.clock.advanceBy(DAY_MS);
    const replied = await update(phone, opened.body, { status: 'repondu' });

    // Then
    expect(notification).toEqual({
      title: 'Nouvelle annonce : Porsche 911 Carrera 4S',
      body: '2017, 42 000 km, 89 900 € • Mérignac, à 5 km • Leboncoin',
      url: `http://localhost:80/#/annonce/${opened.body.id}`,
      vehicleId: opened.body.id,
    });
    expect(opened.body).toMatchObject({ url: PORSCHE_911_ON_LEBONCOIN, status: 'nouveau', matched: true });
    expect(opened.body.message).toContain('Porsche 911 Carrera 4S 2017');
    expect(opened.body.message).toContain('Je suis au 06 39 98 12 34.');
    expect(opened.body.message).toContain("je n'insisterai pas");
    expect(sent.body).toMatchObject({ status: 'contacte', contactedAt: FAKE_NOW });
    expect(contacted).toEqual([PORSCHE_911_ON_LEBONCOIN]);
    expect(weekAfterContact).toEqual({ received: 1, contacted: 1, replied: 0 });
    expect(replied.body).toMatchObject({ status: 'repondu', contactedAt: FAKE_NOW, repliedAt: THE_NEXT_DAY });
    expect(await urlsIn(phone, 'repondu')).toEqual([PORSCHE_911_ON_LEBONCOIN]);
    expect(await urlsIn(phone, 'nouveau')).toEqual([]);
    expect((await overviewOf(phone)).week).toEqual({ received: 1, contacted: 1, replied: 1 });
  });

  it('un doigt glisse sur « Ne plus contacter » : « Annuler », dans les six secondes, remet la Porsche à traiter et son vendeur redevient contactable', async () => {
    // Given
    const { phone } = await porscheAlertRead();
    const porsche = await porscheOf(phone);
    await update(phone, porsche, { doNotContact: true });

    // When
    const undone = await update(phone, porsche, { status: porsche.status, doNotContact: false });

    // Then
    expect(undone.body).toMatchObject({ status: 'nouveau', doNotContact: false, matched: true });
    expect(await urlsIn(phone, 'nouveau')).toEqual([PORSCHE_911_ON_LEBONCOIN]);
    expect(await urlsIn(phone, 'ignore')).toEqual([]);
    expect((await overviewOf(phone)).counts).toMatchObject({ nouveau: 1, ignore: 0 });
  });

  it('la Porsche passée dans « Contactées » par erreur : le lendemain, « Pas encore contactée » la remet à traiter et efface le contact du compteur de la semaine', async () => {
    // Given
    const { application, phone } = await porscheAlertRead();
    const porsche = await porscheOf(phone);
    await update(phone, porsche, { status: 'contacte' });
    const weekWithTheMistake = (await overviewOf(phone)).week;
    application.clock.advanceBy(DAY_MS);

    // When
    const putBack = await update(phone, porsche, { status: 'nouveau' });

    // Then
    expect(weekWithTheMistake.contacted).toBe(1);
    expect(putBack.body).toMatchObject({ status: 'nouveau', contactedAt: null });
    expect(await urlsIn(phone, 'nouveau')).toEqual([PORSCHE_911_ON_LEBONCOIN]);
    expect(await urlsIn(phone, 'contacte')).toEqual([]);
    expect((await overviewOf(phone)).week).toEqual({ received: 1, contacted: 0, replied: 0 });
  });

  it('le vendeur de la Porsche demande à ne plus être sollicité : « Ne plus contacter » la met de côté, et sa baisse de prix du lendemain ne déclenche aucune notification', async () => {
    // Given
    const { application, inbox, pushService, phone } = await porscheAlertRead();
    const porsche = await porscheOf(phone);

    // When
    const setAside = await update(phone, porsche, { doNotContact: true });
    application.clock.set(THE_NEXT_DAY);
    inbox.receive(NEXT_DAY_ALERT_WITH_A_LOWER_PRICE);
    await phone.request('POST', '/api/sources/check-now');

    // Then
    expect(setAside.body).toMatchObject({ status: 'ignore', doNotContact: true });
    expect(await urlsIn(phone, 'nouveau')).toEqual([]);
    expect(await porscheOf(phone)).toMatchObject({ status: 'ignore', doNotContact: true, price: 84900, priceDropped: true });
    expect(notificationsReceived(pushService).map((notification) => notification.title)).toEqual([
      'Nouvelle annonce : Porsche 911 Carrera 4S',
    ]);
  });

  it('trois annonces à traiter en rafale : « Oui, envoyé, suivante », « Non, ignorer », puis « Oui, envoyé » les traitent l’une après l’autre', async () => {
    // Given
    const { phone } = await porscheAlertRead();
    await savedSettings(phone, (settings) => ({ ...settings, privateOnly: false, maxKm: 150000 }));
    const queue = (await tab(phone, 'nouveau')).filter((vehicle) => vehicle.matched && !vehicle.doNotContact);

    // When
    const answers = [{ status: 'contacte' }, { status: 'ignore' }, { status: 'contacte' }];
    for (const [index, vehicle] of queue.entries()) {
      await update(phone, vehicle, answers[index] ?? {});
    }

    // Then
    expect(queue.map((vehicle) => vehicle.url)).toEqual([PORSCHE_911_ON_LEBONCOIN, AUDI_RS6_ON_LEBONCOIN, BMW_M3_ON_LEBONCOIN]);
    expect(await urlsIn(phone, 'nouveau')).toEqual([]);
    expect(await urlsIn(phone, 'contacte')).toEqual([PORSCHE_911_ON_LEBONCOIN, BMW_M3_ON_LEBONCOIN]);
    expect(await urlsIn(phone, 'ignore')).toEqual([AUDI_RS6_ON_LEBONCOIN]);
    expect((await overviewOf(phone)).week).toEqual({ received: 3, contacted: 2, replied: 0 });
  });
});
