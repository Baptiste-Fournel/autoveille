import { type AstNode, descendantsOf, isAstNode, nodeAt, nodesAt, sourceOf, stringAt, withoutWrappers } from './ast.js';
import { readsProcess } from './purity.js';
import { excerpt, type SourceFile, type Violation, violationAt } from './violation.js';

export type EntryPoint = 'entryPoint' | 'module';

const statefulCollections = ['Map', 'Set', 'WeakMap', 'WeakSet'];

const reactiveStateFactories = ['signal', 'computed', 'effect'];

const functionTypes = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'];

const declarationStatements = [
  'ImportDeclaration',
  'ExportNamedDeclaration',
  'ExportDefaultDeclaration',
  'ExportAllDeclaration',
  'VariableDeclaration',
  'FunctionDeclaration',
  'ClassDeclaration',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSEnumDeclaration',
  'TSModuleDeclaration',
  'TSImportEqualsDeclaration',
  'TSExportAssignment',
  'TSDeclareFunction',
  'EmptyStatement',
];

const isClientFile = (file: SourceFile): boolean => file.path.startsWith('client/');

const builtInsideAFunction = (file: SourceFile): string =>
  isClientFile(file)
    ? "à construire dans une fonction (createAppState pour l'état de l'application)"
    : 'à construire dans une fonction (la fonction main de main.ts comprise)';

const entryPointsOf = (file: SourceFile): string =>
  isClientFile(file) ? 'seuls client/src/main.tsx, beforeFirstPaint.ts et sw.ts en ont' : 'seuls src/main.ts et src/cli/ en ont';

const moduleVariableDeclarations = (program: AstNode): readonly AstNode[] =>
  nodesAt(program, 'body').flatMap((statement) => {
    const declaration = statement.type === 'ExportNamedDeclaration' ? nodeAt(statement, 'declaration') : statement;
    return declaration?.type === 'VariableDeclaration' ? [declaration] : [];
  });

const collectionCreatedBy = (expression: AstNode | undefined): string | undefined => {
  const init = withoutWrappers(expression);
  const constructorName = init?.type === 'NewExpression' ? stringAt(nodeAt(init, 'callee'), 'name') : undefined;
  return constructorName !== undefined && statefulCollections.includes(constructorName) ? constructorName : undefined;
};

const reactiveStateCreatedBy = (expression: AstNode | undefined): string | undefined => {
  const init = withoutWrappers(expression);
  const factory = init?.type === 'CallExpression' ? stringAt(withoutWrappers(nodeAt(init, 'callee')), 'name') : undefined;
  return factory !== undefined && reactiveStateFactories.includes(factory) ? factory : undefined;
};

const isImmediatelyInvoked = (expression: AstNode | undefined): boolean => {
  const init = withoutWrappers(expression);
  const callee = withoutWrappers(nodeAt(init, 'callee'));
  return init?.type === 'CallExpression' && callee !== undefined && functionTypes.includes(callee.type);
};

const declaredName = (file: SourceFile, declarator: AstNode): string => {
  const id = nodeAt(declarator, 'id');
  return stringAt(id, 'name') ?? excerpt(sourceOf(file.text, id ?? declarator));
};

const declaratorViolations = (file: SourceFile, kind: string, declarator: AstNode): readonly Violation[] => {
  const name = declaredName(file, declarator);
  if (kind === 'let' || kind === 'var') {
    return [
      violationAt(
        'globalState',
        file,
        declarator.start,
        `« ${kind} ${name} » au niveau module : état global, à passer en paramètre ou ${builtInsideAFunction(file)}`,
      ),
    ];
  }
  const init = nodeAt(declarator, 'init');
  const collection = collectionCreatedBy(init);
  if (collection !== undefined) {
    return [
      violationAt(
        'globalState',
        file,
        declarator.start,
        `« const ${name} = new ${collection}(…) » au niveau module : état global (cache compris), ${builtInsideAFunction(file)}`,
      ),
    ];
  }
  const reactiveState = isClientFile(file) ? reactiveStateCreatedBy(init) : undefined;
  if (reactiveState !== undefined) {
    return [
      violationAt(
        'globalState',
        file,
        declarator.start,
        `« const ${name} = ${reactiveState}(…) » au niveau module : état partagé par toutes les applications montées, ${builtInsideAFunction(file)}`,
      ),
    ];
  }
  return isImmediatelyInvoked(init)
    ? [
        violationAt(
          'globalState',
          file,
          declarator.start,
          `« const ${name} = (() => …)() » au niveau module : la fermeture exécutée au chargement garde un état global, ${builtInsideAFunction(file)}`,
        ),
      ]
    : [];
};

