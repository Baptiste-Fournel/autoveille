import { parseAst } from 'vite';

export type AstNode = {
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly [key: string]: unknown;
};

export type ParseOutcome = { readonly ok: true; readonly program: AstNode } | { readonly ok: false; readonly error: string };

const expressionWrappers = ['ParenthesizedExpression', 'TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion'];

export const isAstNode = (value: unknown): value is AstNode =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  typeof value.type === 'string' &&
  'start' in value &&
  typeof value.start === 'number' &&
  'end' in value &&
  typeof value.end === 'number';

const isList = (value: unknown): value is readonly unknown[] => Array.isArray(value);

const nodesIn = (value: unknown): readonly AstNode[] => {
  if (isList(value)) {
    return value.filter(isAstNode);
  }
  return isAstNode(value) ? [value] : [];
};

export const nodeAt = (node: AstNode | undefined, key: string): AstNode | undefined => {
  const value = node?.[key];
  return isAstNode(value) ? value : undefined;
};

export const nodesAt = (node: AstNode | undefined, key: string): readonly AstNode[] => {
  const value = node?.[key];
  return isList(value) ? value.filter(isAstNode) : [];
};

export const stringAt = (node: AstNode | undefined, key: string): string | undefined => {
  const value = node?.[key];
  return typeof value === 'string' ? value : undefined;
};

export const descendantsOf = (node: AstNode): readonly AstNode[] => [node, ...Object.values(node).flatMap(nodesIn).flatMap(descendantsOf)];

export const withoutWrappers = (node: AstNode | undefined): AstNode | undefined =>
  node !== undefined && expressionWrappers.includes(node.type) ? withoutWrappers(nodeAt(node, 'expression')) : node;

export const sourceOf = (text: string, node: AstNode): string => text.slice(node.start, node.end);

const languageOf = (path: string): 'ts' | 'tsx' | 'js' | 'jsx' => {
  if (path.endsWith('.tsx')) {
    return 'tsx';
  }
  if (path.endsWith('.jsx')) {
    return 'jsx';
  }
  return /\.[cm]?ts$/.test(path) ? 'ts' : 'js';
};

const firstLine = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n').find((line) => line.trim() !== '') ?? message;
};

export const parseSource = (path: string, text: string): ParseOutcome => {
  try {
    const program: unknown = parseAst(text, { lang: languageOf(path), sourceType: 'module' }, path);
    return isAstNode(program) ? { ok: true, program } : { ok: false, error: 'le parseur ne rend pas un programme' };
  } catch (error) {
    return { ok: false, error: firstLine(error) };
  }
};
