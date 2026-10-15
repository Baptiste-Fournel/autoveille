import { type AstNode, descendantsOf, nodeAt, sourceOf, stringAt } from './ast.js';
import { excerpt, type SourceFile, type Violation, violationAt } from './violation.js';

export type AssertionPolicy = 'onlyAsConst' | 'unsafeForbidden';

const assertionTypes = ['TSAsExpression', 'TSTypeAssertion'];

const isAssertion = (node: AstNode | undefined): node is AstNode => node !== undefined && assertionTypes.includes(node.type);

const assertedType = (node: AstNode): AstNode | undefined => nodeAt(node, 'typeAnnotation');

const isAsConst = (node: AstNode): boolean => {
  const type = assertedType(node);
  return type?.type === 'TSTypeReference' && stringAt(nodeAt(type, 'typeName'), 'name') === 'const';
};

const neutralWrappers = ['ParenthesizedExpression', 'TSSatisfiesExpression', 'TSNonNullExpression'];

const withoutNeutralWrappers = (node: AstNode | undefined): AstNode | undefined =>
  node !== undefined && neutralWrappers.includes(node.type) ? withoutNeutralWrappers(nodeAt(node, 'expression')) : node;

const unknownCastInside = (node: AstNode): AstNode | undefined => {
  const inner = withoutNeutralWrappers(nodeAt(node, 'expression'));
  return isAssertion(inner) && assertedType(inner)?.type === 'TSUnknownKeyword' ? inner : undefined;
};

const isUnsafe = (node: AstNode): boolean => assertedType(node)?.type === 'TSNeverKeyword' || unknownCastInside(node) !== undefined;

const typeText = (text: string, node: AstNode): string => {
  const type = assertedType(node);
  return type === undefined ? '?' : sourceOf(text, type);
};

const written = (text: string, node: AstNode): string => {
  const inner = unknownCastInside(node);
  if (inner !== undefined) {
    return `as ${typeText(text, inner)} as ${typeText(text, node)}`;
  }
  return node.type === 'TSTypeAssertion' ? `<${typeText(text, node)}>` : `as ${typeText(text, node)}`;
};

export const assertionViolations = (file: SourceFile, program: AstNode, policy: AssertionPolicy): readonly Violation[] => {
  const assertions = descendantsOf(program).filter(isAssertion);
  const unsafe = assertions.filter(isUnsafe);
  const partOfUnsafe = unsafe.flatMap((node) => unknownCastInside(node) ?? []);
  const unsafeViolations = unsafe.map((node) =>
    violationAt(
      'unsafeAssertion',
      file,
      node.start,
      `assertion « ${excerpt(written(file.text, node))} » : « as unknown as » et « as never » sont interdits partout`,
    ),
  );
  const otherViolations =
    policy === 'onlyAsConst'
      ? assertions
          .filter((node) => !unsafe.includes(node) && !partOfUnsafe.includes(node) && !isAsConst(node))
          .map((node) =>
            violationAt(
              'typeAssertion',
              file,
              node.start,
              `assertion « ${excerpt(written(file.text, node))} » : « as » n'est permis que dans src/infrastructure/ et les tests (ailleurs, seul « as const »)`,
            ),
          )
      : [];
  return [...unsafeViolations, ...otherViolations].sort((left, right) => left.line - right.line);
};
