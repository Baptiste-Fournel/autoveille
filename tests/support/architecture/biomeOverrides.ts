export type BiomeOverride = {
  readonly includes: readonly string[];
  readonly disablesFormatter: boolean;
};

const sourceFile = /\.[cm]?[jt]sx?$/;

const entryProblems = (entry: string, exists: (path: string) => boolean): readonly string[] => {
  if (entry.includes('*')) {
    return [`« ${entry} » est un motif qui engloberait du code neuf (src/main.ts, src/cli/…) : nommer les fichiers un par un`];
  }
  if (sourceFile.test(entry)) {
    return [`« ${entry} » est du code : une règle de Biome s'y respecte, elle ne s'y relâche pas`];
  }
  return exists(entry) ? [] : [`« ${entry} » n'existe plus : le retirer de l'override`];
};

const formatterProblems = (override: BiomeOverride): readonly string[] =>
  override.disablesFormatter
    ? [`l'override de ${override.includes.join(', ')} coupe le formateur : tout fichier du dépôt est formaté`]
    : [];

export const reviewBiomeOverrides = (overrides: readonly BiomeOverride[], exists: (path: string) => boolean): readonly string[] =>
  overrides.flatMap((override) => [...formatterProblems(override), ...override.includes.flatMap((entry) => entryProblems(entry, exists))]);
