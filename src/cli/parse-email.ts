/** Test de l'extraction sur un email enregistré (.eml) :  npm run parse-email -- chemin/vers/alerte.eml */
import fs from 'node:fs';
import { simpleParser } from 'mailparser';
import { parseAlertEmail } from '../sources/email/parse.js';
import { resolveRedirect } from '../sources/sites.js';
import { extractVehicleInfo } from '../listings/normalize.js';

const file = process.argv[2];
if (!file) { console.error('Usage : npm run parse-email -- fichier.eml'); process.exit(1); }
const parsed = await simpleParser(fs.readFileSync(file));
const input = { html: typeof parsed.html === 'string' ? parsed.html : undefined, text: parsed.text, subject: parsed.subject, from: parsed.from?.value?.[0]?.address, date: parsed.date, messageId: parsed.messageId };
let out = parseAlertEmail(input);
if (out.pending.length && !process.argv.includes('--offline')) {
  const resolved = new Map<string, string>();
  for (const p of out.pending) { const d = await resolveRedirect(p.href); if (d) resolved.set(p.href, d); }
  out = parseAlertEmail(input, resolved);
}
console.log(JSON.stringify({ site: out.site, pending: out.pending.length, ignored: out.ignored, listings: out.listings.map((l) => ({ ...l, description: undefined, vehicle: extractVehicleInfo(l) })) }, null, 2));
