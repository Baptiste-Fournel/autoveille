import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT_PAGE = fileURLToPath(new URL('../../client/index.html', import.meta.url));

const PUBLIC_DIRECTORY = fileURLToPath(new URL('../../public/', import.meta.url));

export interface ServedClient {
  readonly directory: string;
  readonly remove: () => void;
}

export const servedClient = (): ServedClient => {
  const directory = mkdtempSync(join(tmpdir(), 'autoveille-client-'));
  cpSync(PUBLIC_DIRECTORY, directory, { recursive: true });
  cpSync(CLIENT_PAGE, join(directory, 'index.html'));
  return { directory, remove: () => rmSync(directory, { recursive: true, force: true }) };
};
