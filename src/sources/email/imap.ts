import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import type { Store } from '../../db.js';
import type { Pipeline } from '../../pipeline.js';
import { resolveRedirect } from '../sites.js';
import { parseAlertEmail } from './parse.js';
import { detectAlertConfirmation } from './confirmations.js';

export interface ImapConfig { host: string; port: number; user: string; pass: string; mailbox: string }

export interface PollResult { processed: number; listings: number; matched: number; errors: string[] }

const MAX_PER_POLL = 60;
const FIRST_RUN_DAYS = 3;

/** Read new alert emails and feed every listing they contain into the pipeline. */
export async function pollMailbox(cfg: ImapConfig, store: Store, pipeline: Pipeline, log: (m: string) => void = () => {}): Promise<PollResult> {
  const result: PollResult = { processed: 0, listings: 0, matched: 0, errors: [] };
  const client = new ImapFlow({ host: cfg.host, port: cfg.port, secure: cfg.port === 993, auth: { user: cfg.user, pass: cfg.pass }, logger: false });
  await client.connect();
  try {
    const lock = await client.getMailboxLock(cfg.mailbox);
    try {
      const mailbox = client.mailbox;
      const uidValidity = mailbox && typeof mailbox === 'object' && 'uidValidity' in mailbox ? Number(mailbox.uidValidity) : null;
      const state = store.mailState(cfg.mailbox);
      let lastUid = state.uid_validity !== null && uidValidity !== null && state.uid_validity !== uidValidity ? 0 : state.last_uid;

      let uids: number[];
      if (lastUid === 0) {
        const since = new Date(Date.now() - FIRST_RUN_DAYS * 86400_000);
        const found = await client.search({ since }, { uid: true });
        uids = (Array.isArray(found) ? found : []).sort((a, b) => a - b);
      } else {
        const found = await client.search({ uid: `${lastUid + 1}:*` }, { uid: true });
        uids = (Array.isArray(found) ? found : []).filter((u) => u > lastUid).sort((a, b) => a - b);
      }
      uids = uids.slice(0, MAX_PER_POLL);
      log(`${uids.length} email(s) à traiter`);

      for (const uid of uids) {
        try {
          const msg = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
          if (!msg || !msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const messageId = parsed.messageId ?? `uid-${uidValidity ?? 0}-${uid}`;
          if (store.emailProcessed(messageId)) { lastUid = Math.max(lastUid, uid); continue; }
          const from = parsed.from?.value?.[0]?.address ?? '';
          const subject = parsed.subject ?? '';
          const input = { html: typeof parsed.html === 'string' ? parsed.html : undefined, text: parsed.text, subject, from, date: parsed.date, messageId };

          const confirmation = detectAlertConfirmation({ from, subject, html: input.html, text: input.text, date: parsed.date });
          if (confirmation) { store.recordAlert(confirmation); log(`alerte ${confirmation.site} confirmée par email : ${confirmation.criteria}`); }

          let out = parseAlertEmail(input);
          if (out.pending.length) {
            const resolved = new Map<string, string>();
            await Promise.all(out.pending.slice(0, 40).map(async (p) => {
              const dest = await resolveRedirect(p.href);
              if (dest) resolved.set(p.href, dest);
            }));
            out = parseAlertEmail(input, resolved);
          }

          let matched = 0;
          for (const listing of out.listings) {
            const r = await pipeline.ingest(listing);
            if (r.kind === 'new' && r.matched) matched++;
          }
          store.markEmail({
            message_id: messageId, uid, subject, sender: from, received_at: parsed.date?.toISOString() ?? null, site: out.site ?? null,
            parsed_count: out.listings.length,
            parsed_json: JSON.stringify({ listings: out.listings.map((l) => ({ title: l.title, price: l.price, km: l.km, year: l.year, city: l.city, postalCode: l.postalCode, sellerType: l.sellerType, url: l.url })), pending: out.pending.length, ignored: out.ignored }),
            error: null,
          });
          result.processed++;
          result.listings += out.listings.length;
          result.matched += matched;
          lastUid = Math.max(lastUid, uid);
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          result.errors.push(`uid ${uid}: ${detail}`);
          store.markEmail({ message_id: `uid-${uidValidity ?? 0}-${uid}`, uid, subject: '', sender: '', received_at: null, site: null, parsed_count: 0, parsed_json: null, error: detail });
          lastUid = Math.max(lastUid, uid);
        }
      }
      store.saveMailState(cfg.mailbox, lastUid, uidValidity);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return result;
}

/** Connect, open the mailbox and count messages. Throws with the server's message on failure. */
export async function testMailbox(cfg: ImapConfig): Promise<{ messages: number }> {
  const client = new ImapFlow({ host: cfg.host, port: cfg.port, secure: cfg.port === 993, auth: { user: cfg.user, pass: cfg.pass }, logger: false, connectionTimeout: 15000 });
  await client.connect();
  try {
    const lock = await client.getMailboxLock(cfg.mailbox);
    try {
      const mb = client.mailbox;
      return { messages: mb && typeof mb === 'object' && 'exists' in mb ? Number(mb.exists) : 0 };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}
