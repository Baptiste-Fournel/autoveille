import type { MessageVars } from './variables.js';

type VariableLookup = Readonly<Record<string, unknown>>;

interface FilledSentence {
  readonly text: string;
  readonly missesAValue: boolean;
}

const isMissing = (value: unknown): boolean => value === undefined || value === '';

function fillSentence(sentence: string, values: VariableLookup): FilledSentence {
  const valueAt = (placeholder: string): unknown => values[placeholder.slice(1, -1)];
  const placeholders = Array.from(sentence.matchAll(/\{\w+\}/g), (match) => match[0]);
  return {
    text: sentence.replace(/\{\w+\}/g, (placeholder) => (isMissing(valueAt(placeholder)) ? '' : String(valueAt(placeholder)))),
    missesAValue: placeholders.some((placeholder) => isMissing(valueAt(placeholder))),
  };
}

function renderLine(line: string, values: VariableLookup): string {
  const sentences = line.split(/(?<=[.!?])\s+/);
  const isASingleSentence = sentences.length === 1;
  return sentences
    .map((sentence) => fillSentence(sentence, values))
    .filter((sentence) => isASingleSentence || !sentence.missesAValue)
    .map((sentence) => sentence.text)
    .filter((text) => text.trim() !== '')
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function renderParagraph(paragraph: string, values: VariableLookup): string {
  return paragraph
    .split('\n')
    .map((line) => renderLine(line, values))
    .filter((line) => line !== '')
    .join('\n');
}

export function render(template: string, vars: MessageVars): string {
  const values: VariableLookup = vars;
  return template
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => renderParagraph(paragraph, values))
    .filter((paragraph) => paragraph !== '')
    .join('\n\n');
}
