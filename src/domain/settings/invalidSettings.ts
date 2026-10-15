export type SettingsProblem = 'missingZoneCity';

export class InvalidSettings extends Error {
  readonly problem: SettingsProblem;

  constructor(problem: SettingsProblem) {
    super(problem);
    this.name = 'InvalidSettings';
    this.problem = problem;
  }
}
