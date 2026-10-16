import { describe, expect, it } from 'vitest';
import { planVehicleUpdate, UnknownStatus, type VehicleUpdate } from '../../../src/domain/vehicle/status.js';
import type { Vehicle } from '../../../src/domain/vehicle/types.js';
import { knownVehicle } from '../../support/knownVehicle.js';

const NOW = '2026-10-15T08:30:00.000Z';

const planned = (vehicle: Vehicle, request: Parameters<typeof planVehicleUpdate>[1]): VehicleUpdate => {
  const update = planVehicleUpdate(vehicle, request, NOW);
  if (update instanceof UnknownStatus) {
    throw update;
  }
  return update;
};

describe("changer le statut d'une annonce depuis sa carte", () => {
  it('« Oui, envoyé » : une 911 à traiter passe en « contactée », avec un événement de contact daté de maintenant', () => {
    // Given
    const vehicle = knownVehicle({ status: 'nouveau' });

    // When
    const update = planned(vehicle, { status: 'contacte' });

    // Then
    expect(update).toEqual({
      changes: { status: 'contacte' },
      eventsToErase: [],
      eventsToAdd: [{ type: 'statut_contacte', detail: null, at: NOW }],
    });
  });

  it('« Le vendeur a répondu » : une 911 contactée passe en « a répondu », avec un événement de réponse', () => {
    // Given
    const vehicle = knownVehicle({ status: 'contacte' });

    // When
    const update = planned(vehicle, { status: 'repondu' });

    // Then
    expect(update).toEqual({
      changes: { status: 'repondu' },
      eventsToErase: [],
      eventsToAdd: [{ type: 'statut_repondu', detail: null, at: NOW }],
    });
  });

  it('« Pas encore contactée » sur une annonce passée en « contactée » par erreur : son contact est effacé et ne compte plus dans la semaine', () => {
    // Given
    const vehicle = knownVehicle({ status: 'contacte' });

    // When
    const update = planned(vehicle, { status: 'nouveau' });

    // Then
    expect(update.changes).toEqual({ status: 'nouveau' });
    expect(update.eventsToErase).toEqual(['statut_contacte', 'statut_repondu']);
  });

  it('une annonce remise à traiter garde la trace de ce retour : un événement « statut_nouveau » est ajouté', () => {
    // Given
    const vehicle = knownVehicle({ status: 'contacte' });

    // When
    const update = planned(vehicle, { status: 'nouveau' });

    // Then
    expect(update.eventsToAdd).toEqual([{ type: 'statut_nouveau', detail: null, at: NOW }]);
  });

  it('une annonce dont le vendeur a répondu, remise en « contactée », perd sa réponse et reçoit un second événement de contact daté de maintenant', () => {
    // Given
    const vehicle = knownVehicle({ status: 'repondu' });

    // When
    const update = planned(vehicle, { status: 'contacte' });

    // Then
    expect(update).toEqual({
      changes: { status: 'contacte' },
      eventsToErase: ['statut_repondu'],
      eventsToAdd: [{ type: 'statut_contacte', detail: null, at: NOW }],
    });
  });

  it('« Ignorer » une annonce à traiter : elle passe en « ignorée » sans rien effacer', () => {
    // Given
    const vehicle = knownVehicle({ status: 'nouveau' });

    // When
    const update = planned(vehicle, { status: 'ignore' });

    // Then
    expect(update).toEqual({
      changes: { status: 'ignore' },
      eventsToErase: [],
      eventsToAdd: [{ type: 'statut_ignore', detail: null, at: NOW }],
    });
  });

  it('« Ne plus contacter » : le vendeur est mis de côté, l’annonce passe en « ignorée » et l’événement est noté', () => {
    // Given
    const vehicle = knownVehicle({ status: 'nouveau' });

    // When
    const update = planned(vehicle, { doNotContact: true });

    // Then
    expect(update).toEqual({
      changes: { doNotContact: true, status: 'ignore' },
      eventsToErase: [],
      eventsToAdd: [{ type: 'ne_plus_contacter', detail: null, at: NOW }],
    });
  });

  it('« Annuler » juste après « Ne plus contacter » : l’annonce revient à traiter, mais l’événement « ne plus contacter » reste', () => {
    // Given
    const vehicle = knownVehicle({ status: 'ignore', doNotContact: true });

    // When
    const update = planned(vehicle, { status: 'nouveau', doNotContact: false });

    // Then
    expect(update).toEqual({
      changes: { status: 'nouveau', doNotContact: false },
      eventsToErase: ['statut_contacte', 'statut_repondu'],
      eventsToAdd: [{ type: 'statut_nouveau', detail: null, at: NOW }],
    });
  });

  it('« Garder quand même » une 911 de Montauban écartée parce qu’à 180 km : elle est retenue sans raison d’écart et remise à traiter', () => {
    // Given
    const vehicle = knownVehicle({
      city: 'Montauban',
      postalCode: '82000',
      lat: 44.0176,
      lon: 1.3756,
      distanceKm: 180.02914454030503,
      status: 'nouveau',
      matched: false,
      rejections: [{ kind: 'outsideRadius', distanceKm: 180.02914454030503, radiusKm: 100 }],
    });

    // When
    const update = planned(vehicle, { keep: true, status: 'nouveau' });

    // Then
    expect(update).toEqual({
      changes: { status: 'nouveau', matched: true, rejections: [] },
      eventsToErase: ['statut_contacte', 'statut_repondu'],
      eventsToAdd: [
        { type: 'statut_nouveau', detail: null, at: NOW },
        { type: 'garde_manuellement', detail: null, at: NOW },
      ],
    });
  });

  it('une note de rendez-vous saisie sur la fiche est gardée telle quelle', () => {
    // Given
    const vehicle = knownVehicle();

    // When
    const update = planned(vehicle, { note: ' RDV samedi 10 h, il demande 85 000 € ' });

    // Then
    expect(update).toEqual({ changes: { note: ' RDV samedi 10 h, il demande 85 000 € ' }, eventsToErase: [], eventsToAdd: [] });
  });

  it('une note collée de plus de 2 000 caractères est coupée à 2 000', () => {
    // Given
    const vehicle = knownVehicle();
    const pasted = 'Historique d’entretien complet. '.repeat(80);

    // When
    const update = planned(vehicle, { note: pasted });

    // Then
    expect(update.changes.note).toBe(pasted.slice(0, 2000));
    expect(update.changes.note).toHaveLength(2000);
  });

  it('une note vidée sur la fiche, ou réduite à des espaces, est effacée', () => {
    // Given
    const vehicle = knownVehicle({ note: 'RDV samedi' });

    // When
    const emptied = planned(vehicle, { note: '' });
    const blank = planned(vehicle, { note: '   ' });
    const removed = planned(vehicle, { note: null });

    // Then
    expect(emptied.changes).toEqual({ note: null });
    expect(blank.changes).toEqual({ note: null });
    expect(removed.changes).toEqual({ note: null });
  });

  it('un message retouché à la main est gardé tel quel, et un message vidé laisse revenir le gabarit', () => {
    // Given
    const vehicle = knownVehicle();
    const retouched = 'Bonjour, votre 911 m’intéresse.\n\nJean, Garage du Lac\n';

    // When
    const kept = planned(vehicle, { message: retouched });
    const emptied = planned(vehicle, { message: '  \n ' });
    const removed = planned(vehicle, { message: null });

    // Then
    expect(kept.changes).toEqual({ messageOverride: retouched });
    expect(emptied.changes).toEqual({ messageOverride: null });
    expect(removed.changes).toEqual({ messageOverride: null });
  });

  it('un statut inconnu (« vendu ») est refusé, sans rien changer', () => {
    // Given
    const vehicle = knownVehicle();

    // When
    const update = planVehicleUpdate(vehicle, { status: 'vendu', note: 'vendue ailleurs' }, NOW);

    // Then
    expect(update).toBeInstanceOf(UnknownStatus);
    expect(update).toMatchObject({ status: 'vendu' });
  });
});
