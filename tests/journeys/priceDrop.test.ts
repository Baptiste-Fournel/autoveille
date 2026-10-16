import { describe, expect, it } from 'vitest';
import type { VehicleDto, VehiclesResponse } from '../../src/shared/api.js';
import { notificationsReceived, setUpDealership } from '../support/dealerPhone.js';
import { PORSCHE_911_ON_LEBONCOIN, porscheGirondeAlert } from '../support/porscheGirondeAlert.js';

const THE_NEXT_DAY = '2026-10-16T08:30:00.000Z';

const FIRST_ALERT = porscheGirondeAlert({ uid: 7, receivedAt: '2026-10-15T08:24:51.000Z' });

const NEXT_DAY_ALERT_WITH_A_LOWER_PRICE = porscheGirondeAlert({ uid: 8, receivedAt: '2026-10-16T07:41:03.000Z', porschePrice: '84 900 €' });

describe('prix baissé', () => {
  it('le vendeur de la Porsche 911 déjà contacté baisse son prix de 89 900 à 84 900 € : une notification « Prix baissé » arrive, la Porsche reste dans « Contactées » avec l’étiquette', async () => {
    // Given
    const { application, inbox, pushService, phone } = await setUpDealership();
    inbox.receive(FIRST_ALERT);
    await phone.request('POST', '/api/sources/check-now');
    const [announced] = notificationsReceived(pushService);
    await phone.request('POST', `/api/vehicles/${announced?.vehicleId}`, { status: 'contacte' });
    application.clock.set(THE_NEXT_DAY);

    // When
    inbox.receive(NEXT_DAY_ALERT_WITH_A_LOWER_PRICE);
    await phone.request('POST', '/api/sources/check-now');

    // Then
    const { body: contacted } = await phone.request<VehiclesResponse>('GET', '/api/vehicles?status=contacte');
    const { body: sheet } = await phone.request<VehicleDto>('GET', `/api/vehicles/${announced?.vehicleId}`);
    expect(notificationsReceived(pushService).slice(1)).toEqual([
      {
        title: 'Prix baissé : Porsche 911 Carrera 4S',
        body: '89 900 € → 84 900 € • vendeur déjà contacté • Leboncoin',
        url: `http://localhost:80/#/annonce/${announced?.vehicleId}`,
        vehicleId: announced?.vehicleId,
      },
    ]);
    expect(contacted.vehicles.map((vehicle) => [vehicle.url, vehicle.price, vehicle.priceDropped])).toEqual([
      [PORSCHE_911_ON_LEBONCOIN, 84900, true],
    ]);
    expect(sheet.listings[0]?.priceHistory.map((point) => point.price)).toEqual([89900, 84900]);
    expect(sheet.events.map((event) => [event.type, event.detail])).toContainEqual(['prix_baisse', '89900 → 84900']);
  });
});
