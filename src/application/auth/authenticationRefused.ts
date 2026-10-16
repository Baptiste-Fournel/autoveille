export type AuthenticationProblem =
  | 'passwordAlreadyChosen'
  | 'tooManyAttempts'
  | 'wrongSetupCode'
  | 'passwordTooShort'
  | 'passwordNotChosenYet'
  | 'wrongPassword';

export class AuthenticationRefused extends Error {
  readonly problem: AuthenticationProblem;

  constructor(problem: AuthenticationProblem) {
    super(problem);
    this.name = 'AuthenticationRefused';
    this.problem = problem;
  }
}
