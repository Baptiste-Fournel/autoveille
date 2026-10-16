import { type AssertionPolicy, assertionViolations } from './assertions.js';
import { parseSource } from './ast.js';
import { type CommentPolicy, commentViolations } from './comments.js';
import { dependencyViolations } from './dependencies.js';
import { type EntryPoint, globalStateViolations } from './globalState.js';
import { isInSource, isTestFile, type Location, locate } from './location.js';
import { isMarkup, markupCommentViolations } from './markupComments.js';
import { placementViolations } from './placement.js';
import { impureGlobalViolations } from './purity.js';
import { sharedDeclarationViolations } from './sharedTypes.js';
import { type SourceFile, type Violation, violationAt } from './violation.js';

const commentPolicyOf = (location: Location, testFile: boolean): CommentPolicy | undefined => {
  if (testFile) {
    return 'testMarkersOnly';
  }
  return location.area === 'outside' ? undefined : 'noComment';
};

const assertionPolicyOf = (location: Location, testFile: boolean): AssertionPolicy | undefined => {
  if (location.area === 'outside') {
    return undefined;
  }
  return testFile || location.area === 'infrastructure' ? 'unsafeForbidden' : 'onlyAsConst';
};

const clientEntryPoints = ['client/src/main.tsx', 'client/src/beforeFirstPaint.ts', 'client/src/sw.ts'];

const entryPointOf = (path: string, location: Location): EntryPoint =>
  location.area === 'main' || location.area === 'cli' || clientEntryPoints.includes(path) ? 'entryPoint' : 'module';

const holdsProductionState = (location: Location): boolean => isInSource(location) || location.area === 'client';

const violationsOf = (file: SourceFile): readonly Violation[] => {
  const parsed = parseSource(file.path, file.text);
  if (!parsed.ok) {
    return [violationAt('syntax', file, 0, `illisible par le parseur, donc invérifiable : ${parsed.error}`)];
  }
  const { program } = parsed;
  const location = locate(file.path);
  const testFile = isTestFile(file.path);
  const productionSource = holdsProductionState(location) && !testFile;
  const commentPolicy = commentPolicyOf(location, testFile);
  const assertionPolicy = assertionPolicyOf(location, testFile);
  return [
    ...placementViolations(file),
    ...(testFile ? [] : dependencyViolations(file, program, location)),
    ...(location.area === 'shared' && !testFile ? sharedDeclarationViolations(file, program) : []),
    ...(productionSource ? globalStateViolations(file, program, entryPointOf(file.path, location)) : []),
    ...((location.area === 'domain' || location.area === 'application') && !testFile
      ? impureGlobalViolations(file, program, location.area)
      : []),
    ...(commentPolicy === undefined ? [] : commentViolations(file, program, commentPolicy)),
    ...(assertionPolicy === undefined ? [] : assertionViolations(file, program, assertionPolicy)),
  ];
};

export const findViolations = (files: readonly SourceFile[]): readonly Violation[] =>
  files.flatMap((file) => (isMarkup(file.path) ? markupCommentViolations(file) : violationsOf(file)));
