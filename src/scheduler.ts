import type { Store } from './db.js';
import type { Pipeline } from './pipeline.js';
import { pollMailbox } from './sources/email/imap.js';
import { fetchSite } from './sources/http.js';

export interface RunSummary { source: string; ok: boolean; detail: string }

/** Runs the mail poll and the HTTP sites on their own cadence, never two runs of the same source at once. */
export class Scheduler {
  private mailBusy = false;
  private httpBusy = false;
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly store: Store, private readonly pipeline: Pipeline, private readonly log: (m: string) => void) {}

  start(mailMinutes: number, httpMinutes: number): void {
    this.timers.push(setInterval(() => void this.runMail(), Math.max(1, mailMinutes) * 60_000));
    this.timers.push(setInterval(() => void this.runHttp(), Math.max(5, httpMinutes) * 60_000));
    setTimeout(() => { void this.runMail(); void this.runHttp(); }, 5_000);
  }

  stop(): void { this.timers.forEach(clearInterval); this.timers = []; }

  async runMail(): Promise<RunSummary> {
    const imap = this.store.getSettings().imap;
    if (!imap.user || !imap.pass || !imap.host) return { source: 'email', ok: false, detail: 'Boîte mail non configurée.' };
    if (this.mailBusy) return { source: 'email', ok: true, detail: 'Vérification déjà en cours.' };
    this.mailBusy = true;
    try {
      const r = await pollMailbox(imap, this.store, this.pipeline, this.log);
      const detail = `${r.processed} email(s) lu(s), ${r.listings} annonce(s), ${r.matched} nouvelle(s) correspondant aux réglages${r.errors.length ? ` ; ${r.errors.length} erreur(s) : ${r.errors[0]}` : ''}`;
      this.store.sourceRun('email', r.errors.length === 0, detail);
      this.log(`email: ${detail}`);
      return { source: 'email', ok: true, detail };
    } catch (err) {
      const detail = friendlyImapError(err);
      this.store.sourceRun('email', false, detail);
      this.log(`email: ${detail}`);
      return { source: 'email', ok: false, detail };
    } finally {
      this.mailBusy = false;
    }
  }

  async runHttp(): Promise<RunSummary[]> {
    const sites = this.store.getSettings().httpSites.filter((s) => s.enabled && s.url);
    if (!sites.length || this.httpBusy) return [];
    this.httpBusy = true;
    const out: RunSummary[] = [];
    try {
      for (const site of sites) {
        const r = await fetchSite(site.url);
        let matched = 0;
        for (const l of r.listings) {
          const o = await this.pipeline.ingest(l);
          if (o.kind === 'new' && o.matched) matched++;
        }
        const detail = r.ok ? `${r.detail} ${matched} nouvelle(s) correspondant aux réglages.` : r.detail;
        this.store.sourceRun(`http:${site.id}`, r.ok, detail);
        out.push({ source: site.name, ok: r.ok, detail });
      }
    } finally {
      this.httpBusy = false;
    }
    return out;
  }
}

export function friendlyImapError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/auth|credentials|invalid|login|password/i.test(msg)) return 'Connexion à la boîte mail refusée : vérifiez l’adresse et le mot de passe d’application (Gmail exige un mot de passe d’application, pas le mot de passe habituel).';
  if (/ENOTFOUND|EAI_AGAIN|ECONN|timeout/i.test(msg)) return `Serveur mail injoignable (${msg}).`;
  return `Erreur de lecture de la boîte mail : ${msg}`;
}
