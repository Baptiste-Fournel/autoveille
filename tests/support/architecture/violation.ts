export type RuleId =
  | 'placement'
  | 'domainDependency'
  | 'applicationDependency'
  | 'infrastructureDependency'
  | 'sharedTypesOnly'
  | 'clientDependency'
  | 'compositionRoot'
  | 'globalState'
  | 'impureGlobal'
  | 'comment'
  | 'unsafeAssertion'
  | 'typeAssertion'
  | 'syntax';

export type SourceFile = {
  readonly path: string;
  readonly text: string;
};

export type Violation = {
  readonly rule: RuleId;
  readonly path: string;
  readonly line: number;
  readonly message: string;
};

const lineOf = (text: string, offset: number): number => text.slice(0, offset).split('\n').length;

export const violationAt = (rule: RuleId, file: SourceFile, offset: number, description: string): Violation => {
  const line = lineOf(file.text, offset);
  return { rule, path: file.path, line, message: `${file.path}:${line} ${description}` };
};

export const excerpt = (text: string): string => {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  return singleLine.length > 80 ? `${singleLine.slice(0, 79)}…` : singleLine;
};
