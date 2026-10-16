import { excerpt, type SourceFile, type Violation, violationAt } from './violation.js';

type Delimiters = {
  readonly open: string;
  readonly close: string;
};

type Comment = {
  readonly start: number;
  readonly text: string;
};

const stylesheet = /\.css$/;

const markup = /\.(?:css|html)$/;

const stylesheetDelimiters: Delimiters = { open: '/*', close: '*/' };

const pageDelimiters: Delimiters = { open: '<!--', close: '-->' };

const quotes = ['"', "'"];

export const isMarkup = (path: string): boolean => markup.test(path);

const stringEnd = (text: string, start: number): number => {
  const quote = text[start];
  let position = start + 1;
  while (position < text.length && text[position] !== quote) {
    position += text[position] === '\\' ? 2 : 1;
  }
  return position + 1;
};

const commentsOf = (text: string, delimiters: Delimiters, quotedStrings: boolean): readonly Comment[] => {
  const comments: Comment[] = [];
  let position = 0;
  while (position < text.length) {
    if (quotedStrings && quotes.includes(text[position] ?? '')) {
      position = stringEnd(text, position);
    } else if (text.startsWith(delimiters.open, position)) {
      const close = text.indexOf(delimiters.close, position + delimiters.open.length);
      const end = close === -1 ? text.length : close + delimiters.close.length;
      comments.push({ start: position, text: text.slice(position, end) });
      position = end;
    } else {
      position += 1;
    }
  }
  return comments;
};

export const markupCommentViolations = (file: SourceFile): readonly Violation[] => {
  const isStylesheet = stylesheet.test(file.path);
  return commentsOf(file.text, isStylesheet ? stylesheetDelimiters : pageDelimiters, isStylesheet).map((comment) =>
    violationAt(
      'comment',
      file,
      comment.start,
      `commentaire interdit « ${excerpt(comment.text)} » : aucun commentaire dans les feuilles de style et les pages servies (une intention de mise en page devient une entrée de docs/decisions.md)`,
    ),
  );
};
