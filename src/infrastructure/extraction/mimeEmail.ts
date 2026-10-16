import { simpleParser } from 'mailparser';
import type { EmailMessage } from '../../application/ports/listingExtractor.js';

const instantOf = (date: Date | undefined): string | undefined =>
  date === undefined || Number.isNaN(date.getTime()) ? undefined : date.toISOString();

export const decodeEmail = async (source: Uint8Array): Promise<EmailMessage> => {
  const parsed = await simpleParser(Buffer.from(source));
  return {
    messageId: parsed.messageId,
    from: parsed.from?.value?.[0]?.address ?? '',
    subject: parsed.subject ?? '',
    date: instantOf(parsed.date),
    html: typeof parsed.html === 'string' ? parsed.html : undefined,
    text: parsed.text,
  };
};