const variableViolations = (file: SourceFile, program: AstNode): readonly Violation[] =>
  moduleVariableDeclarations(program).flatMap((declaration) =>
    nodesAt(declaration, 'declarations').flatMap((declarator) =>
      declaratorViolations(file, stringAt(declaration, 'kind') ?? 'const', declarator),
    ),
  );

const defaultExportViolations = (file: SourceFile, program: AstNode): readonly Violation[] =>
  nodesAt(program, 'body')
    .filter((statement) => statement.type === 'ExportDefaultDeclaration')
    .flatMap((statement) => {
      const collection = collectionCreatedBy(nodeAt(statement, 'declaration'));
      return collection === undefined
        ? []
        : [
            violationAt(
              'globalState',
              file,
              statement.start,
              `« export default new ${collection}(…) » : état global partagé par tous les importeurs, ${builtInsideAFunction(file)}`,
            ),
          ];
    });

const staticFieldViolations = (file: SourceFile, program: AstNode): readonly Violation[] =>
  descendantsOf(program)
    .filter((node) => node.type === 'PropertyDefinition' && node.static === true)
    .flatMap((field) => {
      const name = stringAt(nodeAt(field, 'key'), 'name') ?? excerpt(sourceOf(file.text, field));
      const collection = collectionCreatedBy(nodeAt(field, 'value'));
      if (collection !== undefined) {
        return [
          violationAt(
            'globalState',
            file,
            field.start,
            `champ « static ${name} = new ${collection}(…) » : état global porté par la classe, ${builtInsideAFunction(file)}`,
          ),
        ];
      }
      return field.readonly === true
        ? []
        : [
            violationAt(
              'globalState',
              file,
              field.start,
              `champ « static ${name} » modifiable : état global porté par la classe, à rendre readonly ou à passer en paramètre`,
            ),
          ];
    });

const isExecutableStatement = (statement: AstNode): boolean =>
  !declarationStatements.includes(statement.type) &&
  !(statement.type === 'ExpressionStatement' && stringAt(statement, 'directive') !== undefined);

const loadTimeStatementViolations = (file: SourceFile, program: AstNode): readonly Violation[] =>
  nodesAt(program, 'body')
    .filter(isExecutableStatement)
    .map((statement) =>
      violationAt(
        'globalState',
        file,
        statement.start,
        `instruction « ${excerpt(sourceOf(file.text, statement).split('\n')[0] ?? '')} » exécutée au chargement du module : effet de bord global, ${entryPointsOf(file)}`,
      ),
    );

const outsideFunctions = (node: AstNode): readonly AstNode[] =>
  functionTypes.includes(node.type)
    ? []
    : [
        node,
        ...Object.values(node)
          .flatMap((value: unknown) => (Array.isArray(value) ? value.filter(isAstNode) : isAstNode(value) ? [value] : []))
          .flatMap(outsideFunctions),
      ];

const moduleLevelProcessViolations = (file: SourceFile, program: AstNode): readonly Violation[] =>
  outsideFunctions(program)
    .filter(readsProcess)
    .map((node) =>
      violationAt(
        'globalState',
        file,
        node.start,
        `« ${excerpt(sourceOf(file.text, node))} » lu au chargement du module : configuration figée en singleton, à lire dans main.ts et à passer en paramètre`,
      ),
    );

export const globalStateViolations = (file: SourceFile, program: AstNode, entryPoint: EntryPoint): readonly Violation[] =>
  [
    ...variableViolations(file, program),
    ...defaultExportViolations(file, program),
    ...staticFieldViolations(file, program),
    ...(entryPoint === 'entryPoint' ? [] : [...loadTimeStatementViolations(file, program), ...moduleLevelProcessViolations(file, program)]),
  ].sort((left, right) => left.line - right.line);
