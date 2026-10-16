import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { AdAnchor, AnchorKeyOf } from './adAnchor.js';
import { PRICE_OR_KM_MENTION } from './priceOrKmMention.js';
import { spacedText } from './spacedText.js';

const MAX_TEXT_LEVELS = 12;

const MAX_CLIMBING_STEPS = 40;

const MAX_BLOCK_TEXT = 1500;

const MIN_RUN_TEXT = 20;

const MIN_BLOCK_TEXT = 40;

const MIN_LEVELS_BEFORE_STOPPING = 2;

const ancestry = (node: AnyNode): readonly AnyNode[] => (node.parent ? [node, ...ancestry(node.parent)] : [node]);

const commonAncestor = (head: AnyNode, elements: readonly AnyNode[]): AnyNode => {
  const others = elements.slice(1).map(ancestry);
  return ancestry(head).find((node) => others.every((chain) => chain.includes(node))) ?? head;
};

const isInside = (container: AnyNode, node: AnyNode): boolean => ancestry(node).includes(container);

const childrenOf = (node: AnyNode): readonly AnyNode[] => ('children' in node ? node.children : []);

const isTopOfDocument = (node: AnyNode | null): boolean => node === null || node.type === 'root';

const smallestContainer = ($: CheerioAPI, start: AnyNode, key: string, keyOf: AnchorKeyOf): AnyNode => {
  const holdsAnotherAd = (node: AnyNode): boolean =>
    $(node)
      .find('a[href]')
      .toArray()
      .some((link) => {
        const linkKey = keyOf(link);
        return linkKey !== undefined && linkKey !== key;
      });
  const oneLevelMore = (container: AnyNode): AnyNode => {
    const grand = container.parent;
    if (grand === null || isTopOfDocument(grand)) {
      return container;
    }
    return !holdsAnotherAd(grand) && spacedText(grand).length <= MAX_BLOCK_TEXT ? grand : container;
  };
  const climb = (node: AnyNode, levels: number, steps: number): AnyNode => {
    if (levels >= MAX_TEXT_LEVELS || steps >= MAX_CLIMBING_STEPS) {
      return node;
    }
    const parent = node.parent;
    if (parent === null || isTopOfDocument(parent) || holdsAnotherAd(parent)) {
      return node;
    }
    const text = spacedText(parent);
    if (text.length > MAX_BLOCK_TEXT) {
      return node;
    }
    const climbed = text.length !== spacedText(node).length ? levels + 1 : levels;
    if (PRICE_OR_KM_MENTION.test(text) && text.length > MIN_BLOCK_TEXT && climbed >= MIN_LEVELS_BEFORE_STOPPING) {
      return oneLevelMore(parent);
    }
    return climb(parent, climbed, steps + 1);
  };
  return climb(start, 0, 0);
};

const runBetweenLinks = ($: CheerioAPI, group: readonly AdAnchor[], key: string, keyOf: AnchorKeyOf): readonly AnyNode[] => {
  const elements = group.map((anchor) => anchor.element);
  const [head] = elements;
  if (!head) {
    return [];
  }
  const ancestor = commonAncestor(head, elements);
  const children = childrenOf(ancestor);
  const holding = children.flatMap((child, index) => (elements.some((element) => isInside(child, element)) ? [index] : []));
  const first = holding[0];
  const last = holding[holding.length - 1];
  if (first !== undefined && last !== undefined) {
    const run = children.slice(first, last + 1);
    const text = run.map(spacedText).join(' ');
    if (PRICE_OR_KM_MENTION.test(text) && text.length > MIN_RUN_TEXT) {
      return run;
    }
  }
  return [smallestContainer($, ancestor, key, keyOf)];
};

export const adBlock = ($: CheerioAPI, group: readonly AdAnchor[], keyOf: AnchorKeyOf): readonly AnyNode[] => {
  const [head] = group;
  if (!head) {
    return [];
  }
  return group.length > 1 ? runBetweenLinks($, group, head.key, keyOf) : [smallestContainer($, head.element, head.key, keyOf)];
};
