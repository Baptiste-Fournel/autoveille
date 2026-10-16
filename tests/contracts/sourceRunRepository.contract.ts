import { expect, it } from 'vitest';
import type { SourceRun, SourceRunRepository } from '../../src/application/ports/sourceRunRepository.js';

const MAILBOX_RUN: SourceRun = {
  source: 'email',
  lastRunAt: '2026-10-13T10:00:06.000Z',
  ok: true,
  detail: '3 email(s) lu(s), 4 annonce(s), 2 nouvelle(s) correspondant aux réglages',
};

const LEPARKING_RUN: SourceRun = {
  source: 'http:k3v9q2xa',
  lastRunAt: '2026-10-13T10:30:00.000Z',
  ok: true,
  detail: '12 annonce(s) lue(s) (données structurées). 0 nouvelle(s) correspondant aux réglages.',
};

export function sourceRunRepositoryContract(create: () => SourceRunRepository): void {
  it('le dernier passage de la boîte mail est retenu avec son détail', () => {
    // Given
    const runs = create();

    // When
    runs.record(MAILBOX_RUN);

    // Then
    expect(runs.all()).toEqual([MAILBOX_RUN]);
  });

  it('un nouveau passage de la boîte mail, en échec, remplace le précédent à sa place dans la liste', () => {
    // Given
    const runs = create();
    runs.record(MAILBOX_RUN);
    runs.record(LEPARKING_RUN);
    const failed: SourceRun = {
      source: 'email',
      lastRunAt: '2026-10-13T10:02:00.000Z',
      ok: false,
      detail: 'Serveur mail injoignable (connect ECONNREFUSED 127.0.0.1:993).',
    };

    // When
    runs.record(failed);

    // Then
    expect(runs.all()).toEqual([failed, LEPARKING_RUN]);
  });

  it('les sources sont listées dans l’ordre de leur premier passage', () => {
    // Given
    const runs = create();

    // When
    runs.record(LEPARKING_RUN);
    runs.record(MAILBOX_RUN);

    // Then
    expect(runs.all().map((run) => run.source)).toEqual(['http:k3v9q2xa', 'email']);
  });
}
