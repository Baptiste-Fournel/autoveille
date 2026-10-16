import { locate } from './location.js';
import type { RuleId, Violation } from './violation.js';

export type LegacyException = {
  readonly path: string;
  readonly rules: readonly RuleId[];
};

export type ExceptionReview = {
  readonly violations: readonly Violation[];
  readonly staleExceptions: readonly string[];
  readonly invalidExceptions: readonly string[];
};

const legacyFile = 'tests/support/architecture/legacy.ts';

const legacyAreas = ['public'];

const staleness = (exception: LegacyException, violations: readonly Violation[], scannedPaths: readonly string[]): readonly string[] => {
  if (!scannedPaths.includes(exception.path)) {
    return [`${exception.path} n'existe plus : retirer son entrée de ${legacyFile}`];
  }
  if (exception.rules.length === 0) {
    return [`${exception.path} n'a plus aucune règle exemptée : retirer son entrée de ${legacyFile}`];
  }
  return exception.rules
    .filter((rule) => !violations.some((violation) => violation.path === exception.path && violation.rule === rule))
    .map((rule) => `${exception.path} respecte désormais la règle « ${rule} » : la retirer de son entrée dans ${legacyFile}`);
};

const isLegacyPath = (path: string): boolean => legacyAreas.includes(locate(path).area);

const invalidity = (exception: LegacyException, index: number, exceptions: readonly LegacyException[]): readonly string[] => [
  ...(isLegacyPath(exception.path)
    ? []
    : [
        `${exception.path} est un emplacement de la nouvelle architecture : aucune exception n'y est permise dans ${legacyFile}, corriger le fichier`,
      ]),
  ...(exceptions.findIndex((other) => other.path === exception.path) === index
    ? []
    : [`${exception.path} a plusieurs entrées dans ${legacyFile} : n'en garder qu'une`]),
];

export const reviewExceptions = (
  violations: readonly Violation[],
  exceptions: readonly LegacyException[],
  scannedPaths: readonly string[],
): ExceptionReview => ({
  violations: violations.filter(
    (violation) => !exceptions.some((exception) => exception.path === violation.path && exception.rules.includes(violation.rule)),
  ),
  staleExceptions: exceptions.flatMap((exception) => staleness(exception, violations, scannedPaths)),
  invalidExceptions: exceptions.flatMap((exception, index) => invalidity(exception, index, exceptions)),
});
