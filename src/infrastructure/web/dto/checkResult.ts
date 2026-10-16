import type { CheckResultDto } from '../../../shared/api.js';

export interface CheckResult {
  readonly ok: boolean;
  readonly detail: string;
}

export const checkResultDto = (result: CheckResult): CheckResultDto => ({ ok: result.ok, detail: result.detail });
