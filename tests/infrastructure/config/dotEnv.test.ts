import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readDotEnvFile } from '../../../src/infrastructure/config/dotEnv.js';

describe('fichier .env sur le disque', () => {
  it('le .env de l’installation est lu tel quel ; sans .env (variables passées par systemd seulement), rien n’est lu', () => {
    // Given
    const directory = mkdtempSync(join(tmpdir(), 'autoveille-dotenv-'));
    const installed = join(directory, '.env');
    writeFileSync(installed, 'PORT=3000\nSETUP_CODE=7F3A9C1E\n');

    try {
      // When
      const read = readDotEnvFile(installed);
      const missing = readDotEnvFile(join(directory, 'absent', '.env'));

      // Then
      expect(read).toBe('PORT=3000\nSETUP_CODE=7F3A9C1E\n');
      expect(missing).toBe('');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
