import { posix } from 'node:path';
import { isTestFile, withoutExtension } from './location.js';
import { type SourceFile, type Violation, violationAt } from './violation.js';

const targetDirectories = ['src/domain/', 'src/application/', 'src/infrastructure/', 'src/shared/', 'src/cli/'];

const compositionRoot = 'src/main.ts';

const conceptlessNames = ['utils', 'index'];

const outsideLayout = (file: SourceFile): readonly Violation[] => {
  if (!file.path.startsWith('src/')) {
    return [];
  }
  if (isTestFile(file.path)) {
    return [violationAt('placement', file, 0, 'test placé dans src/ : les tests vont dans tests/')];
  }
  const placed = file.path === compositionRoot || targetDirectories.some((directory) => file.path.startsWith(directory));
  return placed
    ? []
    : [
        violationAt(
          'placement',
          file,
          0,
          'fichier hors de la disposition cible : src/ ne contient que domain/, application/, infrastructure/, shared/, cli/ et main.ts',
        ),
      ];
};

const conceptlessName = (file: SourceFile): readonly Violation[] => {
  const name = withoutExtension(posix.basename(file.path));
  const governed = (file.path.startsWith('src/') || file.path.startsWith('client/')) && !isTestFile(file.path);
  return governed && conceptlessNames.includes(name)
    ? [
        violationAt(
          'placement',
          file,
          0,
          `fichier « ${posix.basename(file.path)} » : un fichier porte un seul concept et en prend le nom, sans utils.ts ni barrel index.ts`,
        ),
      ]
    : [];
};

export const placementViolations = (file: SourceFile): readonly Violation[] => [...outsideLayout(file), ...conceptlessName(file)];
