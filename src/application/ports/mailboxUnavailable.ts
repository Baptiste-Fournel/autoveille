export type MailboxProblem = 'authenticationRefused' | 'serverUnreachable' | 'readFailed';

export class MailboxUnavailable extends Error {
  readonly problem: MailboxProblem;

  constructor(problem: MailboxProblem, message: string) {
    super(message);
    this.name = 'MailboxUnavailable';
    this.problem = problem;
  }
}
