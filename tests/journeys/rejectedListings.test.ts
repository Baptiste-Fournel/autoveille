import { describe, expect, it } from 'vitest';
import type { VehicleDto, VehiclesResponse } from '../../src/shared/api.js';
import { setUpDealership } from '../support/dealerPhone.js';
import {
  AUDI_RS6_ON_LEBONCOIN,
  BMW_M3_ON_LEBONCOIN,
  PORSCHE_911_ON_LEBONCOIN,
  porscheGirondeAlert,
} from '../support/porscheGirondeAlert.js';

const FIRST_ALERT = porscheGirondeAlert({ uid: 7, receivedAt: '2026-10-15T08:24:51.000Z' });

const reasonsOf = (vehicles: readonly VehicleDto[]): readonly (readonly [string, readonly string[]])[] =>
  vehicles.map((vehicle) => [vehicle.url, vehicle.reasons]);

describe('écartées par les filtres', () => {
  it('l’alerte Leboncoin « Porsche Gironde » écarte l’Audi RS6 d’un professionnel et la BMW M3 à 128 000 km, rangées par raison : « Garder quand même » remet la M3 à traiter', async () => {
    // Given
    const { phone, inbox } = await setUpDealership();
    inbox.receive(FIRST_ALERT);
    await phone.request('POST', '/api/sources/check-now');
    const { body: followedBrands } = await phone.request<VehiclesResponse>('GET', '/api/vehicles?status=ecartees&kind=suivies&limit=1000');
    const { body: tooManyKilometres } = await phone.request<VehiclesResponse>('GET', '/api/vehicles?status=ecartees&kind=km&limit=1000');
    const [bmw] = tooManyKilometres.vehicles;

    // When
    const kept = await phone.request<VehicleDto>('POST', `/api/vehicles/${bmw?.id}`, { keep: true, status: 'nouveau' });

    // Then
    const { body: toProcess } = await phone.request<VehiclesResponse>('GET', '/api/vehicles?status=nouveau&limit=1000');
    const { body: stillRejected } = await phone.request<VehiclesResponse>('GET', '/api/vehicles?status=ecartees&kind=suivies&limit=1000');
    expect(followedBrands.kinds).toEqual({ tous: 2, suivies: 2, marque: 0, special: 0, pro: 1, km: 1, loin: 0 });
    expect(reasonsOf(followedBrands.vehicles)).toEqual([
      [AUDI_RS6_ON_LEBONCOIN, ['vendeur professionnel']],
      [BMW_M3_ON_LEBONCOIN, ['128 000 km, au-dessus de 100 000 km']],
    ]);
    expect(reasonsOf(tooManyKilometres.vehicles)).toEqual([[BMW_M3_ON_LEBONCOIN, ['128 000 km, au-dessus de 100 000 km']]]);
    expect(kept.body).toMatchObject({ url: BMW_M3_ON_LEBONCOIN, matched: true, reasons: [], status: 'nouveau' });
    expect(toProcess.vehicles.map((vehicle) => vehicle.url)).toEqual([PORSCHE_911_ON_LEBONCOIN, BMW_M3_ON_LEBONCOIN]);
    expect(reasonsOf(stillRejected.vehicles)).toEqual([[AUDI_RS6_ON_LEBONCOIN, ['vendeur professionnel']]]);
    expect(stillRejected.kinds).toEqual({ tous: 1, suivies: 1, marque: 0, special: 0, pro: 1, km: 0, loin: 0 });
  });
});
