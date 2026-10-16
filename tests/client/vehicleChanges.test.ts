import { describe, expect, it, vi } from 'vitest';
import type { VehicleDto, VehicleUpdateRequest } from '../../src/shared/api';
import { type FakeServer, json } from './support/fakeServer';
import { type RejectedListing, serverWithRejectedListings } from './support/rejectedListings';
import { applicationState, serverForSignedInDealer } from './support/testApplication';
import {
  alpineA110Pessac,
  audiA3SportbackNotSpecial,
  bmwM3TooManyKilometres,
  ferrari360Langon,
  fiatPandaDisabledBrand,
  overviewWith,
  porsche911Merignac,
  porscheCayennePauTooFar,
} from './support/vehicles';

interface Deferred {
  readonly promise: Promise<Response>;
  readonly resolve: (response: Response) => void;
}

const deferred = (): Deferred => {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

const toBeHandled = [porsche911Merignac(), alpineA110Pessac(), ferrari360Langon()];

const REJECTED_THIS_FORTNIGHT: readonly RejectedListing[] = [
  { vehicle: bmwM3TooManyKilometres(), groups: ['km'] },
  { vehicle: audiA3SportbackNotSpecial(), groups: ['special'] },
  { vehicle: porscheCayennePauTooFar(), groups: ['loin'] },
  { vehicle: fiatPandaDisabledBrand(), groups: ['marque'] },
];

const caddyWhileTheServerRestarts = (): Response =>
  new Response('<html><body>502 Bad Gateway</body></html>', { status: 502, headers: { 'content-type': 'text/html' } });

const dealerWithThreeListings = (): FakeServer => {
  const server = serverForSignedInDealer();
  server.on('GET', '/api/overview', () => json(200, overviewWith({ nouveau: 3 })));
  server.on('GET', '/api/vehicles', () => json(200, { vehicles: toBeHandled, nextCursor: null }));
  return server;
};

const savedAs = (vehicle: VehicleDto) => (request: { readonly body: unknown }) => {
  const change: VehicleUpdateRequest = typeof request.body === 'object' && request.body !== null ? request.body : {};
  return json(200, {
    ...vehicle,
    ...(change.status === undefined ? {} : { status: change.status }),
    ...(change.note === undefined ? {} : { note: change.note }),
  });
};

const namesIn = (state: ReturnType<typeof applicationState>): readonly string[] =>
  state.vehicles.current.value.vehicles.map((vehicle) => vehicle.name);

describe('changements d’une annonce, optimistes', () => {
  it('« Oui, envoyé » sur la Porsche 911 la retire aussitôt des annonces à traiter, avant la réponse du serveur, et le compteur passe de 3 à 2', async () => {
    // Given
    const server = dealerWithThreeListings();
    const answer = deferred();
    server.on('POST', '/api/vehicles/12', () => answer.promise);
    const state = applicationState(server);
    await state.session.load();
    await Promise.all([state.vehicles.revalidate(), state.overview.refresh()]);

    // When
    const saving = state.changes.act(porsche911Merignac(), { status: 'contacte' }, 'Passée en « contactée »');
    const beforeServer = { names: namesIn(state), toBeHandled: state.overview.data.value?.counts.nouveau };
    answer.resolve(json(200, porsche911Merignac({ status: 'contacte', contactedAt: '2026-10-16T07:30:00.000Z' })));
    await saving;

    // Then
    expect(beforeServer).toEqual({ names: ['Alpine A110 Légende', 'Ferrari 360 Modena'], toBeHandled: 2 });
    expect(state.toast.current.value?.text).toBe('Passée en « contactée »');
    expect(state.toast.current.value?.undo).not.toBeNull();
    expect(server.requestsTo('POST', '/api/vehicles/12')[0]?.body).toEqual({ status: 'contacte' });
  });

  it('le serveur refuse le changement (panne pendant la mise à jour) : la Porsche revient à sa place dans la liste, et la raison s’affiche', async () => {
    // Given
    const server = dealerWithThreeListings();
    server.on('POST', '/api/vehicles/12', () => json(500, { error: 'Le serveur est indisponible.' }));
    const state = applicationState(server);
    await state.session.load();
    await Promise.all([state.vehicles.revalidate(), state.overview.refresh()]);

    // When
    const saved = await state.changes.act(porsche911Merignac(), { status: 'ignore' }, 'Annonce ignorée');

    // Then
    expect(saved).toBeNull();
    expect(namesIn(state)).toEqual(['Porsche 911 Carrera S', 'Alpine A110 Légende', 'Ferrari 360 Modena']);
    expect(state.overview.data.value?.counts.nouveau).toBe(3);
    expect(state.toast.current.value).toMatchObject({ text: 'Le serveur est indisponible.', error: true });
  });

  it('« Annuler » dans les six secondes remet la Porsche à traiter, à sa place en tête de liste, et dit « Annulé »', async () => {
    // Given
    const server = dealerWithThreeListings();
    const answers = [porsche911Merignac({ doNotContact: true, status: 'ignore' }), porsche911Merignac()];
    server.on('POST', '/api/vehicles/12', () => json(200, answers.shift()));
    const state = applicationState(server);
    await state.session.load();
    await state.vehicles.revalidate();
    const undone: string[] = [];
    await state.changes.act(porsche911Merignac(), { doNotContact: true }, 'Vendeur ajouté à la liste « ne plus contacter »', {
      onUndone: () => undone.push('rafale'),
    });
    const afterChange = namesIn(state);

    // When
    await state.toast.undo();

    // Then
    expect(afterChange).toEqual(['Alpine A110 Légende', 'Ferrari 360 Modena']);
    expect(server.requestsTo('POST', '/api/vehicles/12').map((request) => request.body)).toEqual([
      { doNotContact: true },
      { status: 'nouveau', doNotContact: false },
    ]);
    expect(namesIn(state)).toEqual(['Porsche 911 Carrera S', 'Alpine A110 Légende', 'Ferrari 360 Modena']);
    expect(state.toast.current.value?.text).toBe('Annulé');
    expect(undone).toEqual(['rafale']);
  });

  it('« Garder quand même » sur la BMW M3 écartée pour ses 128 000 km, depuis « Trop de km », la retire aussitôt, puis les compteurs de tous les groupes sont relus : « Marques suivies » passe de 3 à 2', async () => {
    // Given
    const server = serverWithRejectedListings(REJECTED_THIS_FORTNIGHT);
    const state = applicationState(server);
    await state.vehicles.select({ status: 'ecartees', kind: 'km' });
    const before = state.vehicles.current.value.kinds;

    // When
    await state.changes.act(bmwM3TooManyKilometres(), { keep: true, status: 'nouveau' }, 'Annonce gardée');

    // Then
    expect(before).toMatchObject({ tous: 4, suivies: 3, km: 1 });
    expect(state.vehicles.current.value.vehicles).toEqual([]);
    await vi.waitFor(() =>
      expect(state.vehicles.current.value.kinds).toEqual({ tous: 3, suivies: 2, marque: 1, special: 1, pro: 0, km: 0, loin: 1 }),
    );
    expect(state.vehicles.current.value.vehicles).toEqual([]);
  });

  it('« Garder quand même » refusé par le serveur pendant une mise à jour : la BMW revient dans « Trop de km » et n’apparaît pas dans « Autres marques », ouvert juste avant', async () => {
    // Given
    const server = serverWithRejectedListings(REJECTED_THIS_FORTNIGHT);
    server.on('POST', '/api/vehicles/21', () => caddyWhileTheServerRestarts());
    const state = applicationState(server);
    await state.vehicles.select({ status: 'ecartees', kind: 'marque' });
    await state.vehicles.select({ status: 'ecartees', kind: 'km' });

    // When
    const saved = await state.changes.act(bmwM3TooManyKilometres(), { keep: true, status: 'nouveau' }, 'Annonce gardée');
    const tooManyKilometres = namesIn(state);
    await state.vehicles.select({ status: 'ecartees', kind: 'marque' });

    // Then
    expect(saved).toBeNull();
    expect(tooManyKilometres).toEqual(['BMW M3']);
    expect(namesIn(state)).toEqual(['Fiat Panda']);
    expect(state.vehicles.current.value.kinds).toMatchObject({ tous: 4, marque: 1 });
    expect(state.toast.current.value).toMatchObject({ text: 'Erreur 502', error: true });
  });

  it('une note saisie sur la fiche de l’Alpine apparaît sur sa carte dans la liste, sans recharger la liste', async () => {
    // Given
    const server = dealerWithThreeListings();
    server.on('POST', '/api/vehicles/15', savedAs(alpineA110Pessac()));
    const state = applicationState(server);
    await state.session.load();
    await state.vehicles.revalidate();
    const listRequests = server.requestsTo('GET', '/api/vehicles').length;

    // When
    const saved = await state.changes.save(alpineA110Pessac(), { note: 'Rappeler samedi, prix ferme' });

    // Then
    expect(saved?.note).toBe('Rappeler samedi, prix ferme');
    expect(state.vehicles.find(15)?.note).toBe('Rappeler samedi, prix ferme');
    expect(server.requestsTo('GET', '/api/vehicles')).toHaveLength(listRequests);
  });

  it('la question « Message envoyé ? » en attente pour la Porsche disparaît dès qu’une décision est prise sur elle', async () => {
    // Given
    const server = dealerWithThreeListings();
    server.on('POST', '/api/vehicles/12', savedAs(porsche911Merignac()));
    const state = applicationState(server);
    state.pendingConfirmation.value = 12;

    // When
    await state.changes.act(porsche911Merignac(), { status: 'ignore' }, 'Annonce ignorée');

    // Then
    expect(state.pendingConfirmation.value).toBeNull();
  });
});
