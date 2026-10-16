import { describe, expect, it } from 'vitest';
import { ago } from '../../client/src/format/ago';
import { daysAgo } from '../../client/src/format/daysAgo';
import { foldForSearch } from '../../client/src/format/foldForSearch';
import { formatInteger } from '../../client/src/format/integer';
import { plural } from '../../client/src/format/plural';

const at = (year: number, month: number, day: number, hour: number, minute: number): Date => new Date(year, month - 1, day, hour, minute);

describe('formatage des écrans', () => {
  it('le prix de la Porsche 911 à 89 900 € s’écrit avec une espace ordinaire entre les milliers, comme avant', () => {
    // Given
    const price = 89900;

    // When
    const written = formatInteger(price);

    // Then
    expect(written).toBe('89 900');
  });

  it('une annonce sans kilométrage n’affiche rien à la place du nombre', () => {
    // Given
    const kilometres = null;

    // When
    const written = formatInteger(kilometres);

    // Then
    expect(written).toBe('');
  });

  it('la ligne des sept derniers jours dit « 1 contactée » au singulier et « 12 annonces retenues » au pluriel', () => {
    // Given
    const contacted = 1;
    const received = 12;

    // When
    const line = `${plural(received, 'annonce retenue', 'annonces retenues')}, ${plural(contacted, 'contactée', 'contactées')}`;

    // Then
    expect(line).toBe('12 annonces retenues, 1 contactée');
  });

  it('chercher « merignac » sans accent trouve une annonce située à Mérignac', () => {
    // Given
    const card = 'Porsche 911 Carrera S Mérignac Leboncoin';

    // When
    const found = foldForSearch(card).includes(foldForSearch(' MERIGNAC '));

    // Then
    expect(found).toBe(true);
  });

  it('une annonce publiée hier à 10:02 s’affiche « hier à 10:02 », une autre il y a 25 minutes « il y a 25 min »', () => {
    // Given
    const now = at(2026, 10, 16, 9, 30).getTime();

    // When
    const yesterday = ago(at(2026, 10, 15, 10, 2).toISOString(), now);
    const recent = ago(at(2026, 10, 16, 9, 5).toISOString(), now);

    // Then
    expect(yesterday).toBe('hier à 10:02');
    expect(recent).toBe('il y a 25 min');
  });

  it('une annonce reçue ce matin à 7:15 s’affiche « aujourd’hui à 07:15 », une plus ancienne par sa date', () => {
    // Given
    const now = at(2026, 10, 16, 18, 0).getTime();

    // When
    const thisMorning = ago(at(2026, 10, 16, 7, 15).toISOString(), now);
    const lastWeek = ago(at(2026, 10, 9, 14, 0).toISOString(), now);
    const lastYear = ago(at(2025, 11, 3, 14, 0).toISOString(), now);

    // Then
    expect(thisMorning).toBe('aujourd’hui à 07:15');
    expect(lastWeek).toBe('le 9 oct.');
    expect(lastYear).toBe('le 3 nov. 2025');
  });

  it('un vendeur contacté il y a trois jours attend « il y a 3 j », contacté hier « hier »', () => {
    // Given
    const now = at(2026, 10, 16, 9, 0).getTime();

    // When
    const threeDays = daysAgo(at(2026, 10, 13, 8, 0).toISOString(), now);
    const yesterday = daysAgo(at(2026, 10, 15, 8, 0).toISOString(), now);
    const today = daysAgo(at(2026, 10, 16, 8, 0).toISOString(), now);

    // Then
    expect(threeDays).toBe('il y a 3 j');
    expect(yesterday).toBe('hier');
    expect(today).toBe('aujourd’hui');
  });
});
