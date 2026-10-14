import type { FastifyInstance } from 'fastify';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Store, VehicleRow } from './db.js';
import type { Pipeline } from './pipeline.js';
import type { AppNotifier } from './notify/notify.js';
import type { Scheduler } from './scheduler.js';
import { geocode } from './geo/geo.js';
import { mergeSettings } from './listings/defaults.js';
import { reasonKind, specialReason } from './listings/filters.js';
import { extractVehicleInfo } from './listings/normalize.js';
import { customBrands } from './pipeline.js';
import { buildVars, lintTemplate, render, VARIABLE_HELP } from './messages/templates.js';
import { testMailbox } from './sources/email/imap.js';
import { fetchSite } from './sources/http.js';
import { siteSetups } from './sources/links.js';
import { alertAdvice, alertMismatch, siteLabel } from './sources/email/confirmations.js';
import { FAMILIES, FAMILY_LABELS, type Family, type RawListing, type Settings, type Status } from './types.js';

interface Deps { store: Store; pipeline: Pipeline; notifier: AppNotifier; scheduler: Scheduler; friendlyImapError: (e: unknown) => string }

const STATUSES: Status[] = ['nouveau', 'contacte', 'repondu', 'ignore'];

const SAMPLES: Record<Family, RawListing> = {
  allemandes: { site: 'leboncoin', siteLabel: 'Leboncoin', externalId: 'ex', url: '#', title: 'Porsche 911 Carrera S 3.0 420ch PDK', price: 89900, km: 42000, year: 2015, city: 'Pessac', postalCode: '33600' },
  italiennes: { site: 'lacentrale', siteLabel: 'La Centrale', externalId: 'ex', url: '#', title: 'Ferrari 360 Modena F1', price: 79000, km: 45000, year: 2001, city: 'Libourne', postalCode: '33500' },
  americaines: { site: 'leboncoin', siteLabel: 'Leboncoin', externalId: 'ex', url: '#', title: 'Ford Mustang GT 5.0 V8', price: 42000, km: 31000, year: 2018, city: 'Arcachon', postalCode: '33120' },
  francaises: { site: 'paruvendu', siteLabel: 'ParuVendu', externalId: 'ex', url: '#', title: 'Alpine A110 Légende 252ch', price: 58900, km: 21000, year: 2019, city: 'Langon', postalCode: '33210' },
  autres: { site: 'leboncoin', siteLabel: 'Leboncoin', externalId: 'ex', url: '#', title: 'Porsche 911', price: 0, km: 0, year: 2015, city: 'Bordeaux', postalCode: '33000' },
};

