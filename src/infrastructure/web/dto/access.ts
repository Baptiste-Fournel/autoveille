import type { AccessStatus } from '../../../application/auth/accessStatus.js';
import type { MeResponse } from '../../../shared/api.js';

export const accessDto = (status: AccessStatus): MeResponse => ({
  authenticated: status.authenticated,
  needsSetup: status.needsSetup,
  setupCodeRequired: status.setupCodeRequired,
});
