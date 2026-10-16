import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixturesDirectory = fileURLToPath(new URL('../fixtures/', import.meta.url));

export function fixturePath(pathInFixtures: string): string {
  return join(fixturesDirectory, pathInFixtures);
}

export function loadFixture(pathInFixtures: string): string {
  return readFileSync(fixturePath(pathInFixtures), 'utf8');
}
