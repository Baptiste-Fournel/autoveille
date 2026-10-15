import { type AstNode, nodeAt, nodesAt, sourceOf, stringAt } from './ast.js';
import { excerpt, type SourceFile, type Violation, violationAt } from './violation.js';

const typeDeclarations = ['TSTypeAliasDeclaration', 'TSInterfaceDeclaration'];

const moduleLinks = ['ImportDeclaration', 'ExportAllDeclaration'];

const isTypeOnlyStatement = (statement: AstNode): boolean => {
  if (typeDeclarations.includes(statement.type) || moduleLinks.includes(statement.type)) {
    return true;
  }
  if (statement.type !== 'ExportNamedDeclaration') {
    return false;
  }
  const declaration = nodeAt(statement, 'declaration');
  if (declaration !== undefined) {
    return typeDeclarations.includes(declaration.type);
  }
  return stringAt(statement, 'exportKind') === 'type';
};

export const sharedDeclarationViolations = (file: SourceFile, program: AstNode): readonly Violation[] =>
  nodesAt(program, 'body')
    .filter((statement) => !isTypeOnlyStatement(statement))
    .map((statement) =>
      violationAt(
        'sharedTypesOnly',
        file,
        statement.start,
        `déclaration exécutable « ${excerpt(sourceOf(file.text, statement).split('\n')[0] ?? '')} » : src/shared/ ne contient que des types et des interfaces`,
      ),
    );
