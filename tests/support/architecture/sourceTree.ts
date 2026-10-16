import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { BiomeOverride } from './biomeOverrides.js';
import { isMarkup } from './markupComments.js';
import type { SourceFile } from './violation.js';

const scannedRoots = ['src', 'client', 'public', 'tests'];

const sourceFile = /\.[cm]?[jt]sx?$/;

const skippedDirectories = ['node_modules', '__snapshots__'];

const toRepositoryPath = (root: string, absolutePath: string): string => relative(root, absolutePath).split(sep).join('/');

const servedRoots = ['src', 'client', 'public'];

const isServedMarkup = (path: string): boolean => isMarkup(path) && servedRoots.includes(path.split('/')[0] ?? '');

const isScanned = (path: string): boolean =>
  (sourceFile.test(path) || isServedMarkup(path)) && !path.split('/').some((segment) => skippedDirectories.includes(segment));

export const readSourceTree = (root: string): readonly SourceFile[] =>
  scannedRoots
    .filter((directory) => existsSync(join(root, directory)))
    .flatMap((directory) => readdirSync(join(root, directory), { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((absolutePath) => isScanned(toRepositoryPath(root, absolutePath)))
    .map((absolutePath) => ({ path: toRepositoryPath(root, absolutePath), text: readFileSync(absolutePath, 'utf8') }))
    .sort((left, right) => (left.path < right.path ? -1 : 1));

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null;

const disablesFormatter = (override: Readonly<Record<string, unknown>>): boolean =>
  isRecord(override.formatter) && override.formatter.enabled === false;

const overrideOf = (override: unknown): readonly BiomeOverride[] =>
  isRecord(override) && Array.isArray(override.includes)
    ? [
        {
          includes: override.includes.filter((entry: unknown): entry is string => typeof entry === 'string'),
          disablesFormatter: disablesFormatter(override),
        },
      ]
    : [];

export const readBiomeOverrides = (root: string): readonly BiomeOverride[] => {
  const configuration: unknown = JSON.parse(readFileSync(join(root, 'biome.json'), 'utf8'));
  const overrides = isRecord(configuration) && Array.isArray(configuration.overrides) ? configuration.overrides : [];
  return overrides.flatMap(overrideOf);
};

export const existsInRepository =
  (root: string) =>
  (path: string): boolean =>
    existsSync(join(root, path));
