import type { AnyNode } from 'domhandler';
import { cleanText } from '../../domain/parsing/text.js';

const textNodes = (node: AnyNode): readonly string[] => {
  if (node.type === 'text' && 'data' in node) {
    return [node.data];
  }
  if ((node.type === 'tag' || node.type === 'root') && 'children' in node) {
    return node.children.flatMap(textNodes);
  }
  return [];
};

export const spacedText = (node: AnyNode): string => cleanText(textNodes(node).join(' '));
