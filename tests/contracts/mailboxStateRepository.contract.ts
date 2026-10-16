import { expect, it } from 'vitest';
import type { MailboxStateRepository, ProcessedEmail } from '../../src/application/ports/mailboxStateRepository.js';

const PARUVENDU_EMAIL: ProcessedEmail = {
  messageId: '<20261013065803.4f2a@paruvendu.fr>',
  uid: 142,
  subject: '🚗 1 nouvelle annonce correspond à votre recherche',
  sender: 'alertes@paruvendu.fr',
  receivedAt: '2026-10-13T06:58:03.000Z',
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
  },
  error: null,
  processedAt: '2026-10-13T07:00:12.000Z',
};

const LA_CENTRALE_DIGEST: ProcessedEmail = {
  messageId: '<digest-61@lacentrale.fr>',
  uid: 143,
  subject: '61 nouveaux véhicules correspondent à votre recherche',
  sender: 'alerte@lacentrale.fr',
  receivedAt: '2026-10-13T09:56:40.000Z',
  site: 'lacentrale',
  listingCount: 3,
  summary: {
    listings: [
      {
        title: 'Porsche 911 (997) Carrera S 3.8 355ch',
        price: 54900,
        km: 89000,
        sellerType: 'pro',
        url: 'https://www.lacentrale.fr/auto-occasion-annonce-69100000001.html',
      },
      { title: 'Mercedes-AMG C63 S Coupé', price: 64900, url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html' },
      { title: 'BMW M3 Compétition', url: 'https://www.lacentrale.fr/auto-occasion-annonce-69100000002.html' },
    ],
    pending: 0,
    ignored: 12,
    announced: 61,
    kind: 'new',
    moreUrl: 'https://www.lacentrale.fr/listing?makesModelsCommercialNames=PORSCHE',
  },
  error: null,
  processedAt: '2026-10-13T10:00:05.000Z',
};

const UNREADABLE_EMAIL: ProcessedEmail = {
  messageId: 'uid-1-144',
  uid: 144,
  subject: '',
  sender: '',
  receivedAt: null,
  site: null,
  listingCount: 0,
  summary: null,
  error: 'Unexpected close',
  processedAt: '2026-10-13T10:00:06.000Z',
};

export function mailboxStateRepositoryContract(create: () => MailboxStateRepository): void {
  it('un email d’alerte ParuVendu traité est reconnu à son Message-ID à la passe suivante', () => {
    // Given
    const state = create();

    // When
    state.recordProcessed(PARUVENDU_EMAIL);

    // Then
    expect(state.isProcessed(PARUVENDU_EMAIL.messageId)).toBe(true);
    expect(state.isProcessed(LA_CENTRALE_DIGEST.messageId)).toBe(false);
  });

  it('le résumé tronqué La Centrale « 61 nouveaux véhicules » se relit tel qu’il a été enregistré, avec le lien vers la suite', () => {
    // Given
    const state = create();

    // When
    state.recordProcessed(LA_CENTRALE_DIGEST);

    // Then
    expect(state.recentlyProcessed(60)).toEqual([LA_CENTRALE_DIGEST]);
  });

  it('l’écran Sites montre les emails du plus récemment traité au plus ancien, dans la limite demandée', () => {
    // Given
    const state = create();
    state.recordProcessed(PARUVENDU_EMAIL);
    state.recordProcessed(UNREADABLE_EMAIL);
    state.recordProcessed(LA_CENTRALE_DIGEST);

    // When
    const recent = state.recentlyProcessed(2);

    // Then
    expect(recent.map((email) => email.messageId)).toEqual([UNREADABLE_EMAIL.messageId, LA_CENTRALE_DIGEST.messageId]);
  });

  it('deux emails traités dans la même milliseconde : le premier enregistré est montré d’abord', () => {
    // Given
    const state = create();
    state.recordProcessed({ ...PARUVENDU_EMAIL, processedAt: LA_CENTRALE_DIGEST.processedAt });
    state.recordProcessed(LA_CENTRALE_DIGEST);

    // When
    const recent = state.recentlyProcessed(60);

    // Then
    expect(recent.map((email) => email.messageId)).toEqual([PARUVENDU_EMAIL.messageId, LA_CENTRALE_DIGEST.messageId]);
  });

  it('un email en erreur relu après une passe interrompue garde une seule ligne, avec la dernière erreur et sa date', () => {
    // Given
    const state = create();
    state.recordProcessed(UNREADABLE_EMAIL);

    // When
    state.recordProcessed({ ...UNREADABLE_EMAIL, error: 'Command failed', processedAt: '2026-10-13T10:02:06.000Z' });

    // Then
    expect(state.recentlyProcessed(60)).toEqual([
      { ...UNREADABLE_EMAIL, error: 'Command failed', processedAt: '2026-10-13T10:02:06.000Z' },
    ]);
  });

  it('un email réenregistré sous le même Message-ID garde son sujet, son expéditeur, sa date et son site d’origine', () => {
    // Given
    const state = create();
    state.recordProcessed(LA_CENTRALE_DIGEST);

    // When
    state.recordProcessed({
      ...UNREADABLE_EMAIL,
      messageId: LA_CENTRALE_DIGEST.messageId,
      processedAt: '2026-10-13T10:05:00.000Z',
    });

    // Then
    expect(state.recentlyProcessed(60)).toEqual([
      {
        ...LA_CENTRALE_DIGEST,
        listingCount: 0,
        summary: null,
        error: 'Unexpected close',
        processedAt: '2026-10-13T10:05:00.000Z',
      },
    ]);
  });

  it('une boîte jamais lue commence au début, sans uidValidity connue', () => {
    // Given
    const state = create();

    // When
    const position = state.position('INBOX');

    // Then
    expect(position).toEqual({ lastUid: 0, uidValidity: null });
  });

  it('la position atteinte dans INBOX est retenue pour INBOX seulement', () => {
    // Given
    const state = create();

    // When
    state.savePosition('INBOX', { lastUid: 144, uidValidity: 1 });

    // Then
    expect(state.position('INBOX')).toEqual({ lastUid: 144, uidValidity: 1 });
    expect(state.position('Alertes')).toEqual({ lastUid: 0, uidValidity: null });
  });

  it('« Tout relire » oublie les emails déjà lus et repart du début de la boîte, sans oublier son uidValidity', () => {
    // Given
    const state = create();
    state.recordProcessed(PARUVENDU_EMAIL);
    state.recordProcessed(LA_CENTRALE_DIGEST);
    state.savePosition('INBOX', { lastUid: 143, uidValidity: 1 });

    // When
    state.forgetReadEmails();

    // Then
    expect(state.isProcessed(PARUVENDU_EMAIL.messageId)).toBe(false);
    expect(state.recentlyProcessed(60)).toEqual([]);
    expect(state.position('INBOX')).toEqual({ lastUid: 0, uidValidity: 1 });
  });
}