export function registerApi(app: FastifyInstance, deps: Deps): void {
  const { store, pipeline, notifier, scheduler } = deps;

  const vehicleDto = (v: VehicleRow, settings: Settings, full = false) => {
    const listings = store.listingsOfVehicle(v.id);
    const first = listings[0];
    const withImage = listings.find((l) => l.image_url);
    const raw: RawListing | undefined = first ? { site: first.site, siteLabel: first.site_label, externalId: first.external_id, url: first.url, title: first.title, price: v.price ?? undefined, km: v.km ?? undefined, year: v.year ?? undefined, city: v.city ?? undefined, postalCode: v.postal_code ?? undefined } : undefined;
    const special = raw && v.family !== 'autres' ? specialReason(v.family, { make: v.make ?? undefined, model: v.model ?? undefined, family: v.family, year: v.year ?? undefined, km: v.km ?? undefined, price: v.price ?? undefined }, raw, settings) : undefined;
    return {
      id: v.id,
      name: [v.make, v.model].filter(Boolean).join(' ') || first?.title || '',
      title: first?.title ?? '',
      make: v.make, model: v.model, family: v.family, familyLabel: FAMILY_LABELS[v.family],
      year: v.year, km: v.km, price: v.price, city: v.city, postalCode: v.postal_code,
      distanceKm: v.distance_km === null ? null : Math.round(v.distance_km),
      status: v.status, doNotContact: Boolean(v.do_not_contact), matched: Boolean(v.matched),
      reasons: JSON.parse(v.reasons || '[]') as string[],
      specialReason: special ?? null,
      priceDropped: Boolean(v.price_dropped), reposted: Boolean(v.reposted),
      firstSeenAt: v.first_seen_at, lastSeenAt: v.last_seen_at,
      publishedAt: v.published_at ?? listings.map((l) => l.published_at).filter((d): d is string => Boolean(d)).sort()[0] ?? null,
      url: first?.url ?? '', site: first?.site ?? '', siteLabel: first?.site_label ?? '',
      imageUrl: withImage?.image_url ?? null,
      description: listings.find((l) => l.description)?.description ?? null,
      sellerType: first?.seller_type ?? 'inconnu',
      message: pipeline.messageFor(v, settings),
      messageEdited: Boolean(v.message_override),
      note: v.note ?? '',
      contactedAt: v.status === 'contacte' || v.status === 'repondu' ? store.lastEventAt(v.id, 'statut_contacte') : null,
      repliedAt: v.status === 'repondu' ? store.lastEventAt(v.id, 'statut_repondu') : null,
      listings: listings.map((l) => ({ id: l.id, site: l.site, siteLabel: l.site_label, url: l.url, title: l.title, price: l.price, firstSeenAt: l.first_seen_at, lastSeenAt: l.last_seen_at, priceHistory: full ? store.priceHistory(l.id) : [] })),
      events: full ? store.events(v.id) : [],
    };
  };

  // ---------- overview ----------
  app.get('/api/overview', async () => {
    const settings = store.getSettings();
    return {
      counts: store.counts(),
      week: store.weekStats(7),
      dealer: settings.dealer,
      zone: { city: settings.zone.city, radiusKm: settings.zone.radiusKm },
      imapConfigured: Boolean(settings.imap.user && settings.imap.pass),
      alertsDone: Object.keys(settings.alertsDone).filter((k) => settings.alertsDone[k]),
      alertIssues: Object.values(settings.alerts).flatMap((a) => alertMismatch(a, settings).map((m) => `${siteLabel(a.site)} : ${m}`)),
      sources: store.sourceRuns(),
      pushKey: store.secret('vapid_public'),
    };
  });

  // ---------- vehicles ----------
  app.get<{ Querystring: { status?: string; days?: string; limit?: string; kind?: string } }>('/api/vehicles', async (req) => {
    const settings = store.getSettings();
    const status = req.query.status ?? 'nouveau';
    const days = req.query.days ? Number(req.query.days) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 150;
    if (status === 'ecartees') {
      // Wide alerts on the sites mean many refusals: they are grouped by reason so a good deal is quick to spot.
      const all = store.listVehicles({ onlyMatched: false, sinceDays: days ?? 14, limit: 3000 }).filter((v) => !v.matched);
      const kindsOf = (v: VehicleRow) => new Set((JSON.parse(v.reasons || '[]') as string[]).map(reasonKind));
      const counts: Record<string, number> = { tous: all.length, suivies: 0, loin: 0, km: 0, special: 0, pro: 0, marque: 0 };
      const cache = new Map<number, Set<string>>();
      for (const v of all) { const k = kindsOf(v); cache.set(v.id, k); if (!k.has('marque')) counts.suivies++; for (const x of k) counts[x] = (counts[x] ?? 0) + 1; }
      const kind = req.query.kind || 'suivies';
      const rows = all.filter((v) => { const k = cache.get(v.id)!; return kind === 'tous' ? true : kind === 'suivies' ? !k.has('marque') : k.has(kind); }).slice(0, limit);
      return { vehicles: rows.map((v) => vehicleDto(v, settings)), kinds: counts };
    }
    const rows = store.listVehicles({ status: status === 'tous' ? 'tous' : (STATUSES.includes(status as Status) ? (status as Status) : 'nouveau'), sinceDays: days, limit });
    return { vehicles: rows.map((v) => vehicleDto(v, settings)) };
  });

  app.get<{ Params: { id: string } }>('/api/vehicles/:id', async (req, reply) => {
    const v = store.getVehicle(Number(req.params.id));
    if (!v) return reply.code(404).send({ error: 'Annonce inconnue.' });
    return vehicleDto(v, store.getSettings(), true);
  });

  app.delete<{ Params: { id: string } }>('/api/vehicles/:id', async (req, reply) => {
    const v = store.getVehicle(Number(req.params.id));
    if (!v) return reply.code(404).send({ error: 'Annonce inconnue.' });
    store.deleteVehicle(v.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: { status?: string; doNotContact?: boolean; message?: string | null; keep?: boolean; note?: string | null } }>('/api/vehicles/:id', async (req, reply) => {
    const v = store.getVehicle(Number(req.params.id));
    if (!v) return reply.code(404).send({ error: 'Annonce inconnue.' });
    const now = new Date().toISOString();
    const b = req.body ?? {};
    const patch: Partial<VehicleRow> = {};
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status as Status)) return reply.code(400).send({ error: 'Statut inconnu.' });
      patch.status = b.status as Status;
      // Going back (a wrong tap, « pas encore contactée ») erases the steps it cancels, so the counts stay true.
      if (b.status === 'nouveau') store.deleteEvents(v.id, ['statut_contacte', 'statut_repondu']);
      else if (b.status === 'contacte' && v.status === 'repondu') store.deleteEvents(v.id, ['statut_repondu']);
      store.addEvent(v.id, `statut_${b.status}`, null, now);
    }
    if (b.doNotContact !== undefined) {
      patch.do_not_contact = b.doNotContact ? 1 : 0;
      if (b.doNotContact) { patch.status = 'ignore'; store.addEvent(v.id, 'ne_plus_contacter', null, now); }
    }
    if (b.message !== undefined) patch.message_override = b.message && b.message.trim() ? b.message : null;
    if (b.note !== undefined) patch.note = b.note && String(b.note).trim() ? String(b.note).slice(0, 2000) : null;
    if (b.keep) { patch.matched = 1; patch.reasons = '[]'; store.addEvent(v.id, 'garde_manuellement', null, now); }
    store.updateVehicle(v.id, patch);
    return vehicleDto(store.getVehicle(v.id)!, store.getSettings(), true);
  });

  // ---------- settings ----------
  app.get('/api/settings', async () => {
    const s = store.getSettings();
    return { settings: maskSettings(s), variables: VARIABLE_HELP, families: FAMILIES.map((f) => ({ key: f, label: FAMILY_LABELS[f] })) };
  });

  const applyZone = async (next: Settings, current: Settings): Promise<string | undefined> => {
    const changed = next.zone.city !== current.zone.city || next.zone.postalCode !== current.zone.postalCode || next.zone.lat === null;
    if (!changed) return undefined;
    const g = await geocode(next.zone.city, next.zone.postalCode || undefined);
    if (!g) { next.zone.lat = null; next.zone.lon = null; return 'Ville introuvable : le filtre de distance est désactivé tant que la ville n’est pas reconnue.'; }
    next.zone.lat = g.lat; next.zone.lon = g.lon;
    return g.precision === 'departement' ? 'Ville non reconnue précisément : distance calculée depuis le centre du département.' : undefined;
  };

  app.put<{ Body: Partial<Settings> }>('/api/settings', async (req, reply) => {
    const current = store.getSettings();
    const next = sanitize(mergeSettings({ ...current, ...(req.body ?? {}) }), current);
    if (typeof next === 'string') return reply.code(400).send({ error: next });
    const warning = await applyZone(next, current);
    store.saveSettings(next);
    const preview = await pipeline.reevaluate(next, 7, true);
    return { settings: maskSettings(next), preview, warning: warning ?? null };
  });

  app.post<{ Body: Partial<Settings> }>('/api/settings/preview', async (req) => {
    const current = store.getSettings();
    const next = sanitize(mergeSettings({ ...current, ...(req.body ?? {}) }), current);
    if (typeof next === 'string') return { error: next, pass: 0, total: 0 };
    await applyZone(next, current);
    const preview = await pipeline.reevaluate(next, 7, false);
    return preview;
  });

  // ---------- templates ----------
  app.post<{ Body: { family?: Family; text?: string; vehicleId?: number } }>('/api/templates/preview', async (req) => {
    const settings = store.getSettings();
    const family = (req.body?.family ?? 'allemandes') as Family;
    const text = req.body?.text ?? settings.templates[family]?.variants[0] ?? '';
    let raw = SAMPLES[family] ?? SAMPLES.allemandes;
    let distance: number | null = 12;
    if (req.body?.vehicleId) {
      const v = store.getVehicle(req.body.vehicleId);
      const first = v ? store.firstListingOfVehicle(v.id) : undefined;
      if (v && first) {
        raw = { site: first.site, siteLabel: first.site_label, externalId: first.external_id, url: first.url, title: first.title, price: v.price ?? undefined, km: v.km ?? undefined, year: v.year ?? undefined, city: v.city ?? undefined, postalCode: v.postal_code ?? undefined };
        distance = v.distance_km;
      }
    }
    const info = extractVehicleInfo(raw, customBrands(settings));
    return { text: render(text, buildVars(raw, info, settings, distance)), warnings: lintTemplate(text) };
  });

  // ---------- sources ----------
  app.get('/api/sources', async () => {
    const settings = store.getSettings();
    const runs = store.sourceRuns();
    return {
      imap: { host: settings.imap.host, port: settings.imap.port, user: settings.imap.user, hasPassword: Boolean(settings.imap.pass), mailbox: settings.imap.mailbox, configured: Boolean(settings.imap.user && settings.imap.pass), lastRun: runs.find((r) => r.source === 'email') ?? null },
      sites: siteSetups(settings).map((s) => {
        const alert = settings.alerts[s.key];
        return { ...s, done: Boolean(settings.alertsDone[s.key]), alert: alert ?? null, issues: alert ? alertMismatch(alert, settings) : [], advice: alert ? alertAdvice(alert, settings) : null };
      }),
      httpSites: settings.httpSites.map((s) => ({ ...s, lastRun: runs.find((r) => r.source === `http:${s.id}`) ?? null })),
      emails: store.recentEmails(25).map((e) => ({ ...e, parsed: e.parsed_json ? JSON.parse(e.parsed_json) : null, parsed_json: undefined })),
    };
  });

  app.post<{ Body: { host?: string; port?: number; user?: string; pass?: string; mailbox?: string } }>('/api/sources/imap/test', async (req) => {
    const s = store.getSettings().imap;
    // The form sends the saved password back masked: the test then uses the real one.
    const typed = req.body?.pass && req.body.pass !== '••••••••' ? req.body.pass : '';
    const cfg = { host: req.body?.host || s.host, port: Number(req.body?.port || s.port), user: req.body?.user || s.user, pass: typed || s.pass, mailbox: req.body?.mailbox || s.mailbox };
    if (!cfg.user || !cfg.pass) return { ok: false, detail: 'Adresse ou mot de passe d’application manquant.' };
    try {
      const r = await testMailbox(cfg);
      return { ok: true, detail: `Connexion réussie, ${r.messages} email(s) dans la boîte.` };
    } catch (err) {
      return { ok: false, detail: deps.friendlyImapError(err) };
    }
  });

  app.post('/api/sources/check-now', async () => {
    const mail = await scheduler.runMail();
    const http = await scheduler.runHttp();
    return { mail, http };
  });

  /** Reads the whole mailbox again (after an extraction fix, say). Known listings are completed, not duplicated. */
  app.post('/api/sources/reread', async () => {
    await scheduler.idleMail();
    store.resetMailbox();
    const mail = await scheduler.runMail();
    return { mail };
  });

  /**
   * One-off import of listings read elsewhere (a search page opened by hand, say): they go through the same
   * filters as the alert emails, without notifications. Known listings are completed, not duplicated.
   */
  app.get('/api/import/token', async () => {
    let token = store.secret('import_token');
    if (!token) { token = randomBytes(24).toString('hex'); store.setSecret('import_token', token); }
    return { token };
  });

  app.post<{ Body: { listings?: Array<Partial<RawListing>>; notify?: boolean; token?: string } }>('/api/import', async (req, reply) => {
    const viaToken = (req.headers['content-type'] ?? '').startsWith('text/plain');
    if (viaToken) {
      const expected = store.secret('import_token');
      if (!expected || !req.body?.token || req.body.token.length !== expected.length || !timingSafeEqual(Buffer.from(req.body.token), Buffer.from(expected))) return reply.code(401).send({ error: 'jeton invalide' });
    }
    const items = Array.isArray(req.body?.listings) ? req.body.listings.slice(0, 500) : [];
    if (!items.length) return reply.code(400).send({ error: 'Aucune annonce à importer.' });
    const settings = store.getSettings();
    const out = { received: items.length, new: 0, matched: 0, seen: 0, skipped: 0 };
    for (const it of items) {
      const site = String(it.site ?? '').slice(0, 40);
      const url = String(it.url ?? '').slice(0, 1000);
      const title = String(it.title ?? '').trim().slice(0, 300);
      if (!site || !/^https?:/i.test(url) || !title) { out.skipped++; continue; }
      const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined; };
      const raw: RawListing = {
        site, siteLabel: String(it.siteLabel ?? siteLabel(site)).slice(0, 60), externalId: String(it.externalId ?? url).slice(0, 300), url, title,
        price: num(it.price), km: num(it.km), year: num(it.year),
        city: it.city ? String(it.city).slice(0, 120) : undefined, postalCode: it.postalCode ? String(it.postalCode).slice(0, 10) : undefined,
        imageUrl: it.imageUrl && /^https?:/i.test(String(it.imageUrl)) ? String(it.imageUrl).slice(0, 1000) : undefined,
        description: it.description ? String(it.description).slice(0, 4000) : undefined,
        sellerType: it.sellerType === 'pro' || it.sellerType === 'particulier' ? it.sellerType : undefined,
        publishedAt: it.publishedAt && !Number.isNaN(Date.parse(String(it.publishedAt))) ? new Date(String(it.publishedAt)).toISOString() : undefined,
      };
      try {
        const r = await pipeline.ingest(raw, settings, { notify: req.body?.notify === true });
        if (r.kind === 'new') { out.new++; if (r.matched) out.matched++; } else out.seen++;
      } catch { out.skipped++; }
    }
    return out;
  });

  app.post<{ Body: { url?: string } }>('/api/sources/http/test', async (req) => {
    const url = (req.body?.url ?? '').trim();
    if (!url) return { ok: false, detail: 'Indiquez l’adresse de la page de résultats.' };
    const r = await fetchSite(url);
    return { ok: r.ok, detail: r.detail, sample: r.listings.slice(0, 5).map((l) => ({ title: l.title, price: l.price, km: l.km, year: l.year, city: l.city, url: l.url })) };
  });

  // ---------- notifications ----------
  app.get('/api/push/key', async () => ({ key: store.secret('vapid_public') }));
  app.post<{ Body: { subscription?: { endpoint: string } } }>('/api/push/subscribe', async (req, reply) => {
    const sub = req.body?.subscription;
    if (!sub?.endpoint) return reply.code(400).send({ error: 'Abonnement invalide.' });
    store.addPushSubscription(sub);
    return { ok: true, count: store.pushSubscriptions().length };
  });
  app.post<{ Body: { endpoint?: string } }>('/api/push/unsubscribe', async (req) => {
    if (req.body?.endpoint) store.removePushSubscription(req.body.endpoint);
    return { ok: true };
  });
  app.post('/api/push/test', async () => {
    try {
      const r = await notifier.sendPush({ title: 'AutoVeille', body: 'Les notifications fonctionnent sur cet appareil.', url: `${notifier.baseUrl()}/` });
      return { ok: r.sent > 0, detail: r.sent > 0 ? `Notification envoyée à ${r.sent} appareil(s).` : 'Aucun appareil abonné : activez les notifications sur ce téléphone ou cet ordinateur.' };
    } catch (err) {
      return { ok: false, detail: `Envoi impossible : ${err instanceof Error ? err.message : String(err)}` };
    }
  });
  app.post<{ Body: { token?: string; chatId?: string } }>('/api/telegram/test', async (req) => {
    const s = store.getSettings().notifications;
    const token = req.body?.token || s.telegramToken, chatId = req.body?.chatId || s.telegramChatId;
    if (!token || !chatId) return { ok: false, detail: 'Renseignez le jeton du bot et l’identifiant de conversation.' };
    try {
      await notifier.sendTelegram(token, chatId, 'AutoVeille : les notifications Telegram fonctionnent.');
      return { ok: true, detail: 'Message envoyé sur Telegram.' };
    } catch (err) {
      return { ok: false, detail: `Envoi impossible : ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}

function maskSettings(s: Settings): Settings {
  return { ...s, imap: { ...s.imap, pass: s.imap.pass ? '••••••••' : '' } };
}

/** Light validation; keeps secrets the UI sends back masked. Returns an error message as a string. */
function sanitize(next: Settings, current: Settings): Settings | string {
  if (next.imap.pass === '••••••••') next.imap.pass = current.imap.pass;
  if (next.notifications.telegramToken === '••••••••') next.notifications.telegramToken = current.notifications.telegramToken;
  next.maxKm = Math.max(0, Math.round(Number(next.maxKm) || 0));
  next.zone.radiusKm = Math.max(0, Math.round(Number(next.zone.radiusKm) || 0));
  next.zone.city = String(next.zone.city ?? '').trim();
  next.zone.postalCode = String(next.zone.postalCode ?? '').trim();
  if (!next.zone.city && !next.zone.postalCode) return 'Indiquez la ville de la zone.';
  for (const f of Object.keys(next.families) as Family[]) {
    const r = next.families[f];
    r.minPrice = Math.max(0, Math.round(Number(r.minPrice) || 0));
    r.maxYear = Math.max(0, Math.round(Number(r.maxYear) || 0));
    r.keywords = (r.keywords ?? []).map((k) => String(k).trim()).filter(Boolean);
    r.brands = (r.brands ?? []).map((k) => String(k).trim()).filter(Boolean);
    r.known = Array.from(new Set([...(r.known ?? []), ...r.brands].map((k) => String(k).trim()).filter(Boolean)));
  }
  for (const f of Object.keys(next.templates) as Family[]) {
    next.templates[f].variants = (next.templates[f].variants ?? []).map((v) => String(v).replace(/\r\n/g, '\n').trim()).filter(Boolean);
  }
  next.httpSites = (next.httpSites ?? []).map((s) => ({ id: s.id || Math.random().toString(36).slice(2, 10), name: String(s.name ?? '').trim() || 'Site', url: String(s.url ?? '').trim(), enabled: s.enabled !== false }));
  next.imap.port = Number(next.imap.port) || 993;
  // Confirmations recorded from the mailbox are kept even when a client sends settings loaded before they arrived.
  const alerts = { ...current.alerts, ...(next.alerts ?? {}) };
  next.alerts = Object.fromEntries(Object.entries(alerts).filter(([, v]) => v && typeof v === 'object' && typeof v.criteria === 'string').map(([k, v]) => [String(k).slice(0, 40), { ...v, site: String(k).slice(0, 40), criteria: String(v.criteria).slice(0, 300), manageUrl: v.manageUrl && /^https?:/i.test(v.manageUrl) ? v.manageUrl.slice(0, 500) : undefined }]));
  next.alertsDone = Object.fromEntries(Object.entries(next.alertsDone ?? {}).filter(([, v]) => v === true).map(([k]) => [String(k).slice(0, 40), true]));
  for (const k of Object.keys(next.alerts)) next.alertsDone[k] = true;
  return next;
}
