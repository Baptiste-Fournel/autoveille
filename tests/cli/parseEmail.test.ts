import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { fixturePath } from '../support/fixtures.js';

const run = promisify(execFile);

const PROJECT_DIRECTORY = fileURLToPath(new URL('../../', import.meta.url));

const parseEmail = (...args: readonly string[]) =>
  run(process.execPath, ['--import', 'tsx', 'src/cli/parse-email.ts', ...args], { cwd: PROJECT_DIRECTORY });

describe('npm run parse-email', () => {
  it('le vrai email d’alerte ParuVendu, lu hors ligne, montre l’Audi TT reconnue avec la date de l’email et la référence du message', async () => {
    // Given
    const email = fixturePath('emails/paruvendu/une-nouvelle-annonce.eml');

    // When
    const { stdout } = await parseEmail(email, '--offline');

    // Then
    expect(JSON.parse(stdout)).toEqual({
      site: 'paruvendu',
      pending: 0,
      ignored: 21,
      listings: [
        {
          site: 'paruvendu',
          siteLabel: 'ParuVendu',
          externalId: '1296277822A1KVVOAUTT',
          url: 'https://www.paruvendu.fr/a/voiture-occasion/audi/tt/1296277822A1KVVOAUTT',
          title: 'Audi Tt éthanol',
          price: 17000,
          km: 75000,
          year: 2011,
          sellerType: 'inconnu',
          imageUrl: expect.stringMatching(/^https:\/\/media\.paruvendu\.fr\//),
          publishedAt: '2026-10-15T06:05:12.000Z',
          sourceRef: '<alerte-une-nouvelle-annonce@paruvendu.fr>',
          vehicle: { make: 'Audi', model: 'Tt éthanol', family: 'allemandes', year: 2011, km: 75000, price: 17000 },
        },
      ],
    });
  });

  it('sans fichier, la commande rappelle son usage et échoue', async () => {
    // Given
    const noFile: readonly string[] = [];

    // When
    const failure = await parseEmail(...noFile).then(
      () => undefined,
      (error: unknown) => error,
    );

    // Then
    expect(failure).toMatchObject({ code: 1, stderr: 'Usage : npm run parse-email -- fichier.eml\n' });
  });
});
