import type { MailboxSettings } from '../../domain/settings/types.js';

export interface MailboxSession {
  readonly uidValidity: number | null;
  readonly messageCount: number;
  uidsAfter(uid: number): Promise<readonly number[]>;
  uidsSince(instant: string): Promise<readonly number[]>;
  read(uid: number): Promise<Uint8Array | undefined>;
  close(): Promise<void>;
}

export interface MailboxReader {
  open(account: MailboxSettings, connectionTimeoutMs?: number): Promise<MailboxSession>;
}
