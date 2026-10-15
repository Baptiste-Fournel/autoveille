import { type AstNode, descendantsOf } from './ast.js';
import { excerpt, type SourceFile, type Violation, violationAt } from './violation.js';

export type CommentPolicy = 'noComment' | 'testMarkersOnly';

type Comment = {
  readonly start: number;
  readonly text: string;
};

type Range = {
  readonly start: number;
  readonly end: number;
};

const literalTypes = ['Literal', 'TemplateElement', 'JSXText'];

const testMarkers = ['// Arrange', '// Act', '// Assert', '// Given', '// When', '// Then'];

const literalRanges = (program: AstNode): readonly Range[] =>
  descendantsOf(program)
    .filter((node) => literalTypes.includes(node.type))
    .map((node) => ({ start: node.start, end: node.end }))
    .sort((left, right) => left.start - right.start);

const opensComment = (text: string, position: number): boolean =>
  text[position] === '/' && (text[position + 1] === '/' || text[position + 1] === '*');

const commentEnd = (text: string, start: number): number => {
  if (text[start + 1] === '/') {
    const newline = text.indexOf('\n', start);
    return newline === -1 ? text.length : newline;
  }
  const close = text.indexOf('*/', start + 2);
  return close === -1 ? text.length : close + 2;
};

export const commentsOf = (text: string, program: AstNode): readonly Comment[] => {
  const ranges = literalRanges(program);
  const comments: Comment[] = [];
  let position = 0;
  let nextRange = 0;
  while (position < text.length) {
    const range = ranges[nextRange];
    if (range !== undefined && position >= range.start) {
      position = Math.max(position, range.end);
      nextRange += 1;
    } else if (opensComment(text, position)) {
      const end = commentEnd(text, position);
      comments.push({ start: position, text: text.slice(position, end) });
      position = end;
    } else {
      position += 1;
    }
  }
  return comments;
};

const isAllowed = (comment: Comment, policy: CommentPolicy): boolean =>
  policy === 'testMarkersOnly' && testMarkers.includes(comment.text.trimEnd());

const describeComment = (comment: Comment, policy: CommentPolicy): string =>
  policy === 'noComment'
    ? `commentaire interdit « ${excerpt(comment.text)} » : aucun commentaire dans le code, JSDoc compris (une règle devient un test nommé, une fonction ou une constante nommée, ou une entrée de docs/decisions.md)`
    : `commentaire interdit « ${excerpt(comment.text)} » : dans les tests, seuls ${testMarkers.join(', ')} sont permis, tels quels`;

export const commentViolations = (file: SourceFile, program: AstNode, policy: CommentPolicy): readonly Violation[] =>
  commentsOf(file.text, program)
    .filter((comment) => !isAllowed(comment, policy))
    .map((comment) => violationAt('comment', file, comment.start, describeComment(comment, policy)));
