import { existsSync, readFileSync } from 'node:fs';

export type DotEnvEntry = readonly [name: string, value: string];

const QUOTES = ['"', "'"] as const;

const unquoted = (value: string): string =>
  QUOTES.some((quote) => value.startsWith(quote) && value.endsWith(quote)) ? value.slice(1, -1) : value;

const entryOf = (rawLine: string): readonly DotEnvEntry[] => {
  const line = rawLine.trim();
  const separator = line.indexOf('=');
  if (!line || line.startsWith('#') || separator < 0) {
    return [];
  }
  return [[line.slice(0, separator).trim(), unquoted(line.slice(separator + 1).trim())]];
};

export const parseDotEnv = (content: string): readonly DotEnvEntry[] => content.split('\n').flatMap(entryOf);

export const readDotEnvFile = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '');
