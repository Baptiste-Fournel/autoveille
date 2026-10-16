export const gmailRefusesPassword = (): Error =>
  Object.assign(new Error('Command failed'), {
    authenticationFailed: true,
    responseStatus: 'NO',
    responseText: 'Invalid credentials (Failure)',
    serverResponseCode: 'AUTHENTICATIONFAILED',
  });

export const gmailUnknownMailbox = (mailbox: string): Error =>
  Object.assign(new Error('Command failed'), {
    responseStatus: 'NO',
    responseText: `Unknown Mailbox: ${mailbox} (now in authenticated state) (Failure)`,
    serverResponseCode: 'NONEXISTENT',
  });
