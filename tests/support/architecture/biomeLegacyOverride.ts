import { locate } from './location.js';

const sourceFile = /\.[cm]?[jt]sx?$/;

const legacyAreas = ['public'];

const isLegacyLocation = (path: string): boolean => legacyAreas.includes(locate(path).area);

const directoryProblems = (entry: string, exists: (path: string) => boolean): readonly string[] => {
  const directory = entry.slice(0, -'/**'.length);
  if (directory.includes('*') || !isLegacyLocation(`${directory}/fichier.ts`)) {
    return [`« ${entry} » couvre un emplacement de la nouvelle architecture : nommer les fichiers hérités un par un`];
  }
  return exists(directory) ? [] : [`« ${entry} » vise un dossier qui n'existe plus : le retirer de l'override`];
};

const fileProblems = (entry: string, legacyPaths: readonly string[], exists: (path: string) => boolean): readonly string[] => {
  if (!exists(entry)) {
    return [`« ${entry} » n'existe plus : le retirer de l'override`];
  }
  if (sourceFile.test(entry)) {
    return legacyPaths.includes(entry)
      ? []
      : [
          `« ${entry} » n'a plus d'exception dans tests/support/architecture/legacy.ts : le retirer de l'override pour qu'il soit formaté et vérifié`,
        ];
  }
  return isLegacyLocation(entry) ? [] : [`« ${entry} » n'est pas du code hérité : le retirer de l'override`];
};

export const reviewBiomeLegacyOverride = (
  includes: readonly string[],
  legacyPaths: readonly string[],
  exists: (path: string) => boolean,
): readonly string[] =>
  includes.flatMap((entry) => {
    if (entry.endsWith('/**')) {
      return directoryProblems(entry, exists);
    }
    if (entry.includes('*')) {
      return [`« ${entry} » est un motif qui engloberait du code neuf (src/main.ts, src/cli/…) : nommer les fichiers hérités un par un`];
    }
    return fileProblems(entry, legacyPaths, exists);
  });
