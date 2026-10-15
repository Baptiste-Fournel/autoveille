import { describe, expect, it } from 'vitest';
import type { IngestDecision } from '../../../src/domain/ingest/decide.js';
import { notificationFor } from '../../../src/domain/ingest/notifications.js';
import type { Vehicle } from '../../../src/domain/vehicle/types.js';
import { decide } from '../../support/ingestion.js';
import { knownListing, knownVehicle, LEBONCOIN_911_TITLE, leboncoinListing as leboncoin, PESSAC } from '../../support/knownVehicle.js';

const priceDropOn = (vehicle: Partial<Vehicle>): IngestDecision =>
  decide(leboncoin('Porsche 911 Carrera S 2015 42 000 km 84 900 €'), {
    kind: 'knownListing',
    listing: knownListing(),
    vehicle: knownVehicle(vehicle),
  });

describe('ce que notifie une annonce reçue', () => {
  it('une 911 retenue qui arrive est notifiée comme nouvelle annonce', () => {
    // Given
    const decision = decide(leboncoin(LEBONCOIN_911_TITLE), { kind: 'newVehicle', location: PESSAC });

    // When
    const notification = notificationFor(decision);

    // Then
    expect(notification).toBe('newVehicle');
  });

  it('une Clio 1.2 écartée par les filtres qui arrive n’est pas notifiée', () => {
    // Given
    const decision = decide(leboncoin('Renault Clio 1.2 2016 60 000 km 7 500 €'), { kind: 'newVehicle', location: PESSAC });

    // When
    const notification = notificationFor(decision);

    // Then
    expect(notification).toBeUndefined();
  });

  it('une baisse de prix sur une 911 à traiter notifie « Prix baissé »', () => {
    // Given
    const decision = priceDropOn({ status: 'nouveau' });

    // When
    const notification = notificationFor(decision);

    // Then
    expect(notification).toBe('priceDrop');
  });

  it('une baisse de prix sur une 911 déjà contactée notifie aussi « Prix baissé » : c’est souvent le bon moment', () => {
    // Given
    const decision = priceDropOn({ status: 'contacte' });

    // When
    const notification = notificationFor(decision);

    // Then
    expect(notification).toBe('priceDrop');
  });

  it('une baisse de prix sur une 911 ignorée, ou dont le vendeur a déjà répondu, ne notifie pas', () => {
    // Given
    const ignored = priceDropOn({ status: 'ignore' });
    const replied = priceDropOn({ status: 'repondu' });

    // When
    const notifications = [notificationFor(ignored), notificationFor(replied)];

    // Then
    expect(notifications).toEqual([undefined, undefined]);
  });

  it('une baisse de prix chez un vendeur « ne plus contacter » ne notifie pas', () => {
    // Given
    const decision = priceDropOn({ status: 'nouveau', doNotContact: true });

    // When
    const notification = notificationFor(decision);

    // Then
    expect(notification).toBeUndefined();
  });

  it('une baisse de prix sur une voiture écartée par les filtres ne notifie pas', () => {
    // Given
    const decision = priceDropOn({ status: 'nouveau', matched: false, rejections: [{ kind: 'mileageAbove', km: 142000, maxKm: 100000 }] });

    // When
    const notification = notificationFor(decision);

    // Then
    expect(notification).toBeUndefined();
  });

  it('une hausse de prix sur une 911 à traiter est notée sans notification', () => {
    // Given
    const decision = decide(leboncoin('Porsche 911 Carrera S 2015 42 000 km 92 900 €'), {
      kind: 'knownListing',
      listing: knownListing(),
      vehicle: knownVehicle(),
    });

    // When
    const notification = notificationFor(decision);

    // Then
    expect(decision.kind).toBe('priceChanged');
    expect(notification).toBeUndefined();
  });

  it('une relecture qui complète l’annonce, une republication ou la même voiture vue sur un autre site ne notifient pas', () => {
    // Given
    const completed = decide(leboncoin(LEBONCOIN_911_TITLE, { imageUrl: 'https://img.leboncoin.fr/api/v1/lbcpb1/images/9a/2c/1e.jpg' }), {
      kind: 'knownListing',
      listing: knownListing(),
      vehicle: knownVehicle(),
    });
    const repost = decide(
      leboncoin(LEBONCOIN_911_TITLE, { externalId: '2811004321', url: 'https://www.leboncoin.fr/ad/voitures/2811004321' }),
      {
        kind: 'knownVehicle',
        vehicle: knownVehicle(),
        listings: [knownListing()],
      },
    );
    const laCentrale = leboncoin(LEBONCOIN_911_TITLE, {
      site: 'lacentrale',
      siteLabel: 'La Centrale',
      externalId: '69112345678',
      url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html',
    });
    const otherSite = decide(laCentrale, { kind: 'knownVehicle', vehicle: knownVehicle(), listings: [knownListing()] });

    // When
    const notifications = [completed, repost, otherSite].map(notificationFor);

    // Then
    expect([completed.kind, repost.kind, otherSite.kind]).toEqual(['seenAgain', 'attachedToVehicle', 'attachedToVehicle']);
    expect(notifications).toEqual([undefined, undefined, undefined]);
  });
});
