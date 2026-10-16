import { escapeRegExp } from '../parsing/regex.js';

const OUR_ROBOTS_AGENT = 'autoveille';

interface RobotsRule {
  readonly allow: boolean;
  readonly pattern: string;
}

interface RobotsGroup {
  readonly agents: readonly string[];
  readonly rules: readonly RobotsRule[];
}

interface Directive {
  readonly field: string;
  readonly value: string;
}

interface Reading {
  readonly groups: readonly RobotsGroup[];
  readonly afterUserAgent: boolean;
}

function directivesOf(robotsTxt: string): readonly Directive[] {
  return robotsTxt.split(/\r?\n/).flatMap((rawLine) => {
    const line = rawLine.replace(/#.*$/, '').trim();
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    const field = match?.[1];
    const value = match?.[2];
    return field === undefined || value === undefined ? [] : [{ field: field.toLowerCase(), value: value.trim() }];
  });
}

const withLastGroup = (groups: readonly RobotsGroup[], change: (group: RobotsGroup) => RobotsGroup): readonly RobotsGroup[] => {
  const last = groups[groups.length - 1];
  return last ? [...groups.slice(0, -1), change(last)] : groups;
};

function read(reading: Reading, directive: Directive): Reading {
  if (directive.field === 'user-agent') {
    const agent = directive.value.toLowerCase();
    const groups =
      reading.afterUserAgent && reading.groups.length > 0
        ? withLastGroup(reading.groups, (group) => ({ ...group, agents: [...group.agents, agent] }))
        : [...reading.groups, { agents: [agent], rules: [] }];
    return { groups, afterUserAgent: true };
  }
  if (directive.field === 'allow' || directive.field === 'disallow') {
    const rule = { allow: directive.field === 'allow', pattern: directive.value };
    return { groups: withLastGroup(reading.groups, (group) => ({ ...group, rules: [...group.rules, rule] })), afterUserAgent: false };
  }
  return { ...reading, afterUserAgent: false };
}

const patternRegExp = (pattern: string): RegExp => new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*').replace(/\\\$$/, '$')}`);

export function robotsAllows(robotsTxt: string, path: string): boolean {
  const { groups } = directivesOf(robotsTxt).reduce(read, { groups: [], afterUserAgent: false });
  const ours = groups.filter((group) => group.agents.some((agent) => agent !== '*' && OUR_ROBOTS_AGENT.includes(agent)));
  const applicable = ours.length > 0 ? ours : groups.filter((group) => group.agents.includes('*'));
  const mostSpecific = applicable
    .flatMap((group) => group.rules)
    .filter((rule) => rule.pattern !== '' && patternRegExp(rule.pattern).test(path))
    .reduce<RobotsRule | undefined>((best, rule) => (!best || rule.pattern.length > best.pattern.length ? rule : best), undefined);
  return mostSpecific ? mostSpecific.allow : true;
}
