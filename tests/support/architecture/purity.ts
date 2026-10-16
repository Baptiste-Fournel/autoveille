import { type AstNode, descendantsOf, nodeAt, nodesAt, sourceOf, stringAt, withoutWrappers } from './ast.js';
import { excerpt, type SourceFile, type Violation, violationAt } from './violation.js';

type Impurity = 'clock' | 'random' | 'network' | 'process';

type Finding = {
  readonly node: AstNode;
  readonly impurity: Impurity;
};

const globalObjects = ['globalThis', 'window', 'self'];

const reasons: Readonly<Record<Impurity, string>> = {
  clock: "l'heure courante se lit par le port Clock et entre en paramètre",
  random: "l'aléatoire passe par le port Random (et le hachage par createHash de node:crypto)",
  network: 'le réseau passe par un port, implémenté dans src/infrastructure/',
  process: "l'environnement et le processus ne se lisent que dans src/main.ts et src/cli/ : la configuration entre en paramètre",
};

const identifierName = (node: AstNode | undefined): string | undefined => {
  const bare = withoutWrappers(node);
  return bare?.type === 'Identifier' ? stringAt(bare, 'name') : undefined;
};

const propertyName = (member: AstNode): string | undefined => {
  const property = nodeAt(member, 'property');
  if (member.computed === true) {
    const value = property?.value;
    return property?.type === 'Literal' && typeof value === 'string' ? value : undefined;
  }
  return stringAt(property, 'name');
};

const memberImpurity = (member: AstNode): Impurity | undefined => {
  const object = identifierName(nodeAt(member, 'object'));
  const property = propertyName(member);
  if (object === 'Date' && property === 'now') {
    return 'clock';
  }
  if ((object === 'Math' && property === 'random') || object === 'crypto') {
    return 'random';
  }
  if (object === 'process') {
    return 'process';
  }
  if (object !== undefined && globalObjects.includes(object)) {
    switch (property) {
      case 'crypto':
        return 'random';
      case 'fetch':
        return 'network';
      case 'process':
        return 'process';
      default:
        return undefined;
    }
  }
  return undefined;
};

export const readsProcess = (node: AstNode): boolean =>
  (node.type === 'MemberExpression' && memberImpurity(node) === 'process') ||
  (node.type === 'VariableDeclarator' && identifierName(nodeAt(node, 'init')) === 'process');

const impurityOf = (node: AstNode): Impurity | undefined => {
  switch (node.type) {
    case 'MemberExpression':
      return memberImpurity(node);
    case 'NewExpression':
      return identifierName(nodeAt(node, 'callee')) === 'Date' && nodesAt(node, 'arguments').length === 0 ? 'clock' : undefined;
    case 'CallExpression': {
      const callee = identifierName(nodeAt(node, 'callee'));
      if (callee === 'Date') {
        return 'clock';
      }
      return callee === 'fetch' ? 'network' : undefined;
    }
    case 'VariableDeclarator': {
      const init = identifierName(nodeAt(node, 'init'));
      if (init === 'process') {
        return 'process';
      }
      return init === 'crypto' ? 'random' : undefined;
    }
    default:
      return undefined;
  }
};

const shownCode = (file: SourceFile, finding: Finding): string => {
  if (finding.node.type !== 'VariableDeclarator') {
    return sourceOf(file.text, finding.node);
  }
  const init = nodeAt(finding.node, 'init');
  return init === undefined ? sourceOf(file.text, finding.node) : `= ${sourceOf(file.text, init)}`;
};

export const impureGlobalViolations = (file: SourceFile, program: AstNode, layer: 'domain' | 'application'): readonly Violation[] =>
  descendantsOf(program)
    .flatMap((node): readonly Finding[] => {
      const impurity = impurityOf(node);
      return impurity === undefined ? [] : [{ node, impurity }];
    })
    .map((finding) =>
      violationAt(
        'impureGlobal',
        file,
        finding.node.start,
        `« ${excerpt(shownCode(file, finding))} » dans src/${layer}/ : ${reasons[finding.impurity]}`,
      ),
    );
