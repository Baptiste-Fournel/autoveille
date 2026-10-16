import { invalidNumberVariableText, invalidSwitchVariableText } from '../../domain/presentation/configuration.js';

export type ExpectedValue = 'number' | 'zeroOrOne';

const invalidVariableText = (variable: string, value: string, expected: ExpectedValue): string =>
  expected === 'number' ? invalidNumberVariableText(variable, value) : invalidSwitchVariableText(variable, value);

export class InvalidConfiguration extends Error {
  readonly variable: string;

  readonly value: string;

  constructor(variable: string, value: string, expected: ExpectedValue) {
    super(invalidVariableText(variable, value, expected));
    this.name = 'InvalidConfiguration';
    this.variable = variable;
    this.value = value;
  }
}
