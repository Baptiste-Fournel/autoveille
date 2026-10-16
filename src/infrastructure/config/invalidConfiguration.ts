import { invalidNumberVariableText } from '../../domain/presentation/configuration.js';

export class InvalidConfiguration extends Error {
  readonly variable: string;

  readonly value: string;

  constructor(variable: string, value: string) {
    super(invalidNumberVariableText(variable, value));
    this.name = 'InvalidConfiguration';
    this.variable = variable;
    this.value = value;
  }
}
