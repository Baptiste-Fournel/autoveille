import { type AstNode, descendantsOf, nodeAt, nodesAt, sourceOf, stringAt } from './ast.js';

export type ImportKind = 'static' | 'reexport' | 'dynamic' | 'typeReference';

export type ModuleImport = {
  readonly specifier: string | undefined;
  readonly sourceText: string;
  readonly kind: ImportKind;
  readonly typeOnly: boolean;
  readonly names: readonly string[];
  readonly offset: number;
};

const specifierOf = (source: AstNode): string | undefined => {
  const value = source.value;
  return source.type === 'Literal' && typeof value === 'string' ? value : undefined;
};

const nameOf = (identifier: AstNode | undefined): string => stringAt(identifier, 'name') ?? stringAt(identifier, 'value') ?? '?';

const importedName = (specifier: AstNode): string => {
  switch (specifier.type) {
    case 'ImportDefaultSpecifier':
      return 'default';
    case 'ImportNamespaceSpecifier':
      return '*';
    default:
      return nameOf(nodeAt(specifier, 'imported'));
  }
};

const importFrom = (
  node: AstNode,
  source: AstNode | undefined,
  text: string,
  kind: ImportKind,
  typeOnly: boolean,
  names: readonly string[],
): readonly ModuleImport[] => {
  if (source === undefined) {
    return [];
  }
  return [{ specifier: specifierOf(source), sourceText: sourceOf(text, source), kind, typeOnly, names, offset: node.start }];
};

const requiredModule = (node: AstNode): AstNode | undefined => {
  const reference = nodeAt(node, 'moduleReference');
  return reference?.type === 'TSExternalModuleReference' ? nodeAt(reference, 'expression') : undefined;
};

const importOf = (node: AstNode, text: string): readonly ModuleImport[] => {
  const source = nodeAt(node, 'source');
  switch (node.type) {
    case 'ImportDeclaration':
      return importFrom(
        node,
        source,
        text,
        'static',
        stringAt(node, 'importKind') === 'type',
        nodesAt(node, 'specifiers').map(importedName),
      );
    case 'ExportNamedDeclaration':
      return importFrom(
        node,
        source,
        text,
        'reexport',
        stringAt(node, 'exportKind') === 'type',
        nodesAt(node, 'specifiers').map((specifier) => nameOf(nodeAt(specifier, 'local'))),
      );
    case 'ExportAllDeclaration':
      return importFrom(node, source, text, 'reexport', stringAt(node, 'exportKind') === 'type', ['*']);
    case 'ImportExpression':
      return importFrom(node, source, text, 'dynamic', false, ['*']);
    case 'TSImportType':
      return importFrom(node, source, text, 'typeReference', true, []);
    case 'TSImportEqualsDeclaration':
      return importFrom(node, requiredModule(node), text, 'static', stringAt(node, 'importKind') === 'type', ['default']);
    default:
      return [];
  }
};

export const importsOf = (program: AstNode, text: string): readonly ModuleImport[] =>
  descendantsOf(program).flatMap((node) => importOf(node, text));
