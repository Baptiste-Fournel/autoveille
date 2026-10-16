import type Database from 'better-sqlite3';
import type { MailboxPosition, MailboxStateRepository, ProcessedEmail } from '../../../application/ports/mailboxStateRepository.js';
import {
  type MailboxPositionRow,
  mailboxPositionOf,
  mailboxPositionRowOf,
  type ProcessedEmailRow,
  processedEmailOf,
  processedEmailRowOf,
} from './mailboxStateMapper.js';

export class SqliteMailboxStateRepository implements MailboxStateRepository {
  private readonly selectProcessed: Database.Statement<[string], { readonly message_id: string }>;
  private readonly upsertProcessed: Database.Statement<[ProcessedEmailRow]>;
  private readonly selectRecentlyProcessed: Database.Statement<[number], ProcessedEmailRow>;
  private readonly selectPosition: Database.Statement<[string], MailboxPositionRow>;
  private readonly upsertPosition: Database.Statement<[MailboxPositionRow]>;
  private readonly deleteProcessed: Database.Statement<[]>;
  private readonly rewindPositions: Database.Statement<[]>;

  constructor(database: Database.Database) {
    this.selectProcessed = database.prepare<[string], { readonly message_id: string }>(
      'SELECT message_id FROM emails_processed WHERE message_id = ?',
    );
    this.upsertProcessed = database.prepare<[ProcessedEmailRow]>(
      `INSERT INTO emails_processed (message_id, uid, subject, sender, received_at, site, parsed_count, parsed_json, error, processed_at)
       VALUES (@message_id, @uid, @subject, @sender, @received_at, @site, @parsed_count, @parsed_json, @error, @processed_at)
       ON CONFLICT (message_id) DO UPDATE SET
         parsed_count = excluded.parsed_count, parsed_json = excluded.parsed_json, error = excluded.error, processed_at = excluded.processed_at`,
    );
    this.selectRecentlyProcessed = database.prepare<[number], ProcessedEmailRow>(
      `SELECT message_id, uid, subject, sender, received_at, site, parsed_count, parsed_json, error, processed_at
       FROM emails_processed ORDER BY processed_at DESC, rowid LIMIT ?`,
    );
    this.selectPosition = database.prepare<[string], MailboxPositionRow>(
      'SELECT mailbox, last_uid, uid_validity FROM mail_state WHERE mailbox = ?',
    );
    this.upsertPosition = database.prepare<[MailboxPositionRow]>(
      `INSERT INTO mail_state (mailbox, last_uid, uid_validity) VALUES (@mailbox, @last_uid, @uid_validity)
       ON CONFLICT (mailbox) DO UPDATE SET last_uid = excluded.last_uid, uid_validity = excluded.uid_validity`,
    );
    this.deleteProcessed = database.prepare<[]>('DELETE FROM emails_processed');
    this.rewindPositions = database.prepare<[]>('UPDATE mail_state SET last_uid = 0');
  }

  isProcessed(messageId: string): boolean {
    return this.selectProcessed.get(messageId) !== undefined;
  }

  recordProcessed(email: ProcessedEmail): void {
    this.upsertProcessed.run(processedEmailRowOf(email));
  }

  recentlyProcessed(limit: number): readonly ProcessedEmail[] {
    return this.selectRecentlyProcessed.all(limit).map(processedEmailOf);
  }

  position(mailbox: string): MailboxPosition {
    return mailboxPositionOf(this.selectPosition.get(mailbox));
  }

  savePosition(mailbox: string, position: MailboxPosition): void {
    this.upsertPosition.run(mailboxPositionRowOf(mailbox, position));
  }

  forgetReadEmails(): void {
    this.deleteProcessed.run();
    this.rewindPositions.run();
  }
}
