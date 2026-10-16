import { errorMessage } from '../../../application/sources/errorMessage.js';

const serverAnswer = (error: unknown): string | undefined => {
  if (!(error instanceof Error) || !('responseText' in error) || typeof error.responseText !== 'string' || error.responseText === '') {
    return undefined;
  }
  const code = 'serverResponseCode' in error && typeof error.serverResponseCode === 'string' ? `[${error.serverResponseCode}] ` : '';
  return `${code}${error.responseText}`;
};

export const imapFailureReason = (error: unknown): string => serverAnswer(error) ?? errorMessage(error);
