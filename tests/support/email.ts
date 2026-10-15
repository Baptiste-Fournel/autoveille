import { readFileSync } from 'node:fs';
import { simpleParser } from 'mailparser';
import { fixturePath } from './fixtures.js';

export type DecodedEmail = {
  readonly html: string | undefined;
  readonly text: string | undefined;
  readonly subject: string | undefined;
  readonly from: string | undefined;
  readonly date: Date | undefined;
  readonly messageId: string | undefined;
};

export async function loadEmail(pathInFixtures: string): Promise<DecodedEmail> {
  const parsed = await simpleParser(readFileSync(fixturePath(pathInFixtures)));
  return {
    html: typeof parsed.html === 'string' ? parsed.html : undefined,
    text: parsed.text,
    subject: parsed.subject,
    from: parsed.from?.value[0]?.address,
    date: parsed.date,
    messageId: parsed.messageId,
  };
}
